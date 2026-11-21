import { describe, expect, it } from 'vitest';
import {
  atTime,
  inWindow,
  latestMissed,
  occurrencesBetween,
  tomorrowMorning,
  windowEnd,
} from '@shared/time';
import { nextFireAt, parseTime } from '@shared/nextFireAt';
import type { Rule } from '@shared/schema';

describe('timeExhaustive - Deep Wall-Clock & Window Mathematics', () => {
  it('parses boundary 24-hour time strings accurately', () => {
    expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
    expect(parseTime('00:01')).toEqual({ hours: 0, minutes: 1 });
    expect(parseTime('12:00')).toEqual({ hours: 12, minutes: 0 });
    expect(parseTime('12:59')).toEqual({ hours: 12, minutes: 59 });
    expect(parseTime('23:00')).toEqual({ hours: 23, minutes: 0 });
    expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
  });

  it('constructs precise dates at specified local wall-clock times', () => {
    const base = new Date(2026, 5, 15, 14, 30, 45, 123);
    const result = atTime(base, '08:15');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(15);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  describe('inWindow edge cases and overnight ranges', () => {
    const overnight = { from: '22:00', to: '07:00' };
    const daytime = { from: '09:00', to: '17:00' };

    it('identifies exact boundary hits for daytime windows', () => {
      const atStart = new Date(2026, 3, 10, 9, 0, 0);
      const atEnd = new Date(2026, 3, 10, 17, 0, 0);
      const inside = new Date(2026, 3, 10, 12, 30, 0);
      const outsideBefore = new Date(2026, 3, 10, 8, 59, 59);
      const outsideAfter = new Date(2026, 3, 10, 17, 0, 1);

      expect(inWindow(daytime, atStart)).toBe(true);
      expect(inWindow(daytime, inside)).toBe(true);
      // Window is [start, end)
      expect(inWindow(daytime, atEnd)).toBe(false);
      expect(inWindow(daytime, outsideBefore)).toBe(false);
      expect(inWindow(daytime, outsideAfter)).toBe(false);
    });

    it('handles overnight quiet hour ranges spanning across midnight', () => {
      const nightLate = new Date(2026, 3, 10, 23, 30, 0);
      const midnight = new Date(2026, 3, 11, 0, 0, 0);
      const earlyMorning = new Date(2026, 3, 11, 4, 15, 0);
      const justBeforeEnd = new Date(2026, 3, 11, 6, 59, 59);
      const atEndMorning = new Date(2026, 3, 11, 7, 0, 0);
      const midday = new Date(2026, 3, 11, 14, 0, 0);

      expect(inWindow(overnight, nightLate)).toBe(true);
      expect(inWindow(overnight, midnight)).toBe(true);
      expect(inWindow(overnight, earlyMorning)).toBe(true);
      expect(inWindow(overnight, justBeforeEnd)).toBe(true);
      expect(inWindow(overnight, atEndMorning)).toBe(false);
      expect(inWindow(overnight, midday)).toBe(false);
    });

    it('calculates exact windowEnd for overnight windows', () => {
      const midNight = new Date(2026, 3, 10, 23, 0, 0);
      const end = windowEnd(overnight, midNight);
      expect(end.getHours()).toBe(7);
      expect(end.getMinutes()).toBe(0);
      expect(end.getDate()).toBe(11);

      const outside = new Date(2026, 3, 10, 12, 0, 0);
      expect(windowEnd(overnight, outside)).toEqual(outside);
    });
  });

  describe('tomorrowMorning calculations', () => {
    it('always targets 09:00 on the following day regardless of current hour', () => {
      const early = new Date(2026, 7, 20, 2, 0, 0);
      const late = new Date(2026, 7, 20, 23, 45, 0);

      const targetEarly = tomorrowMorning(early);
      expect(targetEarly.getDate()).toBe(21);
      expect(targetEarly.getHours()).toBe(9);
      expect(targetEarly.getMinutes()).toBe(0);

      const targetLate = tomorrowMorning(late);
      expect(targetLate.getDate()).toBe(21);
      expect(targetLate.getHours()).toBe(9);
      expect(targetLate.getMinutes()).toBe(0);
    });
  });

  describe('latestMissed occurrence detection', () => {
    const dailyRule: Rule = { kind: 'daily', times: ['09:00', '15:00', '21:00'] };

    it('returns the most recent missed occurrence within the downtime window', () => {
      const since = new Date(2026, 5, 10, 8, 0, 0);
      const now = new Date(2026, 5, 10, 16, 30, 0);

      const missed = latestMissed(dailyRule, since, now);
      expect(missed).not.toBeNull();
      expect(missed?.getHours()).toBe(15);
      expect(missed?.getMinutes()).toBe(0);
    });

    it('returns null if no scheduled fires occurred between since and now', () => {
      const since = new Date(2026, 5, 10, 10, 0, 0);
      const now = new Date(2026, 5, 10, 12, 0, 0);

      expect(latestMissed(dailyRule, since, now)).toBeNull();
    });
  });

  describe('occurrencesBetween timeline projection', () => {
    const intervalRule: Rule = { kind: 'interval', everyMs: 30 * 60_000 };

    it('generates sequential occurrence lists bounded by start and end limits', () => {
      const from = new Date(2026, 0, 1, 10, 0, 0);
      const to = new Date(2026, 0, 1, 12, 0, 0);

      const list = occurrencesBetween(intervalRule, from, to, 10);
      expect(list.length).toBe(4);
      expect(list[0]?.getMinutes()).toBe(30);
      expect(list[1]?.getHours()).toBe(11);
      expect(list[2]?.getMinutes()).toBe(30);
      expect(list[3]?.getHours()).toBe(12);
    });

    it('strictly caps results to the provided limit parameter', () => {
      const from = new Date(2026, 0, 1, 0, 0, 0);
      const to = new Date(2026, 0, 2, 0, 0, 0);

      const list = occurrencesBetween(intervalRule, from, to, 5);
      expect(list.length).toBe(5);
    });
  });
});
