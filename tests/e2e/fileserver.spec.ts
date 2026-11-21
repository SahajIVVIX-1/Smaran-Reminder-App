import { expect, test } from '@playwright/test';
import http from 'node:http';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';
import { assertNoHorizontalOverflow } from '../helpers/assertions';

function pingHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
  });
}

test.describe('File Server Lifecycle & Health Check', () => {
  test('navigates to file server, verifies controls and manages server lifecycle', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    await navigateTo(p, 'fileserver');

    // Canonical header and start/stop controls exist
    await expect(p.getByRole('heading', { name: 'File Server', exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(p);

    const startBtn = p.getByRole('button', { name: /Start Server/i });
    const stopBtn = p.getByRole('button', { name: /Stop Server/i });

    // Check if stopped or running initially
    const isStopped = await startBtn.isVisible();

    if (isStopped) {
      await startBtn.click();
      // Server transitions to running
      await expect(stopBtn).toBeVisible({ timeout: 35_000 });

      // Check HTTP health endpoint
      const healthy = await pingHealth(5901);
      expect(healthy).toBe(true);

      // Stop the server
      await stopBtn.click();
      await expect(startBtn).toBeVisible({ timeout: 15_000 });
    } else {
      // Already running, test health check then stop and start
      const healthy = await pingHealth(5901);
      expect(healthy).toBe(true);

      await stopBtn.click();
      await expect(startBtn).toBeVisible({ timeout: 15_000 });

      await startBtn.click();
      await expect(stopBtn).toBeVisible({ timeout: 35_000 });
    }

    await h.close();
  });
});
