import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import electronPath from 'electron';
import { launch, seedConfig } from './helpers';

test('first run shows the welcome, then saves onboarding', async () => {
  const h = await launch(null);
  const { settings } = h;
  await expect(settings).toHaveTitle('Smaran Settings');
  await expect(settings.getByRole('dialog', { name: 'Welcome to Smaran' })).toBeVisible();
  await settings.getByRole('button', { name: 'Get started' }).click();
  await expect(settings.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => h.readConfig().app.onboarded).toBe(true);
  expect(existsSync(join(h.userData, 'config.json'))).toBe(true);
  await h.close();
});

test('a second launch exits and leaves the first one running', async () => {
  const h = await launch(seedConfig());
  await expect(h.settings).toHaveTitle('Smaran Settings');

  const second = spawn(electronPath as unknown as string, ['.', `--user-data-dir=${h.userData}`], {
    stdio: 'ignore',
  });
  const exitCode = await new Promise<number | null>((resolve) => second.on('exit', resolve));
  expect(exitCode).toBe(0);

  expect(h.app.windows()).toHaveLength(1);
  expect(h.settings.isClosed()).toBe(false);
  await h.close();
});

test('closing settings keeps Smaran running in the tray', async () => {
  const h = await launch(seedConfig());
  await h.settings.close();
  // The app is still alive: it can evaluate in the main process.
  expect(await h.app.evaluate(({ app }) => app.isReady())).toBe(true);
  await h.close();
});
