import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { seedConfig } from '../e2e/helpers';
import pkg from '../../package.json';

// Runs against the packaged app in release/<version>/win-unpacked (build:win first).
const exe = join(__dirname, '..', '..', 'release', pkg.version, 'win-unpacked', 'Smaran.exe');

test('packaged app opens settings, lists fonts and shows a popup', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'smaran-smoke-'));
  writeFileSync(join(userData, 'config.json'), JSON.stringify(seedConfig()));
  const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`] });
  const settings = await app.firstWindow();
  await expect(settings).toHaveTitle('Smaran Settings');
  const fonts = await settings.evaluate(() => window.smaran.fonts.list());
  expect(fonts.length).toBeGreaterThan(5);
  expect(fonts).toContain('Segoe UI');
  const info = await settings.evaluate(() => window.smaran.app.info());
  expect(info.version).toBe(pkg.version);
  await settings.getByRole('button', { name: 'Test' }).click();
  const popup = await app.waitForEvent('window');
  await expect(popup.getByTestId('popup-card')).toBeVisible();
  await app.close();
  rmSync(userData, { recursive: true, force: true });
});
