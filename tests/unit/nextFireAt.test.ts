import { describe, expect, it } from 'vitest';
import { nextFireAt, parseTime } from '@shared/nextFireAt';
import type { Rule } from '@shared/schema';

/** Local time in the test zone (America/New_York). Month is 1-based. */
const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const HOUR = 3_600_000;

describe('test time zone', () => {
  it('has DST, so clock-change cases are real', () => {
    expect(local(2026, 1, 15).getTimezoneOffset()).toBe(300);
    expect(local(2026, 7, 15).getTimezoneOffset()).toBe(240);
  });
});

describe('parseTime', () => {
  it('splits HH:mm', () => {
    expect(parseTime('07:05')).toEqual({ hours: 7, minutes: 5 });
  });
});

describe('once', () => {
  const rule: Rule = { kind: 'once', at: '2026-10-08T09:00:00' };

  it('fires at its time when that is in the future', () => {
    expect(nextFireAt(rule, local(2026, 10, 8, 8))).toEqual(local(2026, 10, 8, 9));
  });

  it('never fires once its time has passed or equals now', () => {
    expect(nextFireAt(rule, local(2026, 10, 8, 10))).toBeNull();
    expect(nextFireAt(rule, local(2026, 10, 8, 9))).toBeNull();
  });

  it('never fires again after it is done', () => {
    expect(nextFireAt(rule, local(2026, 10, 8, 8), { done: true })).toBeNull();
  });
});

describe('daily', () => {
  const rule: Rule = { kind: 'daily', times: ['18:00', '09:00'] };

  it('picks the earliest listed time still ahead today', () => {
    expect(nextFireAt(rule, local(2026, 10, 8, 8))).toEqual(local(2026, 10, 8, 9));
    expect(nextFireAt(rule, local(2026, 10, 8, 9))).toEqual(local(2026, 10, 8, 18));
  });

  it('rolls to the first time tomorrow when today is over', () => {
    expect(nextFireAt(rule, local(2026, 10, 8, 19))).toEqual(local(2026, 10, 9, 9));
  });

  it('rolls over month and year ends', () => {
    expect(nextFireAt(rule, local(2026, 12, 31, 20))).toEqual(local(2027, 1, 1, 9));
  });
});

describe('weekly', () => {
  // 8 Oct 2026 is a Thursday (getDay() = 4).
  it('finds the next listed weekday', () => {
    const rule: Rule = { kind: 'weekly', weekdays: [1, 3], time: '09:00' };
    expect(nextFireAt(rule, local(2026, 10, 8, 10))).toEqual(local(2026, 10, 12, 9));
  });

  it('fires later the same day when the time is still ahead', () => {
    const rule: Rule = { kind: 'weekly', weekdays: [4], time: '09:00' };
    expect(nextFireAt(rule, local(2026, 10, 8, 8))).toEqual(local(2026, 10, 8, 9));
  });

  it('waits a full week when today is the only day and its time has passed', () => {
    const rule: Rule = { kind: 'weekly', weekdays: [4], time: '09:00' };
    expect(nextFireAt(rule, local(2026, 10, 8, 10))).toEqual(local(2026, 10, 15, 9));
  });
});

