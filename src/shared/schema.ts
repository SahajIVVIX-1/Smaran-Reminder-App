import { z } from 'zod';

/**
 * Config format version. 1 = Smaran 2.0 (messages/styles/schedules), 2 = 2.1 (reminders),
 * 3 = 2.2 (per-reminder sound, new defaults), 4 = 2.8 (Anthropic Sans as the default text font),
 * 5 = 2.13 (Anthropic Serif as the default text font), 6 = 2.14 (automations).
 */
export const SCHEMA_VERSION = 6;

/** Ids are crypto.randomUUID() strings. Nothing is keyed by display text or array index. */
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

/** Local wall-clock time, 'HH:mm', 24-hour. */
export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:30');

/** JS Date.getDay() numbering: 0 = Sunday … 6 = Saturday. */
export const WeekdaySchema = z.number().int().min(0).max(6);

// ---------- When ----------

export const RuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('interval'),
    everyMs: z.number().int().min(60_000),
    // If from > to the window runs overnight (for example 22:00 → 06:00).
    activeHours: z
      .object({ from: TimeSchema, to: TimeSchema })
      .refine((h) => h.from !== h.to, 'Start and end must differ')
      .optional(),
    weekdays: z.array(WeekdaySchema).min(1, 'Pick at least one day').optional(),
  }),
  // Local date-time without offset, for example 2026-10-08T09:00:00
  z.object({ kind: z.literal('once'), at: z.iso.datetime({ local: true }) }),
  z.object({ kind: z.literal('daily'), times: z.array(TimeSchema).min(1, 'Add a time') }),
  z.object({
    kind: z.literal('weekly'),
    weekdays: z.array(WeekdaySchema).min(1, 'Pick at least one day'),
    time: TimeSchema,
  }),
  z.object({
    kind: z.literal('monthly'),
    day: z.union([z.number().int().min(1).max(31), z.literal('last')]),
    time: TimeSchema,
  }),
  z.object({
    kind: z.literal('yearly'),
    month: z.number().int().min(1).max(12), // 1 = January
    day: z.number().int().min(1).max(31),
    time: TimeSchema,
  }),
]);
export type Rule = z.infer<typeof RuleSchema>;

/** Interval reminders follow a rhythm; every other kind is a time of day. */
export function isTimeOfDay(rule: Rule): boolean {
  return rule.kind !== 'interval';
}

// ---------- Notification card shape ----------

/** Notification card width for each size preset (px), unless a custom width is set. */
export const CARD_WIDTH = { compact: 308, comfortable: 340, large: 384 } as const;
/** Slider ranges for the custom card shape: [min, max] in px. */
export const CARD_LIMITS = {
  width: [200, 560],
  height: [30, 200],
  radius: [0, 32],
  padding: [4, 28],
} as const;
export const CARD_RADIUS_DEFAULT = 18;
export const CARD_PADDING_DEFAULT = 12;

/** A notification card's shape. width/height/radius/padding null = auto. */
export const CardShapeSchema = z.object({
  width: z.number().int().min(CARD_LIMITS.width[0]).max(CARD_LIMITS.width[1]).nullable(),
  height: z.number().int().min(CARD_LIMITS.height[0]).max(CARD_LIMITS.height[1]).nullable(),
  radius: z.number().int().min(CARD_LIMITS.radius[0]).max(CARD_LIMITS.radius[1]).nullable(),
  padding: z.number().int().min(CARD_LIMITS.padding[0]).max(CARD_LIMITS.padding[1]).nullable().optional(),
});
export type CardShape = z.infer<typeof CardShapeSchema>;

// ---------- Reminder ----------

export const COLORS = ['clay', 'amber', 'olive', 'sage', 'sky', 'iris', 'rose', 'slate'] as const;
export const ColorSchema = z.enum(COLORS);
export type ReminderColor = z.infer<typeof ColorSchema>;

