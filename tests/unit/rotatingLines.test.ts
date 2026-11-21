import { describe, expect, it } from 'vitest';
import { pickLine } from '../../src/main/engine/Engine';

describe('rotatingLines - Affirmation & Reminder Line Picker Engine', () => {
  const lines3 = { lines: ['First affirmation', 'Second stretch', 'Third thought'], lineOrder: 'inOrder' as const };

  describe('inOrder sequential progression', () => {
    it('cycles sequentially through lines in order and rolls over cleanly', () => {
      let state: { nextLine: number; shuffleBag: number[] } = { nextLine: 0, shuffleBag: [] };

      const pick1 = pickLine(lines3, state, Math.random);
      expect(pick1.index).toBe(0);
      state = pick1.next;

      const pick2 = pickLine(lines3, state, Math.random);
      expect(pick2.index).toBe(1);
      state = pick2.next;

      const pick3 = pickLine(lines3, state, Math.random);
      expect(pick3.index).toBe(2);
      state = pick3.next;

      // Wrap-around back to 0
      const pick4 = pickLine(lines3, state, Math.random);
      expect(pick4.index).toBe(0);
      expect(pick4.next.nextLine).toBe(1);
    });

    it('recovers gracefully if state.nextLine starts greater than line count', () => {
      const state: { nextLine: number; shuffleBag: number[] } = { nextLine: 99, shuffleBag: [] };
      const pick = pickLine(lines3, state, Math.random);

      // 99 % 3 = 0
      expect(pick.index).toBe(0);
      expect(pick.next.nextLine).toBe(1);
    });
  });

  describe('shuffle non-repeating bag algorithm', () => {
    const shuffle3 = { lines: ['A', 'B', 'C', 'D'], lineOrder: 'shuffle' as const };

    it('exhausts all items in the bag without duplicate values before refill', () => {
      let state: { nextLine: number; shuffleBag: number[] } = { nextLine: 0, shuffleBag: [] };
      const chosenIndexes: number[] = [];

      for (let i = 0; i < 4; i++) {
        const pick = pickLine(shuffle3, state, Math.random);
        chosenIndexes.push(pick.index);
        state = pick.next;
      }

      // Must have seen all 4 distinct indexes
      expect(new Set(chosenIndexes).size).toBe(4);
      expect(chosenIndexes.sort()).toEqual([0, 1, 2, 3]);
      // Bag is now empty, ready for refill
      expect(state.shuffleBag.length).toBe(0);
    });

    it('prevents immediate duplicate repeat across refill boundary', () => {
      // Force pseudo-random to pick 0 at first slot of refill
      const mockRandom = () => 0.0;
      const state: { nextLine: number; shuffleBag: number[] } = { nextLine: 0, shuffleBag: [] };

      const pick = pickLine(shuffle3, state, mockRandom);
      // Because previous was 0 and n > 1, algorithm swaps bag[0] and bag[1] so index is NOT 0
      expect(pick.index).not.toBe(0);
    });

    it('handles single-item arrays in shuffle mode', () => {
      const single = { lines: ['Only one'], lineOrder: 'shuffle' as const };
      const state: { nextLine: number; shuffleBag: number[] } = { nextLine: 0, shuffleBag: [] };

      const pick = pickLine(single, state, Math.random);
      expect(pick.index).toBe(0);
    });
  });
});
