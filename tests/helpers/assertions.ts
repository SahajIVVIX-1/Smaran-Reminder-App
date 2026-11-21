import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Asserts that the document has no unexpected horizontal overflow or scrollbar.
 */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth;
  });
  expect(hasOverflow, 'Expected page to have no horizontal overflow').toBe(false);
}

/**
 * Asserts that a modal or dialog fits fully within the visible window viewport.
 */
export async function assertFitsInViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'Expected element to have bounding box').not.toBeNull();
  if (!box) return;

  const viewport = await locator.page().viewportSize();
  if (viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 5);
  }
}

/**
 * Asserts that a button is visible, enabled, and ready for user interaction.
 */
export async function assertInteractive(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
}
