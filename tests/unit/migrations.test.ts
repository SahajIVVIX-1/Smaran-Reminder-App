import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@shared/defaults';
import { ConfigSchema, type Config } from '@shared/schema';
import { importV1, isV1Settings, migrate } from '../../src/main/store/migrations';

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'v1', name), 'utf8'));

const opts = () => {
  let n = 0;
  return { newId: () => `id-${++n}`, now: new Date('2026-10-08T09:00:00Z'), primaryDisplayId: 7 };
};

const run = (raw: Record<string, unknown>): Config => {
  const config = importV1(raw, opts());
  expect(ConfigSchema.safeParse(config).success).toBe(true);
  return config;
};

const ruleOf = (raw: Record<string, unknown>) =>
  run({ messages: ['m'], ...raw }).schedules[0]?.rule;

describe('isV1Settings', () => {
  it('recognises v1 files and rejects v2 configs', () => {
    expect(isV1Settings(fixture('smaran_settings.default.json'))).toBe(true);
    expect(isV1Settings({ message_settings: {} })).toBe(true);
    expect(isV1Settings(createDefaultConfig())).toBe(false);
    expect(isV1Settings({ something: 1 })).toBe(false);
    expect(isV1Settings(null)).toBe(false);
    expect(isV1Settings(['a'])).toBe(false);
  });
});

describe('importV1 with a typical v1 file', () => {
  const config = run(fixture('smaran_settings.default.json'));
  const [water, stretch, look] = config.messages;

  it('turns every message into its own message with an id', () => {
    expect(config.messages.map((m) => m.text)).toEqual([
      'Drink some water',
      'Stand up and stretch',
      'Look away from the screen',
    ]);
    expect(new Set(config.messages.map((m) => m.id)).size).toBe(3);
  });

  it('creates one style per distinct look', () => {
    expect(config.styles).toHaveLength(2);
    expect(water?.styleId).toBe(look?.styleId);
    expect(stretch?.styleId).not.toBe(water?.styleId);
    expect(config.styles.filter((s) => s.isDefault)).toHaveLength(1);
  });

  it('maps the global look, replacing the non-Windows default font', () => {
    const main = config.styles.find((s) => s.id === water?.styleId);
    expect(main?.font).toEqual({ family: 'Segoe UI', sizePx: 24, weight: 700, italic: false });
    expect(main?.colors).toEqual({
      text: '#FFFFFFFF',
      background: '#202030E6',
      border: '#7C83FDFF',
    });
    expect(main?.timing).toEqual({ fadeInMs: 500, stayMs: 4000, fadeOutMs: 800 });
    expect(main?.opacity).toBe(0.95);
    expect(main?.size.mode).toBe('auto');
  });

  it('keeps per-message look changes', () => {
    const green = config.styles.find((s) => s.id === stretch?.styleId);
    expect(green?.colors.background).toBe('#2E7D32E6');
    expect(green?.font.sizePx).toBe(28);
  });

  it('keeps dragged positions as exact spots on the primary display', () => {
    expect(water?.overrides).toEqual({ position: { kind: 'exact', displayId: 7, x: 860, y: 40 } });
    expect(stretch?.overrides.position).toEqual({ kind: 'exact', displayId: 7, x: 120, y: 600 });
    expect(look?.overrides).toEqual({});
  });

  it('turns the global schedule into one schedule and continues the message cycle', () => {
    const [schedule] = config.schedules;
    expect(schedule).toMatchObject({
      enabled: true,
      rule: { kind: 'interval', everyMs: 45 * 60_000 },
      burst: { count: 3, gapMs: 5000, overlap: 'skip' },
      picker: { mode: 'sequential' },
    });
    // v1 current_index 1 = "Stand up and stretch" is next, so "Drink some water" was last.
    expect(config.runtime[schedule?.id ?? '']).toMatchObject({
      lastMessageId: water?.id,
      seqIndex: 0,
    });
  });

  it('keeps start-at-login and leaves show-on-startup off', () => {
    expect(config.app.startAtLogin).toBe(true);
    expect(config.app.showOnStartup).toBe(false);
  });
});

