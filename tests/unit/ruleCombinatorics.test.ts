import { describe, expect, it } from 'vitest';
import { nextFireAt } from '@shared/nextFireAt';
import type { Rule } from '@shared/schema';

describe('ruleCombinatorics - Combinatorial Rule Evaluation', () => {
  it('correctly schedules across all single weekday rules', () => {
    // Check days 0 (Sun) to 6 (Sat)
    for (let day = 0; day <= 6; day++) {
      const rule: Rule = { kind: 'weekly', weekdays: [day], time: '10:00' };
      const base = new Date(2026, 4, 1, 0, 0, 0); // May 1, 2026 (Friday, day 5)

      const next = nextFireAt(rule, base);
      expect(next).not.toBeNull();
      expect(next?.getDay()).toBe(day);
      expect(next?.getHours()).toBe(10);
      expect(next?.getMinutes()).toBe(0);
    }
  });

  it('cycles through alternating weekdays in order', () => {
    // Mon (1), Wed (3), Fri (5)
    const mwfRule: Rule = { kind: 'weekly', weekdays: [1, 3, 5], time: '08:00' };
    const monday = new Date(2026, 4, 4, 8, 0, 0); // May 4, 2026 is Monday

    const wed = nextFireAt(mwfRule, monday);
    expect(wed?.getDay()).toBe(3); // Wednesday

    const fri = nextFireAt(mwfRule, wed!);
    expect(fri?.getDay()).toBe(5); // Friday

    const nextMon = nextFireAt(mwfRule, fri!);
    expect(nextMon?.getDay()).toBe(1); // Monday
  });

  it('handles weekend-only schedules (Sat 6, Sun 0)', () => {
    const weekendRule: Rule = { kind: 'weekly', weekdays: [0, 6], time: '11:00' };
    const fridayNoon = new Date(2026, 4, 8, 12, 0, 0); // Friday May 8

    const sat = nextFireAt(weekendRule, fridayNoon);
    expect(sat?.getDay()).toBe(6);

    const sun = nextFireAt(weekendRule, sat!);
    expect(sun?.getDay()).toBe(0);

    const nextSat = nextFireAt(weekendRule, sun!);
    expect(nextSat?.getDay()).toBe(6);
  });

  it('evaluates interval rules with fine and coarse steps', () => {
    const min1: Rule = { kind: 'interval', everyMs: 60_000 };
    const min60: Rule = { kind: 'interval', everyMs: 3_600_000 };
    const min1440: Rule = { kind: 'interval', everyMs: 86_400_000 }; // 24 hours

    const start = new Date(2026, 0, 1, 12, 0, 0);

    const next1 = nextFireAt(min1, start);
    expect(next1!.getTime() - start.getTime()).toBe(60_000);

    const next60 = nextFireAt(min60, start);
    expect(next60!.getTime() - start.getTime()).toBe(3_600_000);

    const next1440 = nextFireAt(min1440, start);
    expect(next1440!.getTime() - start.getTime()).toBe(86_400_000);
  });

  it('sorts multiple daily times regardless of declaration order', () => {
    // Unsorted array of times
    const multiDaily: Rule = { kind: 'daily', times: ['18:00', '06:00', '12:00', '23:30'] };
    const morning = new Date(2026, 2, 1, 5, 0, 0);

    const t1 = nextFireAt(multiDaily, morning);
    expect(t1?.getHours()).toBe(6);

    const t2 = nextFireAt(multiDaily, t1!);
    expect(t2?.getHours()).toBe(12);

    const t3 = nextFireAt(multiDaily, t2!);
    expect(t3?.getHours()).toBe(18);

    const t4 = nextFireAt(multiDaily, t3!);
    expect(t4?.getHours()).toBe(23);
    expect(t4?.getMinutes()).toBe(30);

    // Rolls over to tomorrow 06:00
    const tTomorrow = nextFireAt(multiDaily, t4!);
    expect(tTomorrow?.getDate()).toBe(2);
    expect(tTomorrow?.getHours()).toBe(6);
  });
});
