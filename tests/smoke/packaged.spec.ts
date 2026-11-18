import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { pageWith, seedConfig } from '../e2e/helpers';
import pkg from '../../package.json';

// Runs against the packaged app in release/<version>/win-unpacked (build:win first).
const exe = join(__dirname, '..', '..', 'release', pkg.version, 'win-unpacked', 'Smaran.exe');

test('packaged app opens, adds a reminder and shows a notification', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'smaran-smoke-'));
  writeFileSync(join(userData, 'config.json'), JSON.stringify(seedConfig()));
  const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`] });
  // Smaran also keeps a hidden menu window ready, so pick the app window by its page.
  const page = await pageWith(app, '/app/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const info = await page.evaluate(() => window.smaran.app.info());
  expect(info.version).toBe(pkg.version);

  await page.getByLabel('Quick add').fill('Smoke test in 30 min');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Added “Smoke test”', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Notifications' }).click();
  await page.getByRole('button', { name: 'Send a Test Reminder' }).click();
  const card = await pageWith(app, '/notification/');
  await expect(card.getByTestId('notification')).toBeVisible();
  await app.close();
  rmSync(userData, { recursive: true, force: true });
});
