import { expect, type Page } from '@playwright/test';

export type AppRoute =
  | 'today'
  | 'reminders'
  | 'automations'
  | 'fileserver'
  | 'remotehub'
  | 'history'
  | 'license'
  | 'settings';

const ROUTE_LABELS: Record<AppRoute, string> = {
  today: 'Today',
  reminders: 'Reminders',
  automations: 'Automations',
  fileserver: 'File Server',
  remotehub: 'Remote Hub',
  history: 'History',
  license: 'License',
  settings: 'Settings',
};

/**
 * Navigates to a specific route via the sidebar navigation buttons.
 */
export async function navigateTo(page: Page, route: AppRoute): Promise<void> {
  const label = ROUTE_LABELS[route];
  const nav = page.getByRole('navigation', { name: 'Main' });
  const btn = nav.getByRole('button', { name: label, exact: true });
  await btn.click();
  await expect(btn).toHaveAttribute('aria-current', 'page');
}

/**
 * Returns the currently active sidebar navigation item's label.
 */
export async function getActiveNav(page: Page): Promise<string> {
  const nav = page.getByRole('navigation', { name: 'Main' });
  const activeBtn = nav.locator('button[aria-current="page"]');
  return (await activeBtn.textContent()) || '';
}

/**
 * Opens the New Reminder editor drawer.
 */
export async function openNewReminder(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New Reminder', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'New Reminder' })).toBeVisible();
}

/**
 * Waits for a toast message to appear and optionally asserts matching text.
 */
export async function waitForToast(page: Page, textSnippet?: string): Promise<void> {
  const toast = page.getByRole('status');
  await expect(toast).toBeVisible();
  if (textSnippet) {
    await expect(toast).toContainText(textSnippet);
  }
}
