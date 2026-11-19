import {
  DEFAULT_NOTIFICATION_MOTION,
  SCHEMA_VERSION,
  type Action,
  type Automation,
  type Config,
  type Id,
  type Reminder,
  type ReminderState,
  type Rule,
  type Settings,
  type Trigger,
} from './schema';
import { DEFAULT_FONT } from './fonts';

export type NewId = () => Id;

const randomId: NewId = () => crypto.randomUUID();

/** Stored for "pause until resumed". */
export const PAUSED_FOREVER = '9999-12-31T00:00:00.000Z';

export const DEFAULT_SETTINGS: Settings = {
  startAtLogin: true,
  theme: 'dark',
  notification: {
    corner: 'top-center',
    screen: 'primary',
    size: 'comfortable',
    sound: true,
    hideAfterSec: 8,
    card: { width: null, height: null, radius: null, padding: null },
    motion: DEFAULT_NOTIFICATION_MOTION,
    borderLight: true,
    borderLightThickness: 4,
    borderLightBrightness: 150,
  },
  quietHours: { enabled: false, from: '22:00', to: '07:00' },
  holdWhenBusy: true,
  font: DEFAULT_FONT,
  pausedUntil: null,
  onboarded: false,
  logo: {
    animate: true,
    mode: 'auto',
    scene: 's-mark',
    families: [],
    dances: true,
    speed: 1,
    liquid: false,
    interactive: true,
    reactToReminders: true,
    tray: { animate: true, families: ['Science & symbols'], everySec: 30, hoverDance: true },
  },
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
    sound: 'default',
    animation: 'auto',
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
    automations: [],
  };
}

/** A sensible starting action when the user picks a kind. */
export function defaultAction(kind: 'power' | 'app' | 'file' | 'script' | 'link'): Action {
  switch (kind) {
    case 'power':
      return { kind: 'power', power: 'lock' };
    case 'link':
      return { kind: 'link', url: 'https://', browser: '', private: false };
    default:
      return { kind: 'open', what: kind, path: '', args: '', hidden: false };
  }
}

export function createAutomation(
  input: { name: string; trigger: Trigger; actions: Action[] },
  newId: NewId = randomId,
  now: Date = new Date(),
): Automation {
  const stamp = now.toISOString();
  return {
    id: newId(),
    name: input.name,
    enabled: true,
    trigger: input.trigger,
    steps: input.actions.map((action) => ({ action, waitSec: 0 })),
    warnSec: 30,
    respectPause: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
}
