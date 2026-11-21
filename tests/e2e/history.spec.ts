import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig, mockHistoryEntry } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';
import { assertNoHorizontalOverflow } from '../helpers/assertions';

test.describe('History Audit Trail', () => {
  test('displays persisted history events and recovers history after restart', async () => {
    const entry = mockHistoryEntry({
      title: 'Morning Meditation',
      outcome: 'done',
    });

    const h1 = await launchApp({
      seed: createTestConfig(),
      history: [entry],
    });
    const p1 = h1.page;

    await navigateTo(p1, 'history');
    await expect(p1.getByText('Morning Meditation')).toBeVisible();
    await expect(p1.getByText('Done', { exact: true })).toBeVisible();

    await assertNoHorizontalOverflow(p1);
    const savedUserData = h1.userData;
    await h1.app.close();

    // Relaunch app pointing to the existing userData folder to test persistence
    const h2 = await launchApp({
      extraArgs: [`--user-data-dir=${savedUserData}`],
    });
    const p2 = h2.page;

    await navigateTo(p2, 'history');
    await expect(p2.getByText('Morning Meditation')).toBeVisible();

    await h2.close();
  });
});
