import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_STYLE_FIELDS,
  emptyScheduleRuntime,
} from '@shared/legacy/defaultsV1';
import type { Config, RuntimeState } from '@shared/legacy/schemaV1';

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Merges defaults under `value` one level deep per group, so a partial file keeps nested defaults. */
function withDefaults(defaults: object, value: unknown): unknown {
  if (!isObject(value)) return value ?? defaults;
  const out: Raw = { ...defaults, ...value };
  for (const [key, def] of Object.entries(defaults)) {
    if (isObject(def) && isObject(value[key]) && key !== 'position') {
      out[key] = { ...def, ...value[key] };
    }
  }
  return out;
}

/**
 * Fills fields an older or hand-edited file left out, before validation.
 * Only adds missing keys; values that are present but wrong still fail validation.
 */
export function fillDefaults(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  return {
    ...raw,
    app: withDefaults(DEFAULT_APP_SETTINGS, raw['app']),
    styles: list(raw['styles']).map((s) => withDefaults(DEFAULT_STYLE_FIELDS, s)),
    messages: list(raw['messages']).map((m) =>
      isObject(m) ? { tags: [], overrides: {}, enabled: true, ...m } : m,
    ),
    schedules: list(raw['schedules']),
    runtime: isObject(raw['runtime']) ? raw['runtime'] : {},
  };
}

/** Gives every schedule a runtime entry and drops entries for schedules that no longer exist. */
export function reconcileRuntime(config: Config): Config {
  const runtime: RuntimeState = {};
  for (const schedule of config.schedules) {
    runtime[schedule.id] = config.runtime[schedule.id] ?? emptyScheduleRuntime();
  }
  return { ...config, runtime };
}
