import { addDays, addMonths, getDaysInMonth, parseISO, startOfDay } from 'date-fns';
import type { Rule } from './schema';

export interface FireState {
  /** A once-rule that already fired. */
  done?: boolean;
}

/**
 * The first time strictly after `after` at which `rule` fires, or null if it never will again.
 * Pure local-time math (date-fns), so DST changes shift wall-clock times correctly.
 *
 * For interval rules, pass the last fire time as `after` (or now on the first run);
 * the result may then lie in the past, which the scheduler treats as a missed fire.
 */
export function nextFireAt(rule: Rule, after: Date, state: FireState = {}): Date | null {
  switch (rule.kind) {
    case 'once': {
      const at = parseISO(rule.at);
      return !state.done && at > after ? at : null;
    }
    case 'interval':
      return nextInterval(rule, after);
    case 'daily':
      return firstAfter(after, 1, (day) => rule.times.map((t) => atTime(day, t)));
    case 'weekly':
      return firstAfter(after, 7, (day) =>
        rule.weekdays.includes(day.getDay()) ? [atTime(day, rule.time)] : [],
      );
    case 'monthly':
      return firstMonthly(rule.day, rule.time, after);
    case 'yearly':
      return firstYearly(rule.month, rule.day, rule.time, after);
  }
}

/** Parses 'HH:mm' (already validated by the schema). */
export function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':');
  return { hours: Number(h), minutes: Number(m) };
}

/** `day` (any time on it) at local wall-clock `time`. */
function atTime(day: Date, time: string): Date {
  const { hours, minutes } = parseTime(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
}

/** Earliest candidate after `after`, looking from today through `extraDays` days ahead. */
function firstAfter(after: Date, extraDays: number, candidatesOn: (day: Date) => Date[]): Date {
  const today = startOfDay(after);
  for (let k = 0; k <= extraDays; k++) {
    const times = candidatesOn(addDays(today, k))
      .filter((t) => t > after)
      .sort((a, b) => a.getTime() - b.getTime());
    if (times[0]) return times[0];
  }
  // Unreachable with schema-valid rules (at least one time / weekday).
  throw new Error('Rule has no fire times.');
}

/** Day N of the month containing `monthStart`, clamped to the month length ('last' = last day). */
function clampedDay(monthStart: Date, day: number | 'last'): Date {
  const length = getDaysInMonth(monthStart);
  const d = day === 'last' ? length : Math.min(day, length);
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
}

function firstMonthly(day: number | 'last', time: string, after: Date): Date {
  const thisMonth = new Date(after.getFullYear(), after.getMonth(), 1);
  const candidate = atTime(clampedDay(thisMonth, day), time);
  if (candidate > after) return candidate;
  return atTime(clampedDay(addMonths(thisMonth, 1), day), time);
}

function firstYearly(month: number, day: number, time: string, after: Date): Date {
  const inYear = (year: number) => atTime(clampedDay(new Date(year, month - 1, 1), day), time);
  const candidate = inYear(after.getFullYear());
  if (candidate > after) return candidate;
  return inYear(after.getFullYear() + 1);
}

// ---------- interval ----------

type IntervalRule = Extract<Rule, { kind: 'interval' }>;

function nextInterval(rule: IntervalRule, after: Date): Date {
  const candidate = new Date(after.getTime() + rule.everyMs);
  if (isAllowed(rule, candidate)) return candidate;
  return nextWindowStart(rule, candidate);
}

interface Window {
  start: Date;
  end: Date;
}

/** The allowed window that begins on `day`, or null if that weekday is excluded. */
function windowOn(rule: IntervalRule, day: Date): Window | null {
  if (rule.weekdays && !rule.weekdays.includes(day.getDay())) return null;
  if (!rule.activeHours) return { start: day, end: addDays(day, 1) };
  const start = atTime(day, rule.activeHours.from);
  // from > to means the window crosses midnight.
  const endDay = rule.activeHours.to > rule.activeHours.from ? day : addDays(day, 1);
  return { start, end: atTime(endDay, rule.activeHours.to) };
}

function isAllowed(rule: IntervalRule, t: Date): boolean {
  const today = startOfDay(t);
  // A window that started yesterday may still be open (overnight hours).
  return [addDays(today, -1), today].some((day) => {
    const w = windowOn(rule, day);
    return w !== null && t >= w.start && t < w.end;
  });
}

function nextWindowStart(rule: IntervalRule, t: Date): Date {
  const today = startOfDay(t);
  for (let k = 0; k <= 7; k++) {
    const w = windowOn(rule, addDays(today, k));
    if (w && w.start > t) return w.start;
  }
  // Unreachable: the schema requires at least one weekday.
  throw new Error('Interval rule has no allowed window.');
}
