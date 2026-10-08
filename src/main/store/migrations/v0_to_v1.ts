// Imports a Smaran v1 (Python) `smaran_settings.json` into a v2 config.
//
// Assumed v1 shape (reconstructed from the v1 audit; see tests/fixtures/v1/README.md):
//   messages: string[]                       the message pool, in order
//   current_index: number                    next message to show
//   <look keys> at the top level             global look
//   message_settings: { [text]: <look keys> & { position?: {x, y} } }   per-message look, keyed by text
//   interval_minutes, burst_count, burst_gap_seconds,
//   schedule_mode: Interval | Specific Time | Daily | Weekly | Monthly | Yearly,
//   schedule_time 'H:mm', schedule_datetime 'YYYY-MM-DD HH:mm', schedule_weekday, schedule_day, schedule_month
//   auto_start: boolean
//
// Every value is read defensively: anything missing or invalid falls back to the v2 default, and
// numbers are clamped into the v2 ranges, so the result always passes ConfigSchema.

import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_STYLE_FIELDS,
  emptyScheduleRuntime,
  type NewId,
} from '@shared/legacy/defaultsV1';
import {
  SCHEMA_VERSION,
  type Config,
  type Message,
  type Rule,
  type Schedule,
  type Style,
  type StyleFields,
} from '@shared/legacy/schemaV1';

type Raw = Record<string, unknown>;

export interface V1ImportOptions {
  newId: NewId;
  now: Date;
  /** v1 stored positions on the primary screen; they become exact positions on this display. */
  primaryDisplayId: number;
}

