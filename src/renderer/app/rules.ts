import { format } from 'date-fns';
import type { Rule } from '@shared/schema';

/** A sensible starting rule when the user switches kind. */
export function defaultRule(kind: Rule['kind'], now: Date = new Date()): Rule {
  switch (kind) {
    case 'interval':
      return { kind, everyMs: 60 * 60_000, activeHours: { from: '09:00', to: '18:00' } };
    case 'once': {
      const soon = new Date(now.getTime() + 60 * 60_000);
      soon.setMinutes(0, 0, 0);
      return { kind, at: format(soon, "yyyy-MM-dd'T'HH:mm:ss") };
    }
    case 'daily':
      return { kind, times: ['09:00'] };
    case 'weekly':
      return { kind, weekdays: [1, 2, 3, 4, 5], time: '09:00' };
    case 'monthly':
      return { kind, day: 1, time: '09:00' };
    case 'yearly':
      return { kind, month: now.getMonth() + 1, day: now.getDate(), time: '09:00' };
  }
}
