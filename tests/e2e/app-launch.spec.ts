import { expect, test } from '@playwright/test';
import electronPath from 'electron';
import { spawn } from 'node:child_process';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { assertNoHorizontalOverflow } from '../helpers/assertions';

test.describe('Application Launch & Lifecycle', () => {
  test('first launch without existing config displays welcome onboarding dialog', async () => {
    const h = await launchApp({ seed: null });
    const p = h.page;

    const welcomeDialog = p.getByRole('dialog', { name: 'Welcome to Smaran' });
    await expect(welcomeDialog).toBeVisible();

    const startBtn = p.getByRole('button', { name: 'Get Started' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    await expect(p.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => h.readConfig().settings.onboarded).toBe(true);

    await h.close();
  });

  test('app launches with title and correct window layout', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    // Window title is Smaran
    await expect(p).toHaveTitle(/Smaran/);

    // Sidebar navigation is visible
    const nav = p.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();

    // No horizontal scrollbar
    await assertNoHorizontalOverflow(p);

    await h.close();
  });

  test('second launch exits cleanly and respects single-instance mutex', async () => {
    const h = await launchApp({ seed: createTestConfig() });

    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;

    const second = spawn(electronPath as unknown as string, ['.', `--user-data-dir=${h.userData}`], {
      stdio: 'ignore',
      env,
    });

    const exitCode = await new Promise<number | null>((resolve) => second.on('exit', resolve));
    expect(exitCode).toBe(0);

    // Primary instance remains alive and operational
    expect(h.app.windows().filter((w) => w.url().includes('/app/'))).toHaveLength(1);

    await h.close();
  });
});
