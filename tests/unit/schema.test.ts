import { describe, expect, it } from 'vitest';
import {
  createDefaultConfig,
  createDefaultStyle,
  DEFAULT_APP_SETTINGS,
  emptyScheduleRuntime,
} from '@shared/defaults';
import {
  ConfigSchema,
  PickerSchema,
  RuleSchema,
  ScheduleRuntimeSchema,
  SCHEMA_VERSION,
  StyleSchema,
  type Config,
} from '@shared/schema';

let counter = 0;
const nextId = () => `id-${++counter}`;
const config = (): Config => createDefaultConfig(nextId, new Date('2026-10-08T09:00:00Z'));

function messagesOf(result: ReturnType<typeof ConfigSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('defaults', () => {
  it('produce a valid config', () => {
    const c = config();
    expect(ConfigSchema.parse(c)).toEqual(c);
    expect(c.version).toBe(SCHEMA_VERSION);
    expect(c.app).toEqual(DEFAULT_APP_SETTINGS);
    expect(c.app.showOnStartup).toBe(false);
    expect(c.messages[0]?.styleId).toBe(c.styles[0]?.id);
  });

  it('use random UUIDs and the current time when none are given', () => {
    const c = createDefaultConfig();
    expect(c.styles[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ConfigSchema.safeParse(c).success).toBe(true);
    expect(createDefaultStyle().isDefault).toBe(true);
  });

  it('start each schedule with an empty runtime', () => {
    expect(emptyScheduleRuntime()).toEqual({
      lastFiredAt: null,
      seqIndex: 0,
      lastMessageId: null,
      shuffleBag: [],
    });
  });
});

describe('ConfigSchema rules', () => {
  it('requires exactly one default style', () => {
    const none = config();
    none.styles = none.styles.map((s) => ({ ...s, isDefault: false }));
    expect(messagesOf(ConfigSchema.safeParse(none))).toContain(
      'Exactly one style must be the default (found 0)',
    );

    const two = config();
    two.styles.push({ ...createDefaultStyle(nextId), name: 'Second' });
    expect(messagesOf(ConfigSchema.safeParse(two))).toContain(
      'Exactly one style must be the default (found 2)',
    );
  });

  it('rejects duplicate ids across styles, messages and schedules', () => {
    const c = config();
    const msg = c.messages[0];
    if (!msg) throw new Error('fixture');
    c.messages.push({ ...msg, styleId: msg.styleId });
    expect(messagesOf(ConfigSchema.safeParse(c))).toContain(`Id ${msg.id} is used more than once`);
  });

  it('rejects messages pointing at a missing style', () => {
    const c = config();
    const msg = c.messages[0];
    if (!msg) throw new Error('fixture');
    msg.styleId = 'nope';
    expect(messagesOf(ConfigSchema.safeParse(c))).toContain(
      'Message uses a style that does not exist (nope)',
    );
  });

  it('requires at least one style', () => {
    const c = config();
    c.styles = [];
    c.messages = [];
    expect(messagesOf(ConfigSchema.safeParse(c))).toContain('Keep at least one style');
  });
});

describe('field schemas', () => {
  it('validate colours as #RRGGBBAA', () => {
    const s = createDefaultStyle(nextId);
    expect(StyleSchema.safeParse(s).success).toBe(true);
    expect(StyleSchema.safeParse({ ...s, colors: { ...s.colors, text: '#fff' } }).success).toBe(
      false,
    );
  });

  it('validate HH:mm times and rule shapes', () => {
    expect(RuleSchema.safeParse({ kind: 'daily', times: ['09:00'] }).success).toBe(true);
    expect(RuleSchema.safeParse({ kind: 'daily', times: ['24:00'] }).success).toBe(false);
    expect(RuleSchema.safeParse({ kind: 'daily', times: [] }).success).toBe(false);
    expect(RuleSchema.safeParse({ kind: 'monthly', day: 'last', time: '09:00' }).success).toBe(
      true,
    );
    expect(RuleSchema.safeParse({ kind: 'once', at: '2026-10-08T09:00:00' }).success).toBe(true);
  });

  it('reject active hours that start and end at the same time', () => {
    const rule = {
      kind: 'interval',
      everyMs: 3_600_000,
      activeHours: { from: '09:00', to: '09:00' },
    };
    expect(RuleSchema.safeParse(rule).success).toBe(false);
  });

  it('require a message id for fixed pickers', () => {
    expect(PickerSchema.safeParse({ mode: 'fixed' }).success).toBe(false);
    expect(PickerSchema.safeParse({ mode: 'fixed', messageId: 'm' }).success).toBe(true);
  });

  it('fill lastMessageId for runtime saved without it', () => {
    const parsed = ScheduleRuntimeSchema.parse({ lastFiredAt: null, seqIndex: 2, shuffleBag: [] });
    expect(parsed.lastMessageId).toBeNull();
  });
});
