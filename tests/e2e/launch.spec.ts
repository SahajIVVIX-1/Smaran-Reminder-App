import { spawn } from 'node:child_process';
import { _electron as electron, expect, test } from '@playwright/test';
import electronPath from 'electron';

test('opens the settings window', async () => {
  const app = await electron.launch({ args: ['.'] });
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('Smaran Settings');
  await expect(win.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await app.close();
});

test('a second launch exits and leaves the first one running', async () => {
  const app = await electron.launch({ args: ['.'] });
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('Smaran Settings');

  const second = spawn(electronPath as unknown as string, ['.'], { stdio: 'ignore' });
  const exitCode = await new Promise<number | null>((resolve) => second.on('exit', resolve));
  expect(exitCode).toBe(0);

  expect(app.windows()).toHaveLength(1);
  expect(win.isClosed()).toBe(false);
  await app.close();
});
