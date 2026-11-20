export const OUTCOME_LABEL: Record<string, string> = {
  done: 'Done',
  snoozed: 'Snoozed',
  dismissed: 'Dismissed',
  missed: 'Missed',
  skipped: 'Skipped',
  ran: 'Ran',
  failed: 'Failed',
  cancelled: 'Cancelled',
  login: 'Logged In',
  failedLogin: 'Failed Login',
  failed_login: 'Failed Login',
  logout: 'Logged Out',
  server_started: 'Server Started',
  server_stopped: 'Server Stopped',
  config_changed: 'Config Changed',
  adminActivity: 'Admin Activity',
};

/** Outcomes only automations have. */
export const AUTOMATION_OUTCOMES: readonly string[] = ['ran', 'failed', 'cancelled'];

export const OUTCOME_TONE: Record<string, 'neutral' | 'accent' | 'ok'> = {
  done: 'ok',
  snoozed: 'neutral',
  dismissed: 'neutral',
  missed: 'accent',
  skipped: 'neutral',
  ran: 'ok',
  failed: 'accent',
  cancelled: 'neutral',
  login: 'ok',
  failedLogin: 'accent',
  failed_login: 'accent',
  logout: 'neutral',
  server_started: 'ok',
  server_stopped: 'neutral',
  config_changed: 'accent',
  adminActivity: 'accent',
};
