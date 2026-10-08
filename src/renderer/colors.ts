import type { ReminderColor } from '@shared/schema';

// Full class names so Tailwind can see them.
export const COLOR_BG: Record<ReminderColor, string> = {
  clay: 'bg-c-clay',
  amber: 'bg-c-amber',
  olive: 'bg-c-olive',
  sage: 'bg-c-sage',
  sky: 'bg-c-sky',
  iris: 'bg-c-iris',
  rose: 'bg-c-rose',
  slate: 'bg-c-slate',
};

export const COLOR_NAME: Record<ReminderColor, string> = {
  clay: 'Clay',
  amber: 'Amber',
  olive: 'Olive',
  sage: 'Sage',
  sky: 'Sky',
  iris: 'Iris',
  rose: 'Rose',
  slate: 'Slate',
};