describe('monthly', () => {
  it('fires on day N this month when still ahead', () => {
    const rule: Rule = { kind: 'monthly', day: 15, time: '09:00' };
    expect(nextFireAt(rule, local(2026, 10, 8))).toEqual(local(2026, 10, 15, 9));
  });

  it('moves to next month when this month has passed', () => {
    const rule: Rule = { kind: 'monthly', day: 15, time: '09:00' };
    expect(nextFireAt(rule, local(2026, 10, 15, 10))).toEqual(local(2026, 11, 15, 9));
  });

  it('clamps day 31 to the end of short months', () => {
    const rule: Rule = { kind: 'monthly', day: 31, time: '09:00' };
    expect(nextFireAt(rule, local(2026, 2, 10))).toEqual(local(2026, 2, 28, 9));
    expect(nextFireAt(rule, local(2026, 1, 31, 10))).toEqual(local(2026, 2, 28, 9));
    expect(nextFireAt(rule, local(2028, 2, 1))).toEqual(local(2028, 2, 29, 9));
    expect(nextFireAt(rule, local(2026, 4, 1))).toEqual(local(2026, 4, 30, 9));
  });

  it("'last' means the last day of each month", () => {
    const rule: Rule = { kind: 'monthly', day: 'last', time: '09:00' };
    expect(nextFireAt(rule, local(2026, 4, 30, 10))).toEqual(local(2026, 5, 31, 9));
    expect(nextFireAt(rule, local(2026, 2, 1))).toEqual(local(2026, 2, 28, 9));
  });

  it('rolls from December into January', () => {
    const rule: Rule = { kind: 'monthly', day: 1, time: '09:00' };
    expect(nextFireAt(rule, local(2026, 12, 1, 10))).toEqual(local(2027, 1, 1, 9));
  });
});

describe('yearly', () => {
  it('fires this year when the date is still ahead', () => {
    const rule: Rule = { kind: 'yearly', month: 12, day: 25, time: '08:00' };
    expect(nextFireAt(rule, local(2026, 10, 8))).toEqual(local(2026, 12, 25, 8));
  });

  it('moves to next year once the date has passed', () => {
    const rule: Rule = { kind: 'yearly', month: 3, day: 1, time: '08:00' };
    expect(nextFireAt(rule, local(2026, 10, 8))).toEqual(local(2027, 3, 1, 8));
  });

  it('clamps 29 February to the 28th in non-leap years', () => {
    const rule: Rule = { kind: 'yearly', month: 2, day: 29, time: '08:00' };
    expect(nextFireAt(rule, local(2026, 10, 8))).toEqual(local(2027, 2, 28, 8));
    expect(nextFireAt(rule, local(2027, 3, 1))).toEqual(local(2028, 2, 29, 8));
  });
});

describe('DST change days (America/New_York)', () => {
  it('keeps wall-clock time across spring forward (a 23-hour day)', () => {
    const rule: Rule = { kind: 'daily', times: ['09:00'] };
    const after = local(2026, 3, 7, 9);
    const next = nextFireAt(rule, after) as Date;
    expect(next).toEqual(local(2026, 3, 8, 9));
    expect(next.getHours()).toBe(9);
    expect(next.getTime() - after.getTime()).toBe(23 * HOUR);
  });

  it('keeps wall-clock time across fall back (a 25-hour day)', () => {
    const rule: Rule = { kind: 'daily', times: ['09:00'] };
    const after = local(2026, 10, 31, 9);
    const next = nextFireAt(rule, after) as Date;
    expect(next.getHours()).toBe(9);
    expect(next.getDate()).toBe(1);
    expect(next.getTime() - after.getTime()).toBe(25 * HOUR);
  });

  it('a time skipped by spring forward fires at the shifted time', () => {
    const rule: Rule = { kind: 'daily', times: ['02:30'] };
    const next = nextFireAt(rule, local(2026, 3, 8, 0)) as Date;
    expect(next.getDate()).toBe(8);
    expect([next.getHours(), next.getMinutes()]).toEqual([3, 30]);
  });

  it('weekly keeps wall-clock time across the change', () => {
    const rule: Rule = { kind: 'weekly', weekdays: [1], time: '09:00' };
    expect(nextFireAt(rule, local(2026, 3, 5, 12))).toEqual(local(2026, 3, 9, 9));
  });

  it('intervals count real elapsed time across the change', () => {
    const rule: Rule = { kind: 'interval', everyMs: HOUR };
    const next = nextFireAt(rule, local(2026, 3, 8, 1, 30)) as Date;
    expect([next.getHours(), next.getMinutes()]).toEqual([3, 30]);
  });
});

