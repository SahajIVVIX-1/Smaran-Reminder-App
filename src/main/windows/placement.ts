import type { Settings } from '@shared/schema';

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

export type Corner = Settings['notification']['corner'];

/**
 * Window spacing (DIP). Card windows touch the top/bottom edge so a card can slide in from
 * beyond the screen edge; the card's own padding inside the window gives the visual margin.
 */
export const EDGE = 0;
export const SIDE = 4;
export const GAP = 0;

/** The display to show notifications on: the primary one, or the one under the pointer. */
export function pickDisplay(
  which: 'primary' | 'cursor',
  displays: readonly DisplayInfo[],
  primaryId: number,
  cursor: { x: number; y: number },
): DisplayInfo {
  const primary = displays.find((d) => d.id === primaryId) ?? displays[0];
  if (!primary) throw new Error('No displays are available.');
  if (which === 'primary') return primary;
  return (
    displays.find(
      (d) =>
        cursor.x >= d.bounds.x &&
        cursor.x < d.bounds.x + d.bounds.width &&
        cursor.y >= d.bounds.y &&
        cursor.y < d.bounds.y + d.bounds.height,
    ) ?? primary
  );
}

/**
 * Top-left positions for a stack of cards in a corner of the work area. `sizes[0]` is the newest
 * card and sits nearest the corner; older ones are pushed away from it. Cards that would not fit
 * on screen get null (they wait until there is room).
 */
export function stackLayout(
  corner: Corner,
  workArea: Rect,
  sizes: readonly Size[],
): ({ x: number; y: number } | null)[] {
  const fromBottom = corner.startsWith('bottom');
  const out: ({ x: number; y: number } | null)[] = [];
  let offset = EDGE;
  for (const size of sizes) {
    if (offset + size.height + EDGE > workArea.height) {
      out.push(null);
      continue;
    }
    const x = corner.endsWith('left')
      ? workArea.x + SIDE
      : corner.endsWith('right')
        ? workArea.x + workArea.width - size.width - SIDE
        : workArea.x + Math.round((workArea.width - size.width) / 2);
    const y = fromBottom
      ? workArea.y + workArea.height - offset - size.height
      : workArea.y + offset;
    out.push({ x: Math.round(x), y: Math.round(y) });
    offset += size.height + GAP;
  }
  return out;
}

export interface StackCard {
  /** The card's window (sized for the expanded card plus shadow room). */
  window: Size;
  /** The card as it looks right now (a pill, or expanded on hover). */
  cardHeight: number;
}

/** Shadow room between a card and its window edge (matches the notification page's padding). */
export const CARD_PAD = 10;
/** Space between neighbouring cards. */
export const CARD_GAP = 8;

/**
 * Window positions for a stack of cards, spaced by what is actually visible, so pills sit close
 * together and an expanded card pushes its neighbours along. `cards[0]` is nearest the corner.
 * Windows may overlap; their empty parts let clicks through. Cards that don't fit get null.
 */
export function stackWindows(
  corner: Corner,
  workArea: Rect,
  cards: readonly StackCard[],
): ({ x: number; y: number } | null)[] {
  const fromBottom = corner.startsWith('bottom');
  let used = 0;
  return cards.map(({ window, cardHeight }) => {
    if (used + cardHeight + CARD_PAD * 2 > workArea.height) return null;
    const x = corner.endsWith('left')
      ? workArea.x + SIDE
      : corner.endsWith('right')
        ? workArea.x + workArea.width - window.width - SIDE
        : workArea.x + Math.round((workArea.width - window.width) / 2);
    // The card sits CARD_PAD inside its window, at the top (top corners) or bottom (bottom corners).
    const y = fromBottom ? workArea.y + workArea.height - used - window.height : workArea.y + used;
    used += cardHeight + CARD_GAP;
    return { x: Math.round(x), y: Math.round(y) };
  });
}

/**
 * Where a right-click menu window goes: its panel's top-left corner at the pointer, flipped to the
 * left or upwards when it would run off the screen (as it does from the tray), and kept on screen.
 * `pad` is the transparent room round the panel for its shadow.
 */
export function menuPosition(
  at: { x: number; y: number },
  size: Size,
  workArea: Rect,
  pad: number,
): { x: number; y: number } {
  const right = workArea.x + workArea.width;
  const bottom = workArea.y + workArea.height;
  let x = at.x - pad;
  if (x + size.width > right + pad) x = at.x - size.width + pad;
  let y = at.y - pad;
  if (y + size.height > bottom + pad) y = at.y - size.height + pad;
  x = Math.min(Math.max(x, workArea.x - pad), right - size.width + pad);
  y = Math.min(Math.max(y, workArea.y - pad), bottom - size.height + pad);
  return { x: Math.round(x), y: Math.round(y) };
}