export const ReminderSchema = z.object({
  id: IdSchema,
  title: z.string().trim().min(1, 'Give the reminder a title').max(200),
  note: z.string().max(2000),
  /** Optional lines shown one per notification, for affirmations, stretches and the like. */
  lines: z.array(z.string().trim().min(1).max(500)).max(200),
  lineOrder: z.enum(['inOrder', 'shuffle']),
  enabled: z.boolean(),
  rule: RuleSchema,
  priority: z.enum(['normal', 'important']),
  /** Seconds a normal notification stays before hiding itself; null = the app default. */
  hideAfterSec: z.number().int().min(3).max(600).nullable(),
  /** If ignored, remind again every `everyMin` minutes, at most `times` more times. */
  followUp: z.object({
    enabled: z.boolean(),
    everyMin: z.number().int().min(1).max(240),
    times: z.number().int().min(1).max(20),
  }),
  color: ColorSchema,
  /** Chime when it appears: follow the app setting, or always / never for this reminder. */
  sound: z.enum(['default', 'on', 'off']),
  /** The Smaran dots on its notification: 'auto' (dance and form shapes) or one animation's key. */
  animation: z.string().min(1).max(60),
  /** This reminder's own notification shape; absent = the one in Settings. */
  card: CardShapeSchema.optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Reminder = z.infer<typeof ReminderSchema>;

// ---------- Settings ----------

export const CORNERS = [
  'top-right',
  'bottom-right',
  'top-left',
  'bottom-left',
  'top-center',
] as const;

const FamiliesSchema = z.array(z.string().min(1).max(60)).max(30);

export const LogoSettingsSchema = z.object({
  /** Let the title-bar dots move at all. */
  animate: z.boolean(),
  /** 'auto': dance and form shapes in turn; 'scene': play one chosen animation. */
  mode: z.enum(['auto', 'scene']),
  /** The animation shown in 'scene' mode. */
  scene: z.string().min(1).max(60),
  /** Shape families auto mode cycles through; empty = everyday shapes. */
  families: FamiliesSchema,
  /** Dance between shapes in auto mode. */
  dances: z.boolean(),
  speed: z.number().min(0.1).max(2),
  /** Liquid merge where dots touch. */
  liquid: z.boolean(),
  /** Hover grows, press squeezes, click pops. */
  interactive: z.boolean(),
  /** Bell while a reminder shows, check on Done, moon when paused… (title bar and tray). */
  reactToReminders: z.boolean(),
  tray: z.object({
    animate: z.boolean(),
    /** Shape families the tray icon changes between when nothing is happening. */
    families: FamiliesSchema,
    /** Seconds between tray icon changes. */
    everySec: z.number().int().min(10).max(3600),
    /** A short dance when the pointer rests on the tray icon. */
    hoverDance: z.boolean(),
  }),
});
export type LogoSettings = z.infer<typeof LogoSettingsSchema>;

export const SettingsSchema = z.object({
  startAtLogin: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
  notification: z.object({
    corner: z.enum(CORNERS),
    screen: z.enum(['primary', 'cursor']),
    size: z.enum(['compact', 'comfortable', 'large']),
    sound: z.boolean(),
    hideAfterSec: z.number().int().min(3).max(600),
    /** Every notification card's shape (a reminder can override it). */
    card: CardShapeSchema,
  }),
  quietHours: z
    .object({ enabled: z.boolean(), from: TimeSchema, to: TimeSchema })
    .refine((q) => q.from !== q.to, { message: 'Start and end must differ', path: ['to'] }),
  /** Hold normal notifications while a full-screen app, game or presentation is showing. */
  holdWhenBusy: z.boolean(),
  /** Font family for the app and notifications. */
  font: z.string().trim().min(1).max(200),
  /** ISO time; "until resumed" is stored as a far-future date. */
  pausedUntil: z.iso.datetime({ offset: true }).nullable(),
  onboarded: z.boolean(),
  /** The Smaran dots: title-bar logo and tray icon. */
  logo: LogoSettingsSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

// ---------- Automation ----------

/** What Smaran can notice while it runs. 'idle' and 'active' use the trigger's idleMin. */
export const WINDOWS_EVENTS = [
  'lock',
  'unlock',
  'sleep',
  'wake',
  'pluggedIn',
  'onBattery',
  'idle',
  'active',
] as const;
export type WindowsEvent = (typeof WINDOWS_EVENTS)[number];

export const TriggerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('start'),
    /** 'boot': first sign-in after the PC starts; 'signIn': any sign-in; 'smaran': Smaran opens. */
    when: z.enum(['boot', 'signIn', 'smaran']),
    delaySec: z.number().int().min(0).max(3600),
  }),
  z.object({ kind: z.literal('schedule'), rule: RuleSchema }),
  z.object({
    kind: z.literal('event'),
    event: z.enum(WINDOWS_EVENTS),
    idleMin: z.number().int().min(1).max(240),
  }),
]);
export type Trigger = z.infer<typeof TriggerSchema>;

