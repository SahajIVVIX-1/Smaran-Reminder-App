import { addDays, startOfDay } from 'date-fns';
import { nextFireAt, parseTime } from './nextFireAt';
import type { Rule } from './schema';

/** `day` at local wall-clock 'HH:mm'. */
export function atTime(day: Date, time: string): Date {
  const { hours, minutes } = parseTime(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
}

export interface Window {
  from: string;
  to: string;
}

/** The window that contains `t` (it may have started yesterday if it runs overnight), or null. */
function windowAround(w: Window, t: Date): { start: Date; end: Date } | null {
  const today = startOfDay(t);
  for (const day of [addDays(today, -1), today]) {
    const start = atTime(day, w.from);
    const end = atTime(w.to > w.from ? day : addDays(day, 1), w.to);
    if (t >= start && t < end) return { start, end };
  }
  return null;
}

/** True if `t` falls inside the daily window (overnight windows like 22:00–07:00 work). */
export function inWindow(w: Window, t: Date): boolean {
  return windowAround(w, t) !== null;
}

/** When the window that contains `t` ends; `t` itself if it is outside the window. */
export function windowEnd(w: Window, t: Date): Date {
  return windowAround(w, t)?.end ?? t;
}

/** "Tomorrow morning" for snooze: 09:00 the next day. */
export function tomorrowMorning(now: Date): Date {
  return atTime(addDays(startOfDay(now), 1), '09:00');
}

/**
 * The most recent occurrence of `rule` after `since` and at or before `now`, or null.
 * Used to notice time-of-day reminders that came due while the PC was off or asleep.
 */
export function latestMissed(rule: Rule, since: Date, now: Date, cap = 1000): Date | null {
  let last: Date | null = null;
  let cursor = since;
  for (let i = 0; i < cap; i++) {
    const next = nextFireAt(rule, cursor);
    if (!next || next > now) break;
    last = next;
    cursor = next;
  }
  return last;
}

/** Occurrences of `rule` in (from, to], at most `limit`. For the Today timeline. */
export function occurrencesBetween(rule: Rule, from: Date, to: Date, limit = 48): Date[] {
  const out: Date[] = [];
  let cursor = from;
  while (out.length < limit) {
    const next = nextFireAt(rule, cursor);
    if (!next || next > to) break;
    out.push(next);
    cursor = next;
  }
  return out;
}
