import { DEFAULT_SETTINGS, emptyState } from '@shared/defaults';
import type { Config, ReminderState } from '@shared/schema';

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merges defaults under `value` (objects only), so a partial file keeps nested defaults. */
function withDefaults(defaults: unknown, value: unknown): unknown {
  if (value === undefined) return defaults;
  if (!isObject(defaults) || !isObject(value)) return value;
  const out: Raw = { ...defaults };
  for (const [key, v] of Object.entries(value)) out[key] = withDefaults(defaults[key], v);
  return out;
}

const REMINDER_DEFAULTS = {
  note: '',
  lines: [],
  lineOrder: 'inOrder',
  enabled: true,
  priority: 'normal',
  hideAfterSec: null,
  followUp: { enabled: false, everyMin: 10, times: 2 },
  color: 'clay',
  sound: 'default',
  animation: 'auto',
  attachments: [],
};

const AUTOMATION_DEFAULTS = { enabled: true, warnSec: 30, respectPause: false };

/**
 * Fills fields an older or hand-edited file left out, before validation.
 * Only adds missing keys; values that are present but wrong still fail validation.
 */
export function fillDefaults(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return {
    ...raw,
    settings: withDefaults(DEFAULT_SETTINGS, raw['settings']),
    reminders: (Array.isArray(raw['reminders']) ? raw['reminders'] : []).map((r) =>
      withDefaults(REMINDER_DEFAULTS, r),
    ),
    automations: (Array.isArray(raw['automations']) ? raw['automations'] : []).map((a) =>
      withDefaults(AUTOMATION_DEFAULTS, a),
    ),
    state: isObject(raw['state'])
      ? Object.fromEntries(
          Object.entries(raw['state']).map(([k, v]) => [k, withDefaults(emptyState(), v)]),
        )
      : {},
  };
}

/** Gives every reminder a state entry and drops entries for reminders that no longer exist. */
export function reconcileState(config: Config): Config {
  const state: Record<string, ReminderState> = {};
  for (const r of config.reminders) state[r.id] = config.state[r.id] ?? emptyState();
  return { ...config, state };
}
