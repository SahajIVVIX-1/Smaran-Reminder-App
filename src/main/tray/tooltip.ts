import { format } from 'date-fns';

export interface TrayState {
  /** ISO time paused until, or null when running. */
  pausedUntil: string | null;
  next: { name: string; at: Date } | null;
}

/** Year 9999 and beyond means "until resumed". */
const FOREVER_YEAR = 9000;

export function tooltipFor(state: TrayState, now: Date = new Date()): string {
  if (state.pausedUntil && new Date(state.pausedUntil) > now) {
    const until = new Date(state.pausedUntil);
    return until.getFullYear() >= FOREVER_YEAR
      ? 'Smaran is paused until you resume it'
      : `Smaran is paused until ${format(until, 'HH:mm')}`;
  }
  if (!state.next) return 'Smaran: no reminders scheduled';
  const sameDay = format(state.next.at, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const when = format(state.next.at, sameDay ? 'HH:mm' : 'EEE d MMM, HH:mm');
  return `Smaran: next "${state.next.name}" at ${when}`;
}
