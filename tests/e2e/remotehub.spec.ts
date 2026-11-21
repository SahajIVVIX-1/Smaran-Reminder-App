import { expect, test } from '@playwright/test';
import http from 'node:http';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { navigateTo, getActiveNav } from '../helpers/navigation';
import { assertNoHorizontalOverflow } from '../helpers/assertions';

function pingHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
  });
}

test.describe('Smaran Remote Hub Lifecycle & Navigation E2E', () => {
  test('navigates to remote hub, verifies dashboard metrics and controls server lifecycle', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    // Navigate to Remote Hub
    await navigateTo(p, 'remotehub');
    expect(await getActiveNav(p)).toBe('Remote Hub');

    // Canonical header and start/stop controls exist
    await expect(p.getByRole('heading', { name: 'Remote Hub', exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(p);

    // If first-run administrator setup modal appears, initialize the administrator
    const adminDialog = p.getByRole('dialog', { name: 'Initialize Remote Hub Administrator' });
    if (await adminDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await adminDialog.getByPlaceholder('admin').fill('admin');
      await adminDialog.getByPlaceholder('••••••••').fill('AdministratorPassword123!');
      await adminDialog.getByRole('button', { name: /Initialize Administrator/i }).click();
      await expect(adminDialog).toBeHidden({ timeout: 5000 });
    }

    const startBtn = p.getByRole('button', { name: /Start Server/i });
    const stopBtn = p.getByRole('button', { name: /Stop Server/i });

    // Verify initial stopped state or manage transition
    const isStopped = await startBtn.isVisible();

    if (isStopped) {
      await startBtn.click();
      // Server transitions to running
      await expect(stopBtn).toBeVisible({ timeout: 15_000 });

      // Check HTTP health endpoint on port 5902
      const healthy = await pingHealth(5902);
      expect(healthy).toBe(true);

      // Verify dashboard cards exist directly on the page (mirroring FileServer copy-paste layout)
      await expect(p.getByText('Active Screen & Window Broadcasts')).toBeVisible();
      await expect(p.getByText('Registered Devices & Sharing Agents')).toBeVisible();
      await expect(p.getByText('User Accounts & Access Control')).toBeVisible();

      // Stop the server
      await stopBtn.click();
      await expect(startBtn).toBeVisible({ timeout: 15_000 });
    } else {
      // Already running: test health, stop, and start
      const healthy = await pingHealth(5902);
      expect(healthy).toBe(true);

      await stopBtn.click();
      await expect(startBtn).toBeVisible({ timeout: 15_000 });

      await startBtn.click();
      await expect(stopBtn).toBeVisible({ timeout: 15_000 });
    }

    await h.close();
  });
});