describe('interval', () => {
  it('fires everyMs after the reference time when unrestricted', () => {
    const rule: Rule = { kind: 'interval', everyMs: 30 * 60_000 };
    expect(nextFireAt(rule, local(2026, 10, 8, 9))).toEqual(local(2026, 10, 8, 9, 30));
  });

  describe('active hours 09:00–17:00', () => {
    const rule: Rule = {
      kind: 'interval',
      everyMs: 2 * HOUR,
      activeHours: { from: '09:00', to: '17:00' },
    };

    it('keeps a time inside the window', () => {
      expect(nextFireAt(rule, local(2026, 10, 8, 10))).toEqual(local(2026, 10, 8, 12));
    });

    it('rolls a time before the window to its start', () => {
      expect(nextFireAt(rule, local(2026, 10, 8, 5))).toEqual(local(2026, 10, 8, 9));
    });

    it('rolls a time after the window to tomorrow’s start', () => {
      expect(nextFireAt(rule, local(2026, 10, 8, 16))).toEqual(local(2026, 10, 9, 9));
    });

    it('treats the end time as outside the window', () => {
      expect(nextFireAt(rule, local(2026, 10, 8, 15))).toEqual(local(2026, 10, 9, 9));
    });
  });

  describe('overnight active hours 22:00–06:00', () => {
    const rule: Rule = {
      kind: 'interval',
      everyMs: HOUR,
      activeHours: { from: '22:00', to: '06:00' },
    };

    it('allows late evening', () => {
      expect(nextFireAt(rule, local(2026, 10, 8, 22))).toEqual(local(2026, 10, 8, 23));
    });

    it('allows early morning in the window that began yesterday', () => {
      expect(nextFireAt(rule, local(2026, 10, 8, 2))).toEqual(local(2026, 10, 8, 3));
    });

    it('rolls daytime to tonight’s start', () => {
      expect(nextFireAt(rule, local(2026, 10, 8, 11))).toEqual(local(2026, 10, 8, 22));
    });
  });

  it('skips excluded weekdays to the next allowed day', () => {
    const weekdaysOnly: Rule = { kind: 'interval', everyMs: HOUR, weekdays: [1, 2, 3, 4, 5] };
    // Fri 9 Oct 2026 23:30 + 1 h = Sat 00:30 → Mon 12 Oct 00:00
    expect(nextFireAt(weekdaysOnly, local(2026, 10, 9, 23, 30))).toEqual(local(2026, 10, 12));
  });

  it('combines weekdays and active hours', () => {
    const rule: Rule = {
      kind: 'interval',
      everyMs: HOUR,
      weekdays: [1],
      activeHours: { from: '09:00', to: '17:00' },
    };
    expect(nextFireAt(rule, local(2026, 10, 8, 10))).toEqual(local(2026, 10, 12, 9));
  });

  it('an overnight window belongs to the weekday it starts on', () => {
    const fridayNights: Rule = {
      kind: 'interval',
      everyMs: HOUR,
      weekdays: [5],
      activeHours: { from: '22:00', to: '06:00' },
    };
    // Sat 10 Oct 02:00 is inside Friday night's window.
    expect(nextFireAt(fridayNights, local(2026, 10, 10, 1))).toEqual(local(2026, 10, 10, 2));
    // Sun 11 Oct 02:00 is not (Saturday is excluded).
    expect(nextFireAt(fridayNights, local(2026, 10, 11, 1))).toEqual(local(2026, 10, 16, 22));
  });
});

describe('rules with no possible fire time', () => {
  it('throw instead of looping', () => {
    expect(() => nextFireAt({ kind: 'daily', times: [] }, local(2026, 10, 8))).toThrow();
    expect(() =>
      nextFireAt({ kind: 'weekly', weekdays: [], time: '09:00' }, local(2026, 10, 8)),
    ).toThrow();
    expect(() =>
      nextFireAt({ kind: 'interval', everyMs: HOUR, weekdays: [] }, local(2026, 10, 8)),
    ).toThrow();
  });
});
