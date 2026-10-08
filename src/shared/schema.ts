import { z } from 'zod';

export const SCHEMA_VERSION = 1;

/** Ids are crypto.randomUUID() strings. Nothing is ever keyed by display text or array index. */
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

/** Local wall-clock time, 'HH:mm', 24-hour. */
export const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, for example 09:30');

/** JS Date.getDay() numbering: 0 = Sunday … 6 = Saturday. */
export const WeekdaySchema = z.number().int().min(0).max(6);

/** #RRGGBBAA */
export const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{8}$/, 'Use #RRGGBBAA');

// ---------- Style ----------

export const AnchorSchema = z.enum([
  'top-center',
  'top-left',
  'top-right',
  'center',
  'bottom-left',
  'bottom-right',
  'bottom-center',
]);

export const PlacementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('anchor'),
    anchor: AnchorSchema,
    offsetX: z.number().int(),
    offsetY: z.number().int(),
    display: z.enum(['primary', 'cursor']),
  }),
  z.object({
    kind: z.literal('exact'),
    displayId: z.number().int(),
    // Relative to that display's workArea.
    x: z.number().int(),
    y: z.number().int(),
  }),
]);
export type Placement = z.infer<typeof PlacementSchema>;

const FontSchema = z.object({
  family: z.string().min(1),
  sizePx: z.number().int().min(6).max(200),
  weight: z.union([z.literal(400), z.literal(600), z.literal(700)]),
  italic: z.boolean(),
});

const ColorsSchema = z.object({
  text: ColorSchema,
  background: ColorSchema,
  border: ColorSchema,
});

const BorderSchema = z.object({
  widthPx: z.number().int().min(0).max(50),
  radiusPx: z.number().int().min(0).max(200),
});

const SizeSchema = z.object({
  mode: z.enum(['auto', 'fixed']),
  widthPx: z.number().int().min(50).max(4000),
  heightPx: z.number().int().min(20).max(4000),
  maxWidthPx: z.number().int().min(50).max(4000),
});

const TimingSchema = z.object({
  fadeInMs: z.number().int().min(0).max(10_000),
  stayMs: z.number().int().min(0).max(600_000),
  fadeOutMs: z.number().int().min(0).max(10_000),
});

/** The look of a popup: everything a message can override. */
export const StyleFieldsSchema = z.object({
  font: FontSchema,
  colors: ColorsSchema,
  border: BorderSchema,
  paddingPx: z.number().int().min(0).max(200),
  opacity: z.number().min(0.1).max(1),
  size: SizeSchema,
  timing: TimingSchema,
  position: PlacementSchema,
});
export type StyleFields = z.infer<typeof StyleFieldsSchema>;

export const StyleSchema = StyleFieldsSchema.extend({
  id: IdSchema,
  name: z.string().min(1),
  isDefault: z.boolean(),
});
export type Style = z.infer<typeof StyleSchema>;

/** Deep-partial StyleFields. `position` is replaced as a whole, never merged field by field. */
export const StyleOverridesSchema = z.object({
  font: FontSchema.partial().optional(),
  colors: ColorsSchema.partial().optional(),
  border: BorderSchema.partial().optional(),
  paddingPx: StyleFieldsSchema.shape.paddingPx.optional(),
  opacity: StyleFieldsSchema.shape.opacity.optional(),
  size: SizeSchema.partial().optional(),
  timing: TimingSchema.partial().optional(),
  position: PlacementSchema.optional(),
});
export type StyleOverrides = z.infer<typeof StyleOverridesSchema>;

// ---------- Message ----------

