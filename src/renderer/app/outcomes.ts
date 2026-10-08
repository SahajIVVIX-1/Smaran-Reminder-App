import type { Outcome } from '@shared/schema';

export const OUTCOME_LABEL: Record<Outcome, string> = {
  done: 'Done',
  snoozed: 'Snoozed',
  dismissed: 'Dismissed',
  missed: 'Missed',
  skipped: 'Skipped',
};

export const OUTCOME_TONE: Record<Outcome, 'neutral' | 'accent' | 'ok'> = {
  done: 'ok',
  snoozed: 'neutral',
  dismissed: 'neutral',
  missed: 'accent',
  skipped: 'neutral',
};
