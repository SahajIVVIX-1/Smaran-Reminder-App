import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANCHOR,
  resolvePlacement,
  toExactPlacement,
  type DisplayInfo,
  type PlacementContext,
} from '../../src/main/windows/placement';
import type { Placement } from '@shared/schema';

// Primary 1920×1080 with a 40 px taskbar; a second screen to its right.
const primary: DisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
};
const second: DisplayInfo = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 1280, height: 1024 },
  workArea: { x: 1920, y: 0, width: 1280, height: 1024 },
};
const ctx: PlacementContext = {
  displays: [primary, second],
  primaryId: 1,
  cursor: { x: 10, y: 10 },
};
const size = { width: 400, height: 100 };

const anchor = (
  a: Extract<Placement, { kind: 'anchor' }>['anchor'],
  offsetX = 10,
  offsetY = 20,
): Placement => ({
  kind: 'anchor',
  anchor: a,
  offsetX,
  offsetY,
  display: 'primary',
});

describe('resolvePlacement anchors', () => {
  it.each([
    ['top-left', 10, 20],
    ['top-center', 770, 20],
    ['top-right', 1510, 20],
    ['center', 770, 490],
    ['bottom-left', 10, 920],
    ['bottom-center', 770, 920],
    ['bottom-right', 1510, 920],
  ] as const)('%s', (a, x, y) => {
    expect(resolvePlacement(anchor(a), DEFAULT_ANCHOR, size, ctx)).toEqual({ x, y, displayId: 1 });
  });

  it('uses the screen under the pointer when asked', () => {
    const p: Placement = { ...DEFAULT_ANCHOR, display: 'cursor' };
    const onSecond = { ...ctx, cursor: { x: 2500, y: 500 } };
    expect(resolvePlacement(p, DEFAULT_ANCHOR, size, onSecond)).toEqual({
      x: 2360,
      y: 24,
      displayId: 2,
    });
    const offScreen = { ...ctx, cursor: { x: -5000, y: 0 } };
    expect(resolvePlacement(p, DEFAULT_ANCHOR, size, offScreen).displayId).toBe(1);
  });

  it('falls back to the first display when the primary id is unknown', () => {
    expect(
      resolvePlacement(DEFAULT_ANCHOR, DEFAULT_ANCHOR, size, { ...ctx, primaryId: 99 }).displayId,
    ).toBe(1);
  });

  it('throws when there are no displays', () => {
    expect(() =>
      resolvePlacement(DEFAULT_ANCHOR, DEFAULT_ANCHOR, size, { ...ctx, displays: [] }),
    ).toThrow();
  });
});

describe('resolvePlacement exact spots', () => {
  it('is relative to that display’s work area, also on a second monitor', () => {
    const p: Placement = { kind: 'exact', displayId: 2, x: 100, y: 50 };
    expect(resolvePlacement(p, DEFAULT_ANCHOR, size, ctx)).toEqual({
      x: 2020,
      y: 50,
      displayId: 2,
    });
  });

  it('is clamped inside the work area', () => {
    const p: Placement = { kind: 'exact', displayId: 1, x: 5000, y: -300 };
    expect(resolvePlacement(p, DEFAULT_ANCHOR, size, ctx)).toEqual({ x: 1520, y: 0, displayId: 1 });
  });

  it('falls back to the style anchor on the primary when the display is gone', () => {
    const p: Placement = { kind: 'exact', displayId: 9, x: 100, y: 50 };
    expect(resolvePlacement(p, anchor('bottom-right'), size, ctx)).toEqual({
      x: 1510,
      y: 920,
      displayId: 1,
    });
    // If the style itself has an exact spot, the default anchor is used.
    expect(resolvePlacement(p, p, size, ctx)).toEqual({ x: 760, y: 24, displayId: 1 });
  });

  it('fits a popup larger than the screen at the work-area origin', () => {
    const big = { width: 5000, height: 5000 };
    expect(resolvePlacement(DEFAULT_ANCHOR, DEFAULT_ANCHOR, big, ctx)).toEqual({
      x: 0,
      y: 0,
      displayId: 1,
    });
  });
});

describe('toExactPlacement', () => {
  it('stores the window position relative to its display', () => {
    expect(toExactPlacement({ x: 2100.4, y: 80, width: 400, height: 100 }, second)).toEqual({
      kind: 'exact',
      displayId: 2,
      x: 180,
      y: 80,
    });
  });
});
