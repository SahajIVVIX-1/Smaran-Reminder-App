import type { Outcome } from '@shared/schema';

export const OUTCOME_LABEL: Record<Outcome, string> = {
  done: 'Done',
  snoozed: 'Snoozed',
  dismissed: 'Dismissed',
  missed: 'Missed',
  skipped: 'Skipped',
  ran: 'Ran',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** Outcomes only automations have. */
export const AUTOMATION_OUTCOMES: readonly Outcome[] = ['ran', 'failed', 'cancelled'];

export const OUTCOME_TONE: Record<Outcome, 'neutral' | 'accent' | 'ok'> = {
  done: 'ok',
  snoozed: 'neutral',
  dismissed: 'neutral',
  missed: 'accent',
  skipped: 'neutral',
  ran: 'ok',
  failed: 'accent',
  cancelled: 'neutral',
};
