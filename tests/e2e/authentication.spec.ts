import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';

test.describe('File Server Authentication & Credential Security', () => {
  test('configures admin credentials and validates save status', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    await navigateTo(p, 'fileserver');

    // Administrator credentials inputs by id
    const usernameInput = p.locator('#set-admin-username');
    const passwordInput = p.locator('input[type="password"]');
    const saveCredBtn = p.getByRole('button', { name: /Save & Sync/i });

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(saveCredBtn).toBeVisible();

    await usernameInput.fill('admin_test');
    await passwordInput.fill('SecurePass123!');
    await saveCredBtn.click();

    // Verify feedback message
    await expect(p.getByText(/Admin credentials synchronized successfully/i)).toBeVisible();

    // Verify credentials via IPC bridge (returns safe credential metadata without exposing plaintext password)
    const credInfo = await p.evaluate(() => window.smaran.fileserver.getAdminCredentials());
    expect(credInfo.username).toBe('admin_test');
    expect(credInfo.hasPassword).toBe(true);
    expect((credInfo as Record<string, unknown>).password).toBeUndefined();

    await h.close();
  });
});
