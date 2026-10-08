import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import electronPath from 'electron';

// Each test gets its own data folder so it never touches the real %APPDATA%\Smaran.
let userData: string;
test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'smaran-e2e-'));
});
test.afterEach(() => {
  rmSync(userData, { recursive: true, force: true });
});

const launch = () => electron.launch({ args: ['.', `--user-data-dir=${userData}`] });

test('opens the settings window with the first-run config', async () => {
  const app = await launch();
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('Smaran Settings');
  await expect(win.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(win.getByTestId('config-summary')).toHaveText('1 message · 1 style · 1 schedule');
  expect(existsSync(join(userData, 'config.json'))).toBe(true);
  await app.close();
});

test('a second launch exits and leaves the first one running', async () => {
  const app = await launch();
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('Smaran Settings');

  const second = spawn(electronPath as unknown as string, ['.', `--user-data-dir=${userData}`], {
    stdio: 'ignore',
  });
  const exitCode = await new Promise<number | null>((resolve) => second.on('exit', resolve));
  expect(exitCode).toBe(0);

  expect(app.windows()).toHaveLength(1);
  expect(win.isClosed()).toBe(false);
  await app.close();
});
