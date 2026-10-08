import { expect, test } from '@playwright/test';
import { launch, seedConfig } from './helpers';

test('run now shows a burst of popups one after another, never two at once', async () => {
  const h = await launch(
    seedConfig((c) => {
      const schedule = c.schedules[0];
      if (schedule) schedule.burst = { count: 2, gapMs: 300, overlap: 'skip' };
      for (const st of c.styles) st.timing = { fadeInMs: 50, stayMs: 600, fadeOutMs: 50 };
    }),
  );
  const s = h.settings;
  await s.getByRole('button', { name: 'Schedules' }).click();

  const counts: number[] = [];
  let popupsSeen = 0;
  h.app.on('window', () => popupsSeen++);
  await s.getByRole('button', { name: 'Run now' }).click();

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && popupsSeen < 2) {
    counts.push(
      await h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length - 1),
    );
    await new Promise((r) => setTimeout(r, 100));
  }
  expect(popupsSeen).toBe(2);
  expect(Math.max(...counts)).toBeLessThanOrEqual(1);
  await expect
    .poll(() => h.readConfig().runtime[h.readConfig().schedules[0]?.id ?? '']?.lastMessageId)
    .not.toBeNull();
  await h.close();
});

test('pausing from the app page closes popups and shows the status', async () => {
  const h = await launch(seedConfig());
  const s = h.settings;
  await s.getByRole('button', { name: 'App', exact: true }).click();
  await s.getByRole('button', { name: 'Pause 30 min' }).click();
  await expect(s.getByText(/Paused until \d\d:\d\d/)).toBeVisible();
  // Pausing must not make the settings draft dirty.
  await expect(s.getByTestId('save-state')).toHaveText('All changes saved');
  await s.getByRole('button', { name: 'Resume' }).click();
  await expect(s.getByText('Running')).toBeVisible();
  await s.screenshot({ path: 'test-results/screens/app.png' });
  await h.close();
});