export const MessageSchema = z.object({
  id: IdSchema,
  text: z.string().min(1),
  enabled: z.boolean(),
  tags: z.array(z.string().min(1)),
  styleId: IdSchema,
  overrides: StyleOverridesSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Message = z.infer<typeof MessageSchema>;

// ---------- Schedule ----------

export const RuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('interval'),
    everyMs: z.number().int().min(60_000),
    // If from > to the window runs overnight (for example 22:00 → 06:00).
    activeHours: z
      .object({ from: TimeSchema, to: TimeSchema })
      .refine((h) => h.from !== h.to, 'Active hours need a different start and end')
      .optional(),
    weekdays: z.array(WeekdaySchema).min(1).optional(),
  }),
  // Local date-time without offset, for example 2026-10-08T09:00
  z.object({ kind: z.literal('once'), at: z.iso.datetime({ local: true }) }),
  z.object({ kind: z.literal('daily'), times: z.array(TimeSchema).min(1) }),
  z.object({
    kind: z.literal('weekly'),
    weekdays: z.array(WeekdaySchema).min(1),
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

export const BurstSchema = z.object({
  count: z.number().int().min(1).max(100),
  gapMs: z.number().int().min(0).max(86_400_000),
  overlap: z.enum(['queue', 'skip', 'replace']),
});
export type Burst = z.infer<typeof BurstSchema>;

export const PickerSchema = z
  .object({
    mode: z.enum(['sequential', 'random', 'shuffle', 'fixed']),
    messageId: IdSchema.optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .refine((p) => p.mode !== 'fixed' || p.messageId !== undefined, {
    message: 'Pick the message this schedule shows',
    path: ['messageId'],
  });
export type Picker = z.infer<typeof PickerSchema>;

export const ScheduleSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  enabled: z.boolean(),
  rule: RuleSchema,
  burst: BurstSchema,
  picker: PickerSchema,
});
export type Schedule = z.infer<typeof ScheduleSchema>;

// ---------- Runtime (written by the scheduler, never by the UI) ----------

export const ScheduleRuntimeSchema = z.object({
  lastFiredAt: z.iso.datetime({ offset: true }).nullable(),
  /** Position of the last sequential pick in the full message list; a hint for when that message is deleted. */
  seqIndex: z.number().int().min(0),
  /** Id of the last message picked, so sequential order survives reordering and deletion. */
  lastMessageId: IdSchema.nullable().default(null),
  shuffleBag: z.array(IdSchema),
  done: z.boolean().optional(),
});
export type ScheduleRuntime = z.infer<typeof ScheduleRuntimeSchema>;

export const RuntimeStateSchema = z.record(IdSchema, ScheduleRuntimeSchema);
export type RuntimeState = z.infer<typeof RuntimeStateSchema>;

// ---------- App + Config ----------

export const AppSettingsSchema = z.object({
  startAtLogin: z.boolean(),
  showOnStartup: z.boolean(),
  theme: z.enum(['system', 'dark', 'light']),
  respectFocusAssist: z.boolean(),
  /** ISO time; "until resumed" is stored as a far-future date. */
  pausedUntil: z.iso.datetime({ offset: true }).nullable(),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup];
}

export const ConfigSchema = z
  .object({
    version: z.number().int().min(1),
    app: AppSettingsSchema,
    styles: z.array(StyleSchema).min(1, 'Keep at least one style'),
    messages: z.array(MessageSchema),
    schedules: z.array(ScheduleSchema),
    runtime: RuntimeStateSchema,
  })
  .superRefine((config, ctx) => {
    const defaults = config.styles.filter((s) => s.isDefault).length;
    if (defaults !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['styles'],
        message: `Exactly one style must be the default (found ${defaults})`,
      });
    }

    const allIds = [
      ...config.styles.map((s) => s.id),
      ...config.messages.map((m) => m.id),
      ...config.schedules.map((s) => s.id),
    ];
    for (const id of duplicates(allIds)) {
      ctx.addIssue({ code: 'custom', path: [], message: `Id ${id} is used more than once` });
    }

    const styleIds = new Set(config.styles.map((s) => s.id));
    config.messages.forEach((m, i) => {
      if (!styleIds.has(m.styleId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['messages', i, 'styleId'],
          message: `Message uses a style that does not exist (${m.styleId})`,
        });
      }
    });
  });
export type Config = z.infer<typeof ConfigSchema>;