describe('importV1 with a messy v1 file', () => {
  const config = run(fixture('smaran_settings.messy.json'));

  it('keeps duplicate texts as separate messages and drops GLOBAL, blank and non-text rows', () => {
    expect(config.messages.map((m) => m.text)).toEqual(['Breathe', 'Breathe', 'Pay rent']);
    const [a, b] = config.messages;
    expect(a?.id).not.toBe(b?.id);
    expect(a?.styleId).toBe(b?.styleId);
  });

  it('falls back or clamps every bad value', () => {
    const breathe = config.styles.find((s) => s.id === config.messages[0]?.styleId);
    const rent = config.styles.find((s) => s.id === config.messages[2]?.styleId);
    expect(breathe?.font.italic).toBe(true);
    expect(rent?.font.italic).toBe(false);
    expect(rent?.colors.text).toBe('#FFFFFFFF'); // "not a colour" → default
    expect(rent?.colors.background).toBe('#FF000080'); // Qt #AARRGGBB → #RRGGBBAA
    expect(rent?.font.sizePx).toBe(200);
    expect(rent?.font.weight).toBe(600);
    expect(rent?.opacity).toBe(0.1);
    expect(config.messages[0]?.overrides).toEqual({}); // position with a non-numeric x is dropped
    expect(config.app.startAtLogin).toBe(true);
  });

  it('clamps the burst and keeps a 29 February yearly schedule', () => {
    const [schedule] = config.schedules;
    expect(schedule?.burst).toMatchObject({ count: 100, gapMs: 0 });
    expect(schedule?.rule).toEqual({ kind: 'yearly', month: 2, day: 29, time: '07:05' });
    expect(config.runtime[schedule?.id ?? '']?.lastMessageId).toBeNull();
  });
});

describe('importV1 schedule modes', () => {
  it('specific time becomes a one-time rule', () => {
    expect(
      ruleOf({ schedule_mode: 'Specific Time', schedule_datetime: '2026-12-01 18:30' }),
    ).toEqual({ kind: 'once', at: '2026-12-01T18:30:00' });
  });

  it('an unreadable specific time falls back to the interval', () => {
    expect(ruleOf({ schedule_mode: 'Specific Time', schedule_datetime: 'soon' })).toEqual({
      kind: 'interval',
      everyMs: 60 * 60_000,
    });
  });

  it('daily, weekly and monthly keep their time and day', () => {
    expect(ruleOf({ schedule_mode: 'Daily', schedule_time: '18:45' })).toEqual({
      kind: 'daily',
      times: ['18:45'],
    });
    expect(ruleOf({ schedule_mode: 'Weekly', schedule_weekday: 'Friday' })).toEqual({
      kind: 'weekly',
      weekdays: [5],
      time: '09:00',
    });
    expect(ruleOf({ schedule_mode: 'Weekly', schedule_weekday: 'Funday' })).toMatchObject({
      weekdays: [1],
    });
    expect(ruleOf({ schedule_mode: 'Monthly', schedule_day: 31 })).toEqual({
      kind: 'monthly',
      day: 31,
      time: '09:00',
    });
  });

  it('bad times become 09:00 and unknown modes become the interval', () => {
    expect(ruleOf({ schedule_mode: 'Daily', schedule_time: '25:00' })).toEqual({
      kind: 'daily',
      times: ['09:00'],
    });
    expect(ruleOf({ schedule_mode: 'Daily', schedule_time: 900 })).toEqual({
      kind: 'daily',
      times: ['09:00'],
    });
    expect(ruleOf({ schedule_mode: 'Hourly-ish', interval_minutes: 20 })).toEqual({
      kind: 'interval',
      everyMs: 20 * 60_000,
    });
  });
});

describe('importV1 edge cases', () => {
  it('a file with no messages still gives a valid config with a disabled schedule', () => {
    const config = run({ message_settings: 'broken' });
    expect(config.messages).toEqual([]);
    expect(config.styles).toHaveLength(1);
    expect(config.styles[0]?.isDefault).toBe(true);
    expect(config.schedules[0]?.enabled).toBe(false);
  });

  it('reads font weight, fixed size and per-message settings that are not objects', () => {
    const config = run({
      messages: ['a', 'b', 'c'],
      font_weight: 700,
      auto_size: false,
      border_color: '#abc',
      message_settings: { a: 'oops', b: { font_weight: 400 }, c: { bold: false } },
    });
    const styleOf = (i: number) => config.styles.find((s) => s.id === config.messages[i]?.styleId);
    expect(styleOf(0)?.font.weight).toBe(700);
    expect(styleOf(0)?.size.mode).toBe('fixed');
    expect(styleOf(0)?.colors.border).toBe('#7C83FDFF');
    expect(styleOf(1)?.font.weight).toBe(400);
    expect(styleOf(2)?.font.weight).toBe(700); // font_weight wins over bold
    expect(run({ messages: ['x'], bold: false }).styles[0]?.font.weight).toBe(600);
  });
});

describe('migrate', () => {
  const o = opts();

  it('converts v1 files', () => {
    const result = migrate(fixture('smaran_settings.default.json'), o);
    expect(result.kind).toBe('migrated');
  });

  it('passes current configs and unreadable content through', () => {
    expect(migrate(createDefaultConfig(), o).kind).toBe('current');
    expect(migrate('text', o)).toEqual({ kind: 'current', raw: 'text' });
  });

  it('flags files from a newer version', () => {
    expect(migrate({ version: 99 }, o)).toEqual({ kind: 'newer', version: 99 });
  });
});
