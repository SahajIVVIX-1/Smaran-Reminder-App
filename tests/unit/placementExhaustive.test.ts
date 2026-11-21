import { describe, expect, it } from 'vitest';
import {
  CARD_GAP,
  CARD_PAD,
  menuPosition,
  pickDisplay,
  SIDE,
  stackLayout,
  stackWindows,
  type DisplayInfo,
  type Rect,
  type StackCard,
} from '../../src/main/windows/placement';

describe('placementExhaustive - Window Placement & Multi-Monitor Geometry', () => {
  const display1: DisplayInfo = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  };

  const display2: DisplayInfo = {
    id: 2,
    bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
    workArea: { x: 1920, y: 0, width: 2560, height: 1400 },
  };

  describe('pickDisplay selection logic', () => {
    it('always selects primary display when which is primary', () => {
      const cursorOnSecondary = { x: 2500, y: 500 };
      const selected = pickDisplay('primary', [display1, display2], display1.id, cursorOnSecondary);
      expect(selected.id).toBe(1);
    });

    it('identifies display containing the mouse cursor', () => {
      const cursorOnPrimary = { x: 500, y: 500 };
      expect(pickDisplay('cursor', [display1, display2], display1.id, cursorOnPrimary).id).toBe(1);

      const cursorOnSecondary = { x: 2100, y: 800 };
      expect(pickDisplay('cursor', [display1, display2], display1.id, cursorOnSecondary).id).toBe(2);
    });

    it('falls back to primary when cursor is outside any known screen bounds', () => {
      const cursorOutside = { x: -5000, y: -5000 };
      expect(pickDisplay('cursor', [display1, display2], display1.id, cursorOutside).id).toBe(1);
    });

    it('throws error when display list is empty', () => {
      expect(() => pickDisplay('primary', [], 1, { x: 0, y: 0 })).toThrow(/No displays/);
    });
  });

  describe('stackWindows positioning across all corners', () => {
    const cards: StackCard[] = [
      { window: { width: 368, height: 240 }, cardHeight: 48 }, // card 0 (newest)
      { window: { width: 368, height: 240 }, cardHeight: 48 }, // card 1
    ];

    it('calculates top-right corner placement', () => {
      const res = stackWindows('top-right', display1.workArea, cards);
      expect(res.length).toBe(2);

      const expectedX = display1.workArea.width - 368 - SIDE;
      expect(res[0]?.x).toBe(expectedX);
      expect(res[0]?.y).toBe(0);

      expect(res[1]?.x).toBe(expectedX);
      expect(res[1]?.y).toBe(48 + CARD_GAP);
    });

    it('calculates top-left corner placement', () => {
      const res = stackWindows('top-left', display1.workArea, cards);
      expect(res[0]?.x).toBe(SIDE);
      expect(res[0]?.y).toBe(0);

      expect(res[1]?.x).toBe(SIDE);
      expect(res[1]?.y).toBe(48 + CARD_GAP);
    });

    it('calculates top-center corner placement', () => {
      const res = stackWindows('top-center', display1.workArea, cards);
      const expectedX = Math.round((display1.workArea.width - 368) / 2);

      expect(res[0]?.x).toBe(expectedX);
      expect(res[0]?.y).toBe(0);
      expect(res[1]?.x).toBe(expectedX);
    });

    it('calculates bottom-right corner placement', () => {
      const res = stackWindows('bottom-right', display1.workArea, cards);
      const expectedX = display1.workArea.width - 368 - SIDE;

      expect(res[0]?.x).toBe(expectedX);
      // Sits at bottom of work area
      expect(res[0]?.y).toBe(display1.workArea.height - 240);

      // Card 1 pushed upwards
      expect(res[1]?.x).toBe(expectedX);
      expect(res[1]?.y).toBe(display1.workArea.height - (48 + CARD_GAP) - 240);
    });

    it('calculates bottom-left corner placement', () => {
      const res = stackWindows('bottom-left', display1.workArea, cards);
      expect(res[0]?.x).toBe(SIDE);
      expect(res[0]?.y).toBe(display1.workArea.height - 240);

      expect(res[1]?.x).toBe(SIDE);
      expect(res[1]?.y).toBe(display1.workArea.height - (48 + CARD_GAP) - 240);
    });

    it('returns null for cards exceeding vertical screen capacity', () => {
      const tinyWorkArea: Rect = { x: 0, y: 0, width: 800, height: 100 };
      const manyCards: StackCard[] = [
        { window: { width: 300, height: 120 }, cardHeight: 60 },
        { window: { width: 300, height: 120 }, cardHeight: 60 },
      ];

      const res = stackWindows('top-right', tinyWorkArea, manyCards);
      expect(res[0]).not.toBeNull();
      // Second card cannot fit in 100px height with padding
      expect(res[1]).toBeNull();
    });
  });

  describe('stackLayout fallback positioning', () => {
    it('computes basic rect stacking without card padding offset', () => {
      const sizes = [
        { width: 300, height: 80 },
        { width: 300, height: 80 },
      ];
      const res = stackLayout('top-left', display1.workArea, sizes);
      expect(res.length).toBe(2);
      expect(res[0]?.x).toBe(SIDE);
      expect(res[0]?.y).toBe(0);
      expect(res[1]?.x).toBe(SIDE);
      expect(res[1]?.y).toBe(80);
    });
  });

  describe('menuPosition context popup calculations', () => {
    it('positions menu near cursor with pad offset', () => {
      const at = { x: 500, y: 500 };
      const size = { width: 200, height: 150 };
      const pos = menuPosition(at, size, display1.workArea, 10);

      expect(pos.x).toBe(490);
      expect(pos.y).toBe(490);
    });

    it('flips upwards and leftwards when close to right and bottom monitor edges', () => {
      const at = { x: 1910, y: 1030 }; // Near bottom-right of display1
      const size = { width: 200, height: 150 };
      const pos = menuPosition(at, size, display1.workArea, 10);

      // Flipped to avoid running off screen
      expect(pos.x + size.width).toBeLessThanOrEqual(display1.workArea.width + 10);
      expect(pos.y + size.height).toBeLessThanOrEqual(display1.workArea.height + 10);
    });
  });
});
