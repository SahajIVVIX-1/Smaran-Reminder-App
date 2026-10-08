import type { Placement } from '@shared/schema';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  bounds: Rect;
  workArea: Rect;
}

export interface Size {
  width: number;
  height: number;
}

export interface PlacementContext {
  displays: readonly DisplayInfo[];
  primaryId: number;
  cursor: { x: number; y: number };
}

export type AnchorPlacement = Extract<Placement, { kind: 'anchor' }>;

export const DEFAULT_ANCHOR: AnchorPlacement = {
  kind: 'anchor',
  anchor: 'top-center',
  offsetX: 0,
  offsetY: 24,
  display: 'primary',
};

/**
 * Screen position (top-left, DIP) for a popup of `size`.
 * An exact spot on a display that no longer exists falls back to `fallback` (the style's anchor).
 * The result is always clamped inside the chosen display's work area.
 */
export function resolvePlacement(
  placement: Placement,
  fallback: Placement,
  size: Size,
  ctx: PlacementContext,
): { x: number; y: number; displayId: number } {
  if (placement.kind === 'exact') {
    const display = ctx.displays.find((d) => d.id === placement.displayId);
    if (display) {
      const wa = display.workArea;
      return clampInto(wa, size, wa.x + placement.x, wa.y + placement.y, display.id);
    }
    return resolvePlacement(
      fallback.kind === 'anchor' ? fallback : DEFAULT_ANCHOR,
      DEFAULT_ANCHOR,
      size,
      ctx,
    );
  }

  const display = pickDisplay(placement.display, ctx);
  const wa = display.workArea;
  const [vertical, horizontal = 'center'] =
    placement.anchor === 'center' ? ['center', 'center'] : placement.anchor.split('-');

  const x =
    horizontal === 'left'
      ? wa.x + placement.offsetX
      : horizontal === 'right'
        ? wa.x + wa.width - size.width - placement.offsetX
        : wa.x + (wa.width - size.width) / 2 + placement.offsetX;
  const y =
    vertical === 'top'
      ? wa.y + placement.offsetY
      : vertical === 'bottom'
        ? wa.y + wa.height - size.height - placement.offsetY
        : wa.y + (wa.height - size.height) / 2 + placement.offsetY;

  return clampInto(wa, size, x, y, display.id);
}

function pickDisplay(which: 'primary' | 'cursor', ctx: PlacementContext): DisplayInfo {
  const primary = ctx.displays.find((d) => d.id === ctx.primaryId) ?? ctx.displays[0];
  if (!primary) throw new Error('No displays are available.');
  if (which === 'primary') return primary;
  const { x, y } = ctx.cursor;
  return (
    ctx.displays.find(
      (d) =>
        x >= d.bounds.x &&
        x < d.bounds.x + d.bounds.width &&
        y >= d.bounds.y &&
        y < d.bounds.y + d.bounds.height,
    ) ?? primary
  );
}

function clampInto(
  wa: Rect,
  size: Size,
  x: number,
  y: number,
  displayId: number,
): { x: number; y: number; displayId: number } {
  const maxX = wa.x + Math.max(0, wa.width - size.width);
  const maxY = wa.y + Math.max(0, wa.height - size.height);
  return {
    x: Math.round(Math.min(Math.max(x, wa.x), maxX)),
    y: Math.round(Math.min(Math.max(y, wa.y), maxY)),
    displayId,
  };
}

/** Converts a popup's screen position into an exact placement relative to its display's work area. */
export function toExactPlacement(
  windowBounds: Rect,
  display: DisplayInfo,
): Extract<Placement, { kind: 'exact' }> {
  return {
    kind: 'exact',
    displayId: display.id,
    x: Math.round(windowBounds.x - display.workArea.x),
    y: Math.round(windowBounds.y - display.workArea.y),
  };
}