/** True if `raw` looks like a v1 Python settings file rather than a v2 config. */
export function isV1Settings(raw: unknown): raw is Raw {
  if (!isObject(raw) || 'version' in raw) return false;
  return 'message_settings' in raw || Array.isArray(raw['messages']);
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** v1 fonts that are not installed on Windows; v2 uses Segoe UI instead. */
const NON_WINDOWS_FONTS = new Set(['calluna sans']);

export function importV1(raw: Raw, opts: V1ImportOptions): Config {
  const stamp = opts.now.toISOString();
  const perMessage = isObject(raw['message_settings']) ? raw['message_settings'] : {};
  const texts = (Array.isArray(raw['messages']) ? raw['messages'] : [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    // "GLOBAL" rows are an artefact of v1's CSV export bug, not real messages.
    .filter((t) => t.length > 0 && t !== 'GLOBAL');

  // One style per distinct look; messages with the same look share it.
  const styles: Style[] = [];
  const styleByLook = new Map<string, Style>();
  const messages: Message[] = texts.map((text) => {
    const own = perMessage[text];
    const ownLook = isObject(own) ? own : {};
    const look = readLook({ ...raw, ...ownLook });
    const key = JSON.stringify(look);
    let style = styleByLook.get(key);
    if (!style) {
      style = {
        id: opts.newId(),
        name: styles.length === 0 ? 'Imported' : `Imported ${styles.length + 1}`,
        isDefault: styles.length === 0,
        ...look,
      };
      styles.push(style);
      styleByLook.set(key, style);
    }
    const position = readPosition(ownLook['position'], opts.primaryDisplayId);
    return {
      id: opts.newId(),
      text,
      enabled: true,
      tags: [],
      styleId: style.id,
      overrides: position ? { position } : {},
      createdAt: stamp,
      updatedAt: stamp,
    };
  });

  if (styles.length === 0) {
    styles.push({ id: opts.newId(), name: 'Imported', isDefault: true, ...readLook(raw) });
  }

  const schedule: Schedule = {
    id: opts.newId(),
    name: 'Imported from v1',
    enabled: messages.length > 0,
    rule: readRule(raw),
    burst: {
      count: int(raw['burst_count'], 1, 1, 100),
      gapMs: int(raw['burst_gap_seconds'], 5, 0, 86_400) * 1000,
      overlap: 'skip',
    },
    picker: { mode: 'sequential' },
  };

  // v1's current_index is the next message to show, so the last one shown sits just before it.
  const runtime = emptyScheduleRuntime();
  const current = int(raw['current_index'], 0, 0, Math.max(0, messages.length - 1));
  const last = current > 0 ? messages[current - 1] : undefined;
  if (last) {
    runtime.lastMessageId = last.id;
    runtime.seqIndex = current - 1;
  }

  return {
    version: SCHEMA_VERSION,
    app: {
      ...DEFAULT_APP_SETTINGS,
      startAtLogin: bool(raw['auto_start'], true),
      // A v1 user already set Smaran up; skip the first-run welcome.
      onboarded: true,
    },
    styles,
    messages,
    schedules: [schedule],
    runtime: { [schedule.id]: runtime },
  };
}

// ---------- look ----------

function readLook(src: Raw): StyleFields {
  const d = DEFAULT_STYLE_FIELDS;
  const family = str(src['font_family'], d.font.family);
  const bgAlpha = int(src['bg_opacity'], 255, 0, 255);
  return {
    font: {
      family: NON_WINDOWS_FONTS.has(family.toLowerCase()) ? 'Segoe UI' : family,
      sizePx: int(src['font_size'], d.font.sizePx, 6, 200),
      weight: readWeight(src),
      italic: bool(src['italic'], d.font.italic),
    },
    colors: {
      text: color(src['text_color'], d.colors.text),
      background: color(src['bg_color'], d.colors.background, bgAlpha),
      border: color(src['border_color'], d.colors.border),
    },
    border: {
      widthPx: int(src['border_width'], d.border.widthPx, 0, 50),
      radiusPx: int(src['border_radius'], d.border.radiusPx, 0, 200),
    },
    paddingPx: int(src['padding'], d.paddingPx, 0, 200),
    opacity: clamp(num(src['opacity'], d.opacity), 0.1, 1),
    size: {
      mode: bool(src['auto_size'], true) ? 'auto' : 'fixed',
      widthPx: int(src['width'], d.size.widthPx, 50, 4000),
      heightPx: int(src['height'], d.size.heightPx, 20, 4000),
      maxWidthPx: d.size.maxWidthPx,
    },
    timing: {
      fadeInMs: int(src['fade_in_ms'], d.timing.fadeInMs, 0, 10_000),
      stayMs: int(src['display_ms'], d.timing.stayMs, 0, 600_000),
      fadeOutMs: int(src['fade_out_ms'], d.timing.fadeOutMs, 0, 10_000),
    },
    position: { ...d.position },
  };
}

function readWeight(src: Raw): 400 | 600 | 700 {
  const weight = num(src['font_weight'], NaN);
  if (!Number.isNaN(weight)) return weight >= 700 ? 700 : weight >= 600 ? 600 : 400;
  return bool(src['bold'], false) ? 700 : DEFAULT_STYLE_FIELDS.font.weight;
}

function readPosition(value: unknown, displayId: number): Message['overrides']['position'] {
  if (!isObject(value)) return undefined;
  const { x, y } = value;
  if (typeof x !== 'number' || typeof y !== 'number') return undefined;
  return { kind: 'exact', displayId, x: Math.round(x), y: Math.round(y) };
}

/**
 * Qt colour names: '#RRGGBB' (alpha from `alpha` if given) or '#AARRGGBB' (QColor HexArgb).
 * Returns v2 '#RRGGBBAA'.
 */
function color(value: unknown, fallback: string, alpha = 255): string {
  if (typeof value !== 'string') return fallback;
  const hex = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(hex)) return hex + alpha.toString(16).padStart(2, '0').toUpperCase();
  if (/^#[0-9A-F]{8}$/.test(hex)) return `#${hex.slice(3)}${hex.slice(1, 3)}`;
  return fallback;
}

// ---------- schedule ----------

function readRule(raw: Raw): Rule {
  const time = readTime(raw['schedule_time']);
  const mode = str(raw['schedule_mode'], 'Interval').toLowerCase();
  const fallback: Rule = {
    kind: 'interval',
    everyMs: int(raw['interval_minutes'], 60, 1, 10_080) * 60_000,
  };

  switch (mode) {
    case 'specific time': {
      const at = str(raw['schedule_datetime'], '').trim().replace(' ', 'T');
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)
        ? { kind: 'once', at: `${at}:00` }
        : fallback;
    }
    case 'daily':
      return { kind: 'daily', times: [time] };
    case 'weekly': {
      const day = WEEKDAYS.indexOf(str(raw['schedule_weekday'], '').toLowerCase());
      return { kind: 'weekly', weekdays: [day >= 0 ? day : 1], time };
    }
    case 'monthly':
      return { kind: 'monthly', day: int(raw['schedule_day'], 1, 1, 31), time };
    case 'yearly':
      return {
        kind: 'yearly',
        month: int(raw['schedule_month'], 1, 1, 12),
        day: int(raw['schedule_day'], 1, 1, 31),
        time,
      };
    default:
      return fallback;
  }
}

/** Accepts 'H:m' variants and returns 'HH:mm'; anything else becomes 09:00. */
function readTime(value: unknown): string {
  const match = typeof value === 'string' ? /^(\d{1,2}):(\d{1,2})$/.exec(value.trim()) : null;
  if (!match) return '09:00';
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return '09:00';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------- readers ----------

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  return clamp(Math.round(num(value, fallback)), min, max);
}
