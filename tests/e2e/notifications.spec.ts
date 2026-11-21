import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig, mockReminder } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';

test.describe('Notification Cards & Stacking', () => {
  test('reminder notification card appears, stays on top, expands on hover and Done records to history', async () => {
    const reminder = mockReminder({ title: 'Stretch and relax' });
    const h = await launchApp({
      seed: createTestConfig((c) => {
        c.reminders = [reminder];
      }),
    });
    const p = h.page;

    const pendingWin = h.nextNotification();
    await p.evaluate((rid) => window.smaran.reminders.showNow(rid), reminder.id);
    const card = await pendingWin;

    // Card should be always on top and non-focusable
    await expect
      .poll(() =>
        h.app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().map((w) => ({
            focusable: w.isFocusable(),
            onTop: w.isAlwaysOnTop(),
            visible: w.isVisible(),
          })),
        ),
      )
      .toContainEqual({ focusable: false, onTop: true, visible: true });

    // Displays title in compact pill
    await expect(card.getByTestId('notification-pill')).toHaveText('Stretch and relax');

    // Hover over card to expand actions
    await card.getByTestId('notification').hover();
    await expect(card.getByTestId('notification')).toHaveAttribute('data-expanded', 'true');

    // Click Done to finish reminder
    const doneBtn = card.getByRole('button', { name: 'Done' });
    await expect(doneBtn).toBeVisible();
    await doneBtn.click({ force: true });

    // Window closes
    await card.waitForEvent('close');

    // Navigate to History to verify event
    await navigateTo(p, 'history');
    await expect(p.getByText('Stretch and relax').first()).toBeVisible();
    await expect(p.getByText('Done', { exact: true }).last()).toBeVisible();

    await h.close();
  });

  test('multiple concurrent notification cards stack in the corner without overlap', async () => {
    const r1 = mockReminder({ title: 'Task A' });
    const r2 = mockReminder({ title: 'Task B' });
    const h = await launchApp({
      seed: createTestConfig((c) => {
        c.settings.notification.hideAfterSec = 30;
        c.reminders = [r1, r2];
      }),
    });
    const p = h.page;

    await p.evaluate(
      (ids) => Promise.all(ids.map((id) => window.smaran.reminders.showNow(id))),
      [r1.id, r2.id],
    );

    // Wait for 2 visible notification windows
    await expect
      .poll(() =>
        h.app.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().filter(
              (w) =>
                w.isVisible() &&
                !w.isFocusable() &&
                w.webContents.getURL().includes('/notification/'),
            ).length,
        ),
      )
      .toBe(2);

    const bounds = () =>
      h.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .filter(
            (w) =>
              w.isVisible() &&
              !w.isFocusable() &&
              w.webContents.getURL().includes('/notification/'),
          )
          .map((w) => w.getBounds()),
      );

    const verticalDistance = async () => {
      const [w1, w2] = await bounds();
      return Math.abs(w1!.y - w2!.y);
    };

    // Cards should settle with a distinct vertical gap
    await expect.poll(verticalDistance).toBeGreaterThanOrEqual(30);

    const [first, second] = await bounds();
    expect(first!.x).toBe(second!.x);

    await h.close();
  });
});
