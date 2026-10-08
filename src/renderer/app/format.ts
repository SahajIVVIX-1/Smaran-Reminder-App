import { differenceInCalendarDays, format } from 'date-fns';

/** "now", "in 5 min", "in 2 h 10 min", "tomorrow at 09:00", "Mon 12 Oct at 09:00". */
export function whenLabel(at: Date, now: Date = new Date()): string {
  const ms = at.getTime() - now.getTime();
  const days = differenceInCalendarDays(at, now);
  if (ms < 60_000) return 'now';
  if (days === 0) {
    const minutes = Math.round(ms / 60_000);
    if (minutes < 60) return `in ${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 || h >= 3 ? `in ${h} h` : `in ${h} h ${m} min`;
  }
  if (days === 1) return `tomorrow at ${format(at, 'HH:mm')}`;
  if (days < 7) return `${format(at, 'EEEE')} at ${format(at, 'HH:mm')}`;
  return format(at, "EEE d MMM 'at' HH:mm");
}

/** "Today", "Yesterday", "Monday 5 October". */
export function dayLabel(at: Date, now: Date = new Date()): string {
  const days = differenceInCalendarDays(now, at);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return format(at, days < 7 ? 'EEEE' : 'EEEE d MMMM');
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const timeOf = (at: Date) => format(at, 'HH:mm');
