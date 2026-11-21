import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig, mockReminder } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';

test.describe('Reminder Management', () => {
  test('creates, edits, deletes and undoes deletion of a reminder', async () => {
    const initialReminder = mockReminder({ title: 'Read a book', note: 'Chapter 4' });
    const h = await launchApp({
      seed: createTestConfig((c) => {
        c.reminders = [initialReminder];
      }),
    });
    const p = h.page;

    await navigateTo(p, 'reminders');

    // Verify initial reminder appears in list
    const remindersList = p.getByRole('list', { name: 'Reminders' });
    await expect(remindersList.getByText('Read a book')).toBeVisible();

    // Click to edit
    await remindersList.getByText('Read a book').click();
    const noteField = p.getByLabel('Note');
    await noteField.fill('Chapter 5 and summary');

    // Auto-save check in config
    await expect
      .poll(() => h.readConfig().reminders.find((r) => r.id === initialReminder.id)?.note)
      .toBe('Chapter 5 and summary');

    // Delete the reminder
    const deleteBtn = p.getByRole('button', { name: 'Delete' });
    await deleteBtn.click();

    // Verify deletion in config
    await expect
      .poll(() => h.readConfig().reminders.some((r) => r.id === initialReminder.id))
      .toBe(false);

    // Verify undo toast appears and click Undo
    const undoBtn = p.getByRole('button', { name: 'Undo' });
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    // Reminder is restored in config and UI
    await expect
      .poll(() => h.readConfig().reminders.some((r) => r.id === initialReminder.id))
      .toBe(true);
    await expect(remindersList.getByText('Read a book')).toBeVisible();

    await h.close();
  });
});
