import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { navigateTo, getActiveNav } from '../helpers/navigation';
import { assertNoHorizontalOverflow } from '../helpers/assertions';

test.describe('Navigation & Sidebar Routing', () => {
  test('navigates seamlessly across all primary views with active indicators', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    // Default route is Today
    expect(await getActiveNav(p)).toBe('Today');
    await assertNoHorizontalOverflow(p);

    // Navigate to Reminders
    await navigateTo(p, 'reminders');
    expect(await getActiveNav(p)).toBe('Reminders');
    await expect(p.getByLabel('Search reminders')).toBeVisible();
    await assertNoHorizontalOverflow(p);

    // Navigate to Automations
    await navigateTo(p, 'automations');
    expect(await getActiveNav(p)).toBe('Automations');
    await assertNoHorizontalOverflow(p);

    // Navigate to File Server
    await navigateTo(p, 'fileserver');
    expect(await getActiveNav(p)).toBe('File Server');
    await assertNoHorizontalOverflow(p);

    // Navigate to Remote Hub
    await navigateTo(p, 'remotehub');
    expect(await getActiveNav(p)).toBe('Remote Hub');
    await assertNoHorizontalOverflow(p);

    // Navigate to History
    await navigateTo(p, 'history');
    expect(await getActiveNav(p)).toBe('History');
    await assertNoHorizontalOverflow(p);

    // Navigate to Settings
    await navigateTo(p, 'settings');
    expect(await getActiveNav(p)).toBe('Settings');
    await assertNoHorizontalOverflow(p);

    // Return to Today
    await navigateTo(p, 'today');
    expect(await getActiveNav(p)).toBe('Today');

    await h.close();
  });
});
