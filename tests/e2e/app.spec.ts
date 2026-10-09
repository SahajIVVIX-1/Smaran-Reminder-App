import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, test } from '@playwright/test';
import electronPath from 'electron';
import { launch, nextNotification, seedConfig } from './helpers';

test('first run: welcome, then it is remembered', async () => {
  const h = await launch(null);
  const p = h.page;
  await expect(p.getByRole('dialog', { name: 'Welcome to Smaran' })).toBeVisible();
  await p.getByRole('button', { name: 'Get started' }).click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => h.readConfig().settings.onboarded).toBe(true);
  await h.close();
});

test('a second launch exits and leaves the first one running; closing keeps it in the tray', async () => {
  const h = await launch(seedConfig());
  const second = spawn(electronPath as unknown as string, ['.', `--user-data-dir=${h.userData}`], {
    stdio: 'ignore',
  });
  const code = await new Promise<number | null>((resolve) => second.on('exit', resolve));
  expect(code).toBe(0);
  expect(h.app.windows()).toHaveLength(1);
  await h.page.close();
  expect(await h.app.evaluate(({ app }) => app.isReady())).toBe(true);
  await h.close();
});

test('quick add understands plain phrases', async () => {
  const h = await launch(seedConfig());
  const p = h.page;
  const input = p.getByLabel('Quick add');
  await input.fill('Call mom every weekday at 6pm');
  await expect(p.getByTestId('quick-preview')).toContainText(
    'Call mom · Weekly on Mon–Fri at 18:00',
  );
  await input.press('Enter');
  await expect.poll(() => h.readConfig().reminders.map((r) => r.title)).toContain('Call mom');
  const saved = h.readConfig().reminders.find((r) => r.title === 'Call mom');
  expect(saved?.rule).toEqual({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5], time: '18:00' });
  await h.close();
});

test('create, edit and delete (with undo) a reminder', async () => {
  const h = await launch(seedConfig());
  const p = h.page;
  await p.getByRole('button', { name: 'Reminders', exact: true }).click();
  await p.getByRole('button', { name: 'New reminder' }).last().click();
  await p.getByLabel('Title').fill('Water the plants');
  await p.getByRole('radio', { name: 'Weekly' }).click();
  await p.getByRole('radio', { name: 'Important' }).click();
  await p.getByRole('button', { name: 'Create reminder' }).click();
  await expect
    .poll(() => h.readConfig().reminders.find((r) => r.title === 'Water the plants')?.priority)
    .toBe('important');

  // Edits save by themselves.
  await p.getByRole('list', { name: 'Reminders' }).getByText('Water the plants').click();
  await p.getByLabel('Note').fill('Balcony first');
  await expect
    .poll(() => h.readConfig().reminders.find((r) => r.title === 'Water the plants')?.note)
    .toBe('Balcony first');

  await p.getByRole('button', { name: 'Delete' }).click();
  await expect
    .poll(() => h.readConfig().reminders.some((r) => r.title === 'Water the plants'))
    .toBe(false);
  await p.getByRole('button', { name: 'Undo' }).click();
  await expect
    .poll(() => h.readConfig().reminders.some((r) => r.title === 'Water the plants'))
    .toBe(true);
  await h.close();
});

test('settings save as you change them', async () => {
  const h = await launch(seedConfig());
  const p = h.page;
  await p.getByRole('button', { name: 'Settings' }).click();
  await p.getByRole('radio', { name: 'Top left' }).click();
  await p.getByRole('switch', { name: 'Quiet hours' }).click();
  await p.getByRole('radio', { name: 'Dark' }).click();
  await expect.poll(() => h.readConfig().settings.notification.corner).toBe('top-left');
  await expect.poll(() => h.readConfig().settings.quietHours.enabled).toBe(true);
  await expect(p.locator('html')).toHaveClass(/dark/);
  await h.close();
});

