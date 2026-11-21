import { expect, test } from '@playwright/test';
import { launchApp } from '../helpers/app-launcher';
import { createTestConfig } from '../fixtures/test-data';
import { navigateTo } from '../helpers/navigation';
import { assertNoHorizontalOverflow } from '../helpers/assertions';

test.describe('Automations System', () => {
  test('navigates to automations and opens automation editor', async () => {
    const h = await launchApp({ seed: createTestConfig() });
    const p = h.page;

    await navigateTo(p, 'automations');

    const newBtn = p.getByRole('button', { name: 'New Automation' });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Editor dialog opens
    const editorDialog = p.getByRole('dialog', { name: 'New Automation' });
    await expect(editorDialog).toBeVisible();

    const nameInput = editorDialog.getByLabel('Name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Nightly Clean');

    // Close dialog
    const closeBtn = editorDialog.getByRole('button', { name: 'Close panel' });
    await closeBtn.click();
    await expect(editorDialog).toHaveCount(0);

    await assertNoHorizontalOverflow(p);

    await h.close();
  });
});
