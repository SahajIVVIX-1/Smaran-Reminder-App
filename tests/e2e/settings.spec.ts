import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';
import { assertNoHorizontalOverflow } from '../helpers/assertions';

test.describe('Application Settings', () => {
  test('switches themes between Light and Dark mode', async () => {
    const h = await launchApp({
      seed: createTestConfig((c) => {
        c.settings.theme = 'light';
      }),
    });
    const p = h.page;

    await navigateTo(p, 'settings');

    // System tab is active by default
    const darkBtn = p.getByRole('radio', { name: 'Dark' });
    await expect(darkBtn).toBeVisible();
    await darkBtn.click();

    await expect(p.locator('html')).toHaveClass(/dark/);
    await expect.poll(() => h.readConfig().settings.theme).toBe('dark');

    const lightBtn = p.getByRole('radio', { name: 'Light' });
    await lightBtn.click();
    await expect(p.locator('html')).not.toHaveClass(/dark/);
    await expect.poll(() => h.readConfig().settings.theme).toBe('light');

    await h.close();
  });

  test('configures reminder notification corner and quiet hours', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    await navigateTo(p, 'settings');

    // Switch to Reminders settings tab
    const remindersTab = p.getByRole('tab', { name: 'Reminders' });
    await remindersTab.click();
    await expect(remindersTab).toHaveAttribute('aria-selected', 'true');

    // Select Top left corner
    const topLeftCorner = p.getByRole('radio', { name: 'Top left' });
    await topLeftCorner.click();
    await expect.poll(() => h.readConfig().settings.notification.corner).toBe('top-left');

    // Toggle Quiet hours switch
    const quietSwitch = p.getByRole('switch', { name: 'Quiet hours' });
    await quietSwitch.click();
    await expect.poll(() => h.readConfig().settings.quietHours.enabled).toBe(true);

    await assertNoHorizontalOverflow(p);

    await h.close();
  });
});