export const POWER_ACTIONS = [
  'lock',
  'signOut',
  'sleep',
  'hibernate',
  'shutdown',
  'restart',
] as const;
export type PowerAction = (typeof POWER_ACTIONS)[number];

export const ActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('power'), power: z.enum(POWER_ACTIONS) }),
  z.object({
    kind: z.literal('open'),
    /** What the user picked it as; only changes the file picker and the wording. */
    what: z.enum(['app', 'file', 'script']),
    path: z.string().trim().min(1, 'Choose a file or app to open').max(1000),
    /** Command-line arguments for apps and scripts. */
    args: z.string().max(2000),
    /** Scripts: run without a console window. */
    hidden: z.boolean(),
  }),
  z.object({
    kind: z.literal('link'),
    url: z
      .string()
      .trim()
      .max(2000)
      .regex(/^https?:\/\/\S+$/i, 'Use a link that starts with http:// or https://'),
    /** Browser exe; empty = the default browser. */
    browser: z.string().max(1000),
    /** A private (incognito) window, where the browser supports it. */
    private: z.boolean(),
  }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const StepSchema = z.object({
  action: ActionSchema,
  /** Seconds to wait before this step. */
  waitSec: z.number().int().min(0).max(3600),
});
export type Step = z.infer<typeof StepSchema>;

export const AutomationSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1, 'Give the automation a name').max(200),
  enabled: z.boolean(),
  trigger: TriggerSchema,
  steps: z.array(StepSchema).min(1, 'Add at least one action').max(20),
  /** Seconds a Cancel card shows before sign out, sleep, hibernate, shut down or restart; 0 = none. */
  warnSec: z.number().int().min(0).max(600),
  /** Skip while reminders are paused or during quiet hours. */
  respectPause: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Automation = z.infer<typeof AutomationSchema>;

/** Power actions that end what you're doing, so they get the Cancel card. */
export function isDisruptive(action: Action): boolean {
  return action.kind === 'power' && action.power !== 'lock';
}

// ---------- Runtime state (written by the engine, never by the UI) ----------

export const ReminderStateSchema = z.object({
  /** Last time it was due (and handled: shown, held, skipped or missed). */
  lastDueAt: z.iso.datetime({ offset: true }).nullable(),
  /** Index of the next rotating line (in order), or the shuffle bag of remaining indexes. */
  nextLine: z.number().int().min(0),
  shuffleBag: z.array(z.number().int().min(0)),
  snoozedUntil: z.iso.datetime({ offset: true }).nullable(),
  /** A one-time reminder that has been handled. */
  completed: z.boolean(),
});
export type ReminderState = z.infer<typeof ReminderStateSchema>;

// ---------- Config ----------

export const ConfigSchema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    settings: SettingsSchema,
    reminders: z.array(ReminderSchema),
    state: z.record(IdSchema, ReminderStateSchema),
    automations: z.array(AutomationSchema),
  })
  .superRefine((config, ctx) => {
    // Reminders and automations share History, so their ids must not collide either.
    const seen = new Set<string>();
    const check = (list: 'reminders' | 'automations', id: string, i: number) => {
      if (seen.has(id)) {
        ctx.addIssue({ code: 'custom', path: [list, i, 'id'], message: `Id ${id} is used twice` });
      }
      seen.add(id);
    };
    config.reminders.forEach((r, i) => check('reminders', r.id, i));
    config.automations.forEach((a, i) => check('automations', a.id, i));
  });
export type Config = z.infer<typeof ConfigSchema>;

// ---------- History (separate file, written by the engine) ----------

export const OUTCOMES = [
  'done',
  'snoozed',
  'dismissed',
  'missed',
  'skipped',
  // Automations:
  'ran',
  'failed',
  'cancelled',
] as const;

export const HistoryEntrySchema = z.object({
  id: IdSchema,
  /** The reminder, or the automation for 'ran', 'failed' and 'cancelled' (and its 'skipped'). */
  reminderId: IdSchema,
  title: z.string(),
  /** When it was due. */
  dueAt: z.iso.datetime({ offset: true }),
  /** When the outcome happened. */
  at: z.iso.datetime({ offset: true }),
  outcome: z.enum(OUTCOMES),
  /** Short plain-English detail, e.g. "Snoozed 15 min", "Quiet hours". */
  detail: z.string().optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
export type Outcome = HistoryEntry['outcome'];
