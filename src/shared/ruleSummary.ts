import { format, parseISO } from 'date-fns';
import type { Rule } from './schema';

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "Mon–Fri", "Weekends", "Mon, Wed, Fri", "Every day". */
export function weekdaysSummary(days: readonly number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  const key = set.join(',');
  if (key === '0,1,2,3,4,5,6') return 'every day';
  if (key === '1,2,3,4,5') return 'Mon–Fri';
  if (key === '0,6') return 'weekends';
  return set.map((d) => WEEKDAY_SHORT[d] ?? '?').join(', ');
}

/** "45 min", "2 h", "1 h 30 min". */
export function durationSummary(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** One line a person can read, e.g. "Every 45 min, 09:00–17:00, Mon–Fri". */
export function ruleSummary(rule: Rule): string {
  switch (rule.kind) {
    case 'interval': {
      const parts = [`Every ${durationSummary(rule.everyMs)}`];
      if (rule.activeHours) parts.push(`${rule.activeHours.from}–${rule.activeHours.to}`);
      if (rule.weekdays) parts.push(weekdaysSummary(rule.weekdays));
      return parts.join(', ');
    }
    case 'once':
      return `Once on ${format(parseISO(rule.at), 'd MMM yyyy, HH:mm')}`;
    case 'daily':
      return `Daily at ${[...rule.times].sort().join(', ')}`;
    case 'weekly':
      return `Weekly on ${weekdaysSummary(rule.weekdays)} at ${rule.time}`;
    case 'monthly':
      return `Monthly on ${rule.day === 'last' ? 'the last day' : `day ${rule.day}`} at ${rule.time}`;
    case 'yearly':
      return `Yearly on ${rule.day} ${MONTH_SHORT[rule.month - 1] ?? '?'} at ${rule.time}`;
  }
}
