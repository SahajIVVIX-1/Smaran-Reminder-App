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

/** Distance from the screen edge and between cards (DIP). */
export const EDGE = 12;
export const GAP = 4;

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
      ? workArea.x + EDGE
      : corner.endsWith('right')
        ? workArea.x + workArea.width - size.width - EDGE
        : workArea.x + Math.round((workArea.width - size.width) / 2);
    const y = fromBottom
      ? workArea.y + workArea.height - offset - size.height
      : workArea.y + offset;
    out.push({ x: Math.round(x), y: Math.round(y) });
    offset += size.height + GAP;
  }
  return out;
}
