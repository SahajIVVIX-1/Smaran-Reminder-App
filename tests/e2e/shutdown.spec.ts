import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';

test.describe('Graceful Shutdown & Background Tray Lifecycle', () => {
  test('closing app window keeps tray icon alive; explicit quit shuts down cleanly', async () => {
    const h = await launchApp({ seed: createTestConfig() });

    // Closing the main window keeps the application ready in tray
    await h.page.close();
    expect(await h.app.evaluate(({ app }) => app.isReady())).toBe(true);

    // Explicitly quit the application
    await h.app.evaluate(({ app }) => app.quit());

    // Wait for the app process to terminate
    await expect.poll(async () => {
      try {
        return await h.app.evaluate(({ app }) => app.isReady());
      } catch {
        return 'terminated';
      }
    }).toBe('terminated');

    await h.close();
  });
});
