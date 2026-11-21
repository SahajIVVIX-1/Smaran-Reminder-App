import { describe, expect, it } from 'vitest';
import { nextFireAt } from '@shared/nextFireAt';
import type { Rule } from '@shared/schema';

describe('leapYearAndDst - Leap Years, Month Lengths & Daylight Saving Transitions', () => {
  describe('Yearly and Monthly Leap Day (Feb 29) handling', () => {
    it('schedules on Feb 29 in leap years (e.g. 2028)', () => {
      const yearlyRule: Rule = { kind: 'yearly', month: 2, day: 29, time: '14:00' };
      const after = new Date(2028, 1, 1, 0, 0, 0); // Feb 1, 2028 (leap year)

      const next = nextFireAt(yearlyRule, after);
      expect(next).not.toBeNull();
      expect(next?.getFullYear()).toBe(2028);
      expect(next?.getMonth()).toBe(1); // February
      expect(next?.getDate()).toBe(29);
      expect(next?.getHours()).toBe(14);
    });

    it('clamps Feb 29 to Feb 28 in non-leap years (e.g. 2026)', () => {
      const yearlyRule: Rule = { kind: 'yearly', month: 2, day: 29, time: '10:00' };
      const after = new Date(2026, 0, 1, 0, 0, 0); // Jan 1, 2026

      const next = nextFireAt(yearlyRule, after);
      expect(next).not.toBeNull();
      // In 2026 (non-leap year), February is clamped to 28 days
      expect(next?.getFullYear()).toBe(2026);
      expect(next?.getMonth()).toBe(1);
      expect(next?.getDate()).toBe(28);
    });

    it('clamps monthly day 31 rules to the last day of shorter months', () => {
      const monthly31: Rule = { kind: 'monthly', day: 31, time: '12:00' };

      // After Jan 31 12:00 -> February has 28 days in 2026
      const afterJan = new Date(2026, 0, 31, 12, 1, 0);
      const nextFeb = nextFireAt(monthly31, afterJan);
      expect(nextFeb).not.toBeNull();
      expect(nextFeb?.getMonth()).toBe(1); // February
      expect(nextFeb?.getDate()).toBe(28); // Clamped to 28

      // After March 31 -> April has 30 days
      const afterMar = new Date(2026, 2, 31, 12, 1, 0);
      const nextApr = nextFireAt(monthly31, afterMar);
      expect(nextApr).not.toBeNull();
      expect(nextApr?.getMonth()).toBe(3); // April
      expect(nextApr?.getDate()).toBe(30); // Clamped to 30
    });
  });

  describe('Daily and Weekly rules across Daylight Saving Time shifts', () => {
    it('preserves wall-clock 09:00 across spring forward DST shift (March 2026 in NY)', () => {
      // In US/Eastern, DST spring forward occurs on March 8, 2026 (2am -> 3am)
      const daily9am: Rule = { kind: 'daily', times: ['09:00'] };

      const beforeShift = new Date(2026, 2, 7, 10, 0, 0); // March 7, 2026 10am
      const next = nextFireAt(daily9am, beforeShift);

      expect(next).not.toBeNull();
      expect(next?.getDate()).toBe(8);
      expect(next?.getHours()).toBe(9);
      expect(next?.getMinutes()).toBe(0);

      // Next after March 8 09:00
      const nextAfterShift = nextFireAt(daily9am, next!);
      expect(nextAfterShift?.getDate()).toBe(9);
      expect(nextAfterShift?.getHours()).toBe(9);
      expect(nextAfterShift?.getMinutes()).toBe(0);
    });

    it('preserves wall-clock 09:00 across fall back DST shift (November 2026 in NY)', () => {
      // In US/Eastern, DST fall back occurs on November 1, 2026 (2am -> 1am)
      const daily9am: Rule = { kind: 'daily', times: ['09:00'] };

      const beforeShift = new Date(2026, 9, 31, 10, 0, 0); // October 31, 2026
      const next = nextFireAt(daily9am, beforeShift);

      expect(next).not.toBeNull();
      expect(next?.getDate()).toBe(1);
      expect(next?.getMonth()).toBe(10); // November
      expect(next?.getHours()).toBe(9);
      expect(next?.getMinutes()).toBe(0);
    });
  });
});
