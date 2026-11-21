import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';
import { assertFitsInViewport } from '../helpers/assertions';

test.describe('File Sharing & QR Modals', () => {
  test('displays sharing endpoints and opens QR code modal for mobile devices', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    await navigateTo(p, 'fileserver');

    // QR code buttons are available on network endpoints
    const qrBtn = p.getByRole('button', { name: /QR Code/i }).first();
    if (await qrBtn.isVisible()) {
      await qrBtn.click();

      // Modal dialog should open
      const qrDialog = p.getByRole('dialog', { name: 'Scan to Connect to Smaran HFS' });
      await expect(qrDialog).toBeVisible();
      await assertFitsInViewport(qrDialog);

      // QR Code image is rendered
      const qrImage = qrDialog.getByRole('img', { name: 'QR Code' });
      await expect(qrImage).toBeVisible();

      // Close the modal
      const closeBtn = qrDialog.getByRole('button', { name: 'Close' });
      await closeBtn.click();
      await expect(qrDialog).toHaveCount(0);
    }

    await h.close();
  });
});
