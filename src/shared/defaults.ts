import {
  SCHEMA_VERSION,
  type Config,
  type Id,
  type Reminder,
  type ReminderState,
  type Rule,
  type Settings,
} from './schema';

export type NewId = () => Id;

const randomId: NewId = () => crypto.randomUUID();

/** Stored for "pause until resumed". */
export const PAUSED_FOREVER = '9999-12-31T00:00:00.000Z';

export const DEFAULT_SETTINGS: Settings = {
  startAtLogin: true,
  theme: 'system',
  notification: {
    corner: 'bottom-right',
    screen: 'primary',
    size: 'comfortable',
    sound: true,
    hideAfterSec: 12,
  },
  quietHours: { enabled: false, from: '22:00', to: '07:00' },
  holdWhenBusy: true,
  pausedUntil: null,
  onboarded: false,
};

export function emptyState(): ReminderState {
  return { lastDueAt: null, nextLine: 0, shuffleBag: [], snoozedUntil: null, completed: false };
}

export interface NewReminderInput {
  title: string;
  rule: Rule;
  note?: string;
  lines?: string[];
}

export function createReminder(
  input: NewReminderInput,
  newId: NewId = randomId,
  now: Date = new Date(),
): Reminder {
  const stamp = now.toISOString();
  return {
    id: newId(),
    title: input.title,
    note: input.note ?? '',
    lines: input.lines ?? [],
    lineOrder: 'inOrder',
    enabled: true,
    rule: input.rule,
    priority: 'normal',
    hideAfterSec: null,
    followUp: { enabled: false, everyMin: 10, times: 2 },
    color: 'clay',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** First run: two gentle examples the user can edit or delete. */
export function createDefaultConfig(newId: NewId = randomId, now: Date = new Date()): Config {
  const water = {
    ...createReminder(
      {
        title: 'Drink some water',
        rule: {
          kind: 'interval',
          everyMs: 60 * 60_000,
          activeHours: { from: '09:00', to: '18:00' },
        },
      },
      newId,
      now,
    ),
    color: 'sky' as const,
  };
  const stretch = {
    ...createReminder(
      {
        title: 'Stand up and stretch',
        rule: {
          kind: 'interval',
          everyMs: 45 * 60_000,
          activeHours: { from: '09:00', to: '18:00' },
          weekdays: [1, 2, 3, 4, 5],
        },
        lines: [
          'Roll your shoulders back',
          'Look at something far away for 20 seconds',
          'Take three slow breaths',
        ],
      },
      newId,
      now,
    ),
    color: 'sage' as const,
  };
  return {
    version: SCHEMA_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    reminders: [water, stretch],
    state: { [water.id]: emptyState(), [stretch.id]: emptyState() },
  };
}
