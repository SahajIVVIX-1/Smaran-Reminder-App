import { describe, expect, it } from 'vitest';
import { ruleSummary, weekdaysSummary } from '@shared/ruleSummary';
import type { Rule } from '@shared/schema';
import {
  atTime,
  inWindow,
  latestMissed,
  occurrencesBetween,
  tomorrowMorning,
  windowEnd,
} from '@shared/time';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe('windows (quiet hours)', () => {
  const day = { from: '09:00', to: '17:00' };
  const night = { from: '22:00', to: '07:00' };

  it('daytime window', () => {
    expect(inWindow(day, at(8, 9))).toBe(true);
    expect(inWindow(day, at(8, 17))).toBe(false);
    expect(windowEnd(day, at(8, 12))).toEqual(at(8, 17));
    expect(windowEnd(day, at(8, 18))).toEqual(at(8, 18));
  });

  it('overnight window', () => {
    expect(inWindow(night, at(8, 23))).toBe(true);
    expect(inWindow(night, at(9, 6, 59))).toBe(true);
    expect(inWindow(night, at(9, 7))).toBe(false);
    expect(windowEnd(night, at(8, 23))).toEqual(at(9, 7));
    expect(windowEnd(night, at(9, 2))).toEqual(at(9, 7));
  });

  it('atTime and tomorrowMorning', () => {
    expect(atTime(at(8, 15), '06:30')).toEqual(at(8, 6, 30));
    expect(tomorrowMorning(at(8, 23))).toEqual(at(9, 9));
  });
});

describe('occurrences', () => {
  const daily: Rule = { kind: 'daily', times: ['09:00', '18:00'] };

  it('latestMissed finds the most recent occurrence since a time', () => {
    expect(latestMissed(daily, at(6, 12), at(8, 10))).toEqual(at(8, 9));
    expect(latestMissed(daily, at(8, 9), at(8, 10))).toBeNull();
    expect(latestMissed({ kind: 'once', at: '2026-10-07T08:00:00' }, at(6, 0), at(8, 0))).toEqual(
      at(7, 8),
    );
  });

  it('occurrencesBetween lists times in a range, up to a limit', () => {
    expect(occurrencesBetween(daily, at(8, 0), at(9, 23, 59))).toEqual([
      at(8, 9),
      at(8, 18),
      at(9, 9),
      at(9, 18),
    ]);
    expect(occurrencesBetween(daily, at(8, 0), at(30, 0), 3)).toHaveLength(3);
    expect(
      occurrencesBetween({ kind: 'once', at: '2026-10-01T08:00:00' }, at(8, 0), at(9, 0)),
    ).toEqual([]);
  });
});

describe('ruleSummary', () => {
  it.each<[Rule, string]>([
    [{ kind: 'interval', everyMs: 60_000 }, 'Every minute'],
    [{ kind: 'interval', everyMs: 45 * 60_000 }, 'Every 45 minutes'],
    [
      { kind: 'interval', everyMs: 3_600_000, activeHours: { from: '09:00', to: '18:00' } },
      'Every hour, 09:00–18:00',
    ],
    [{ kind: 'interval', everyMs: 2 * 3_600_000, weekdays: [0, 6] }, 'Every 2 hours, weekends'],
    [
      { kind: 'interval', everyMs: 90 * 60_000, weekdays: [1, 2, 3, 4, 5] },
      'Every 1 h 30 min, Mon–Fri',
    ],
    [{ kind: 'once', at: '2026-10-08T09:00:00' }, 'Once, Thu 8 Oct 2026, 09:00'],
    [{ kind: 'daily', times: ['18:00', '09:00'] }, 'Daily at 09:00, 18:00'],
    [
      { kind: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], time: '07:00' },
      'Weekly on every day at 07:00',
    ],
    [{ kind: 'weekly', weekdays: [3, 1], time: '07:00' }, 'Weekly on Mon, Wed at 07:00'],
    [{ kind: 'monthly', day: 31, time: '09:00' }, 'Monthly on day 31 at 09:00'],
    [{ kind: 'monthly', day: 'last', time: '09:00' }, 'Monthly on the last day at 09:00'],
    [{ kind: 'yearly', month: 2, day: 29, time: '08:00' }, 'Yearly on 29 Feb at 08:00'],
  ])('%j → %s', (rule, text) => {
    expect(ruleSummary(rule)).toBe(text);
  });

  it('shows ? for out-of-range values instead of crashing', () => {
    expect(weekdaysSummary([9])).toBe('?');
    expect(ruleSummary({ kind: 'yearly', month: 13, day: 1, time: '08:00' })).toBe(
      'Yearly on 1 ? at 08:00',
    );
  });
});
