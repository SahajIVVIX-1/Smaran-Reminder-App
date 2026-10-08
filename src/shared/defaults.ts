import {
  SCHEMA_VERSION,
  type AppSettings,
  type Config,
  type Id,
  type ScheduleRuntime,
  type Style,
  type StyleFields,
} from './schema';

export type NewId = () => Id;

const randomId: NewId = () => crypto.randomUUID();

export const DEFAULT_STYLE_FIELDS: StyleFields = {
  font: { family: 'Segoe UI', sizePx: 22, weight: 600, italic: false },
  colors: { text: '#FFFFFFFF', background: '#1E1E2EE6', border: '#7C83FDFF' },
  border: { widthPx: 2, radiusPx: 14 },
  paddingPx: 18,
  opacity: 1,
  size: { mode: 'auto', widthPx: 420, heightPx: 120, maxWidthPx: 560 },
  timing: { fadeInMs: 400, stayMs: 4000, fadeOutMs: 600 },
  position: { kind: 'anchor', anchor: 'top-center', offsetX: 0, offsetY: 24, display: 'primary' },
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  startAtLogin: true,
  showOnStartup: false,
  theme: 'system',
  respectFocusAssist: true,
  pausedUntil: null,
};

export function createDefaultStyle(newId: NewId = randomId): Style {
  return {
    id: newId(),
    name: 'Default',
    isDefault: true,
    ...structuredClone(DEFAULT_STYLE_FIELDS),
  };
}

export function emptyScheduleRuntime(): ScheduleRuntime {
  return { lastFiredAt: null, seqIndex: 0, lastMessageId: null, shuffleBag: [] };
}

/** First-run config: one default style, one sample message, one hourly schedule. */
export function createDefaultConfig(newId: NewId = randomId, now: Date = new Date()): Config {
  const style = createDefaultStyle(newId);
  const stamp = now.toISOString();
  const messageId = newId();
  const scheduleId = newId();

  return {
    version: SCHEMA_VERSION,
    app: { ...DEFAULT_APP_SETTINGS },
    styles: [style],
    messages: [
      {
        id: messageId,
        text: 'Take a breath and sit up straight.',
        enabled: true,
        tags: [],
        styleId: style.id,
        overrides: {},
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    schedules: [
      {
        id: scheduleId,
        name: 'Every hour',
        enabled: true,
        rule: { kind: 'interval', everyMs: 60 * 60 * 1000 },
        burst: { count: 1, gapMs: 5000, overlap: 'skip' },
        picker: { mode: 'sequential' },
      },
    ],
    runtime: { [scheduleId]: emptyScheduleRuntime() },
  };
}
