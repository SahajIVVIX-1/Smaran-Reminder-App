import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';

test.describe('Dashboard & Today View', () => {
  test('displays today timeline, greeting, and parses quick-add natural language', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    await navigateTo(p, 'today');

    // Quick add input exists and is interactive
    const input = p.getByLabel('Quick add');
    await expect(input).toBeVisible();

    await input.fill('Water the orchids every weekday at 10am');
    await expect(p.getByTestId('quick-preview')).toContainText(
      'Water the orchids · Weekly on Mon–Fri at 10:00',
    );

    // Press Enter to add
    await input.press('Enter');

    // Successfully added feedback toast
    await expect(p.getByText('Added “Water the orchids”', { exact: false })).toBeVisible();

    // Verify reminder is persisted in config
    await expect
      .poll(() => h.readConfig().reminders.some((r) => r.title === 'Water the orchids'))
      .toBe(true);

    await h.close();
  });
});