test('a reminder card never takes focus; Done is recorded in History', async () => {
  const h = await launch(seedConfig());
  const p = h.page;
  const id = h.readConfig().reminders[0]!.id;
  const pending = nextNotification(h);
  await p.evaluate((rid) => window.smaran.reminders.showNow(rid), id);
  const card = await pending;
  await expect(card.getByTestId('notification-title')).toHaveText('Drink some water');
  await expect
    .poll(() =>
      h.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map((w) => ({
          focusable: w.isFocusable(),
          focused: w.isFocused(),
          onTop: w.isAlwaysOnTop(),
          visible: w.isVisible(),
        })),
      ),
    )
    .toContainEqual({ focusable: false, focused: false, onTop: true, visible: true });

  // The card shows just the title until the pointer is over it.
  await expect(card.getByTestId('notification-pill')).toHaveText('Drink some water');
  await card.getByTestId('notification').hover();
  await expect(card.getByTestId('notification')).toHaveAttribute('data-expanded', 'true');
  await card.getByRole('button', { name: 'Done' }).click();
  await card.waitForEvent('close');
  await p.getByRole('button', { name: 'History' }).click();
  await expect(p.getByText('Drink some water')).toBeVisible();
  await expect(p.getByText('Done', { exact: true }).last()).toBeVisible();
  await h.close();
});

test('snoozing from the card schedules it again', async () => {
  const h = await launch(seedConfig());
  const id = h.readConfig().reminders[0]!.id;
  const pending = nextNotification(h);
  await h.page.evaluate((rid) => window.smaran.reminders.showNow(rid), id);
  const card = await pending;
  await card.getByTestId('notification').hover();
  await card.getByRole('button', { name: 'Snooze' }).click();
  await card.getByRole('button', { name: '15 min' }).click();
  await expect.poll(() => h.readConfig().state[id]?.snoozedUntil).not.toBeNull();
  await h.page.getByRole('button', { name: 'Today' }).click();
  await expect(h.page.getByRole('heading', { name: 'Snoozed' })).toBeVisible();
  await h.close();
});

test('several cards stack in the corner without overlapping', async () => {
  const h = await launch(seedConfig());
  const [a, b] = h.readConfig().reminders;
  await h.page.evaluate(
    (ids) => Promise.all(ids.map((rid) => window.smaran.reminders.showNow(rid))),
    [a!.id, b!.id],
  );
  await expect
    .poll(() =>
      h.app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().filter((w) => w.isVisible() && !w.isFocusable()).length,
      ),
    )
    .toBe(2);
  const bounds = await h.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter((w) => !w.isFocusable())
      .map((w) => w.getBounds()),
  );
  const [first, second] = bounds;
  expect(first!.x).toBe(second!.x);
  expect(Math.abs(first!.y - second!.y)).toBeGreaterThanOrEqual(first!.height - 40);
  await h.close();
});

test('a Smaran 2.0 config is upgraded to reminders on first start', async () => {
  const old = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'v2.0', 'config.json'), 'utf8'),
  );
  const h = await launch(old);
  await h.page.getByRole('button', { name: 'Reminders', exact: true }).click();
  const list = h.page.getByRole('list', { name: 'Reminders' });
  await expect(list.getByText('Every hour', { exact: true })).toBeVisible(); // two messages → rotating lines
  await expect(list.getByText('Drink a glass of water')).toBeVisible();
  expect(h.readConfig().version).toBe(3);
  await h.close();
});

test('added font files are listed and served to the pages', async () => {
  const font = 'C:/Windows/Fonts/segoeuib.ttf';
  test.skip(!existsSync(font), 'needs a Windows font file');
  const h = await launch(seedConfig());
  const dir = join(h.userData, 'fonts');
  mkdirSync(dir, { recursive: true });
  copyFileSync(font, join(dir, 'segoeuib.ttf'));
  const catalog = await h.page.evaluate(() => window.smaran.fonts.list());
  expect(catalog.custom).toContainEqual(
    expect.objectContaining({
      family: 'Segoe UI',
      weight: 700,
      url: 'smaran-font://f/segoeuib.ttf',
    }),
  );
  expect(catalog.system.length).toBeGreaterThan(10);
  // Loaded the way the page uses it (font-src), not via fetch.
  const loaded = await h.page.evaluate(async () => {
    const face = await new FontFace('Added', 'url(smaran-font://f/segoeuib.ttf)').load();
    return face.status;
  });
  expect(loaded).toBe('loaded');
  await h.close();
});
