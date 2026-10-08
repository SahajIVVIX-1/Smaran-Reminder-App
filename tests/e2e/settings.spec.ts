import { expect, test } from '@playwright/test';
import { launch, seedConfig, waitForPopup } from './helpers';

test('add a message, see the dirty dot, save with Ctrl+S', async () => {
  const h = await launch(seedConfig());
  const s = h.settings;
  await expect(s.getByTestId('save-state')).toHaveText('All changes saved');

  await s.getByRole('button', { name: 'New', exact: true }).click();
  const text = s.getByRole('textbox', { name: 'Message text' });
  await text.fill('Drink a glass of water');
  await s.getByLabel('Tags').fill('health, water');
  await expect(s.getByTestId('save-state')).toHaveText('Unsaved changes');

  await s.keyboard.press('Control+s');
  await expect(s.getByTestId('save-state')).toHaveText('All changes saved');
  const saved = h.readConfig().messages.find((m) => m.text === 'Drink a glass of water');
  expect(saved?.tags).toEqual(['health', 'water']);
  await s.screenshot({ path: 'test-results/screens/messages.png' });
  await h.close();
});

test('delete a message and undo it', async () => {
  const h = await launch(seedConfig());
  const s = h.settings;
  const first = h.readConfig().messages[0]?.text ?? '';
  await s.getByRole('button', { name: 'Delete' }).click();
  await expect(s.getByRole('listbox', { name: 'Messages' }).getByText(first)).toHaveCount(0);
  await s.getByRole('button', { name: 'Undo' }).click();
  await expect(s.getByRole('listbox', { name: 'Messages' }).getByText(first)).toHaveCount(1);
  await expect(s.getByTestId('save-state')).toHaveText('All changes saved');
  await h.close();
});

test('override a field for one message and reset it', async () => {
  const h = await launch(seedConfig());
  const s = h.settings;
  await s
    .getByLabel('Change a field for this message only')
    .selectOption({ label: 'Text: Font size' });
  const size = s.locator('#override-font-sizePx');
  await expect(size).toHaveValue('22');
  await size.fill('40');
  await size.blur();
  await s.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => h.readConfig().messages[0]?.overrides.font?.sizePx).toBe(40);

  await s.getByRole('button', { name: 'Reset' }).first().click();
  await s.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => h.readConfig().messages[0]?.overrides).toEqual({});
  await h.close();
});

test('styles page edits a preset with live preview', async () => {
  const h = await launch(seedConfig());
  const s = h.settings;
  await s.getByRole('button', { name: 'Styles' }).click();
  await s.locator('#style-font-sizePx').fill('30');
  await s.locator('#style-font-sizePx').blur();
  await expect(s.getByLabel('Preview').locator('div div')).toHaveCSS('font-size', '30px');
  await s.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => h.readConfig().styles[0]?.font.sizePx).toBe(30);
  await s.screenshot({ path: 'test-results/screens/styles.png' });
  await h.close();
});

test('schedules page builds a rule and shows the next time', async () => {
  const h = await launch(seedConfig());
  const s = h.settings;
  await s.getByRole('button', { name: 'Schedules' }).click();
  await s.getByRole('button', { name: 'New', exact: true }).click();
  await s.getByLabel('Name').fill('Weekday mornings');
  await s.getByLabel('Repeat').selectOption('weekly');
  await s.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(() => h.readConfig().schedules.map((x) => x.name))
    .toContain('Weekday mornings');
  const list = s.getByRole('listbox', { name: 'Schedules' });
  await expect(list.getByText('Weekly on Mon–Fri at 09:00')).toBeVisible();
  await expect(list.getByText(/Next: /).first()).toBeVisible();
  await s.screenshot({ path: 'test-results/screens/schedules.png' });
  await h.close();
});

test('test popup shows without taking focus, then closes itself', async () => {
  const h = await launch(seedConfig());
  const s = h.settings;
  await s.getByRole('button', { name: 'Test' }).click();
  const popup = await waitForPopup(h);
  await expect(popup.getByTestId('popup-card')).toHaveText('Take a breath and sit up straight.');
  // The popup can never take focus and is not the focused window.
  const windows = () =>
    h.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => ({
        focusable: w.isFocusable(),
        focused: w.isFocused(),
        onTop: w.isAlwaysOnTop(),
        visible: w.isVisible(),
      })),
    );
  await expect
    .poll(windows)
    .toContainEqual({ focusable: false, focused: false, onTop: true, visible: true });
  await popup.waitForEvent('close', { timeout: 10_000 });
  await h.close();
});

test('dragging a popup saves an exact position for that message', async () => {
  const h = await launch(
    seedConfig((c) => {
      for (const st of c.styles) st.timing.stayMs = 8000;
    }),
  );
  const id = h.readConfig().messages[0]?.id ?? '';
  // The Test button previews unsaved text; a saved message's popup is what remembers drags.
  // Resolves when the popup closes; the app is closed first, so ignore that rejection.
  void h.settings
    .evaluate((messageId) => window.smaran.popup.test({ messageId }), id)
    .catch(() => undefined);
  const popup = await waitForPopup(h);
  const card = popup.getByTestId('popup-card');
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  if (!box) throw new Error('no card');
  await popup.mouse.move(box.x + 10, box.y + 10);
  await popup.mouse.down();
  await popup.mouse.move(box.x + 60, box.y + 50, { steps: 5 });
  await popup.mouse.up();

  await expect
    .poll(() => h.readConfig().messages.find((m) => m.id === id)?.overrides.position?.kind)
    .toBe('exact');
  await h.close();
});
