import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@shared/defaults';
import { createDefaultConfig as createV1Config } from '@shared/legacy/defaultsV1';
import { ConfigSchema as V1Schema, type Config as V1Config } from '@shared/legacy/schemaV1';
import { ConfigSchema } from '@shared/schema';
import { exportJson, mergeReminders, parseBackupJson } from '../../src/main/store/backup';
import { migrate, v1ToV2 } from '../../src/main/store/migrations';

const NOW = new Date('2026-10-08T09:00:00Z');
let n = 0;
const opts = () => ({ newId: () => `new-${++n}`, now: NOW, primaryDisplayId: 1 });
const fixture = (path: string) => readFileSync(join(__dirname, '..', 'fixtures', path), 'utf8');

/** A Smaran 2.0 config with three schedules: fixed, by tag, and all messages in a burst. */
function v1Config(): V1Config {
  let i = 0;
  const c = createV1Config(() => `id-${++i}`, NOW);
  const msg = c.messages[0]!;
  c.messages = [
    { ...msg, id: 'm1', text: 'Drink water' },
    { ...msg, id: 'm2', text: 'Stretch\nRoll your shoulders', tags: ['body'] },
    { ...msg, id: 'm3', text: 'Breathe', tags: ['body'] },
    { ...msg, id: 'm4', text: 'Unused', tags: ['other'], enabled: false },
  ];
  const s = c.schedules[0]!;
  c.schedules = [
    { ...s, id: 's1', name: 'Water', picker: { mode: 'fixed', messageId: 'm1' } },
    {
      ...s,
      id: 's2',
      name: 'Body',
      picker: { mode: 'shuffle', tags: ['body'] },
      burst: { count: 3, gapMs: 120_000, overlap: 'skip' },
    },
    {
      ...s,
      id: 's3',
      name: 'Fixed stretch',
      enabled: false,
      picker: { mode: 'fixed', messageId: 'm2' },
    },
  ];
  c.runtime = {
    s1: {
      lastFiredAt: NOW.toISOString(),
      seqIndex: 0,
      lastMessageId: null,
      shuffleBag: [],
      done: true,
    },
  };
  c.app.theme = 'dark';
  c.app.onboarded = true;
  return V1Schema.parse(c);
}

describe('Smaran 2.0 → 2.1', () => {
  const config = v1ToV2(v1Config(), () => 'leftover', NOW);

  it('produces a valid config', () => {
    expect(ConfigSchema.safeParse(config).success).toBe(true);
    expect(config.settings).toMatchObject({ theme: 'dark', onboarded: true });
  });

  it('turns a single-message schedule into a reminder titled by the message', () => {
    expect(config.reminders[0]).toMatchObject({
      id: 's1',
      title: 'Drink water',
      lines: [],
      enabled: true,
    });
    expect(config.state['s1']).toMatchObject({ lastDueAt: NOW.toISOString(), completed: true });
  });

  it('turns a multi-message schedule into rotating lines, and its burst into a follow-up', () => {
    expect(config.reminders[1]).toMatchObject({
      title: 'Body',
      lines: ['Stretch\nRoll your shoulders', 'Breathe'],
      lineOrder: 'shuffle',
      followUp: { enabled: true, everyMin: 2, times: 2 },
    });
  });

  it('splits a multi-line message into title and note', () => {
    expect(config.reminders[2]).toMatchObject({
      title: 'Stretch',
      note: 'Roll your shoulders',
      enabled: false,
    });
  });

  it('keeps messages no schedule used, in one disabled reminder', () => {
    expect(config.reminders[3]).toMatchObject({
      id: 'leftover',
      title: 'Imported messages',
      lines: ['Unused'],
      enabled: false,
    });
  });

  it('a schedule whose messages are all gone is turned off', () => {
    const old = v1Config();
    old.schedules[0]!.picker = { mode: 'fixed', messageId: 'nope' };
    expect(v1ToV2(old, () => 'x', NOW).reminders[0]).toMatchObject({
      enabled: false,
      title: 'Water',
    });
  });
});

describe('migrate', () => {
  it('upgrades 2.0 configs and v1 files, passes 2.1 through, flags newer and broken files', () => {
    expect(migrate(v1Config(), opts())).toMatchObject({ kind: 'migrated', from: 'Smaran 2.0' });
    expect(migrate(JSON.parse(fixture('v1/smaran_settings.default.json')), opts())).toMatchObject({
      kind: 'migrated',
      from: 'Smaran v1',
    });
    expect(migrate(createDefaultConfig(), opts()).kind).toBe('current');
    expect(migrate('text', opts())).toEqual({ kind: 'current', raw: 'text' });
    expect(migrate({ version: 9 }, opts())).toEqual({ kind: 'newer', version: 9 });
    expect(migrate({ version: 1, styles: [] }, opts()).kind).toBe('invalid');
  });

  it('the shipped 2.0 fixture converts cleanly', () => {
    const result = migrate(JSON.parse(fixture('v2.0/config.json')), opts());
    expect(result.kind).toBe('migrated');
    expect(ConfigSchema.safeParse(result.kind === 'migrated' && result.raw).success).toBe(true);
  });
});

describe('backup', () => {
  it('export → import round-trips byte for byte, ids kept', () => {
    const config = ConfigSchema.parse(createDefaultConfig());
    const text = exportJson(config);
    const back = parseBackupJson(text, opts());
    expect(back.ok && exportJson(back.config)).toBe(text);
    expect(back.ok && back.from).toBeNull();
  });

  it('accepts older formats and says where they came from', () => {
    const back = parseBackupJson(`\uFEFF${JSON.stringify(v1Config())}`, opts());
    expect(back.ok && back.from).toBe('Smaran 2.0');
  });

  it('explains what is wrong with a bad file', () => {
    const notJson = parseBackupJson('nope', opts());
    expect(!notJson.ok && notJson.error).toContain('not valid JSON');
    const newer = parseBackupJson('{"version":42}', opts());
    expect(!newer.ok && newer.error).toContain('newer version of Smaran (format 42)');
    const broken = parseBackupJson('{"version":1,"styles":[]}', opts());
    expect(!broken.ok && broken.error).toContain('not a valid Smaran backup');
    const invalid = parseBackupJson('{"version":2,"reminders":[{"id":"x"}]}', opts());
    expect(!invalid.ok && invalid.error).toContain('not a valid Smaran backup');
  });

  it('adding reminders gives colliding ids new ones and keeps their state', () => {
    const current = createDefaultConfig();
    const imported = structuredClone(current);
    imported.state[imported.reminders[0]!.id] = {
      ...imported.state[imported.reminders[0]!.id]!,
      nextLine: 2,
    };
    const merged = mergeReminders(current, imported, () => crypto.randomUUID());
    expect(merged.reminders).toHaveLength(4);
    expect(new Set(merged.reminders.map((r) => r.id)).size).toBe(4);
    expect(merged.state[merged.reminders[2]!.id]?.nextLine).toBe(2);
    expect(ConfigSchema.safeParse(merged).success).toBe(true);
  });

  it('adding keeps ids that do not collide', () => {
    const merged = mergeReminders(
      createDefaultConfig(),
      { ...createDefaultConfig(), state: {} },
      () => 'x',
    );
    expect(merged.reminders).toHaveLength(4);
  });
});

describe('Smaran 2.1 → 2.2', () => {
  it('moves settings still at the old defaults to the new ones, quietly', () => {
    const old = { ...createDefaultConfig(), version: 2 } as Record<string, unknown>;
    (old['settings'] as Record<string, unknown>)['theme'] = 'system';
    (old['settings'] as { notification: Record<string, unknown> }).notification['corner'] =
      'bottom-right';
    (old['settings'] as { notification: Record<string, unknown> }).notification['hideAfterSec'] =
      12;
    const result = migrate(old, opts());
    expect(result).toMatchObject({ kind: 'migrated', from: 'Smaran 2.1', quiet: true });
    const raw =
      result.kind === 'migrated'
        ? (result.raw as { settings: Record<string, unknown>; version: number })
        : null;
    expect(raw?.version).toBe(5);
    expect(raw?.settings['theme']).toBe('dark');
    expect(raw?.settings['notification']).toMatchObject({ corner: 'top-center', hideAfterSec: 8 });
  });

  it('keeps settings the user chose', () => {
    const old = { ...createDefaultConfig(), version: 2 } as Record<string, unknown>;
    (old['settings'] as Record<string, unknown>)['theme'] = 'light';
    const result = migrate(old, opts());
    expect(
      result.kind === 'migrated' && (result.raw as { settings: { theme: string } }).settings.theme,
    ).toBe('light');
    expect(migrate({ version: 2 }, opts())).toMatchObject({ raw: { version: 5 } });
  });
});

describe('2.7 → 2.8', () => {
  const v3 = (font?: string) => {
    const old = { ...createDefaultConfig(), version: 3 } as Record<string, unknown>;
    (old['settings'] as Record<string, unknown>)['font'] = font;
    return old;
  };
  const fontOf = (r: ReturnType<typeof migrate>) =>
    r.kind === 'migrated' ? (r.raw as { settings: { font: string } }).settings.font : null;

  it('moves the old default text font on to the current default, quietly', () => {
    const result = migrate(v3('Anthropic Serif'), opts());
    expect(result).toMatchObject({ kind: 'migrated', quiet: true, raw: { version: 5 } });
    expect(fontOf(result)).toBe('Anthropic Serif');
    expect(fontOf(migrate(v3(undefined), opts()))).toBe('Anthropic Serif');
  });

  it('keeps a font the user chose', () => {
    expect(fontOf(migrate(v3('Georgia'), opts()))).toBe('Georgia');
    expect(migrate({ version: 3 }, opts())).toMatchObject({ raw: { version: 5 } });
  });
});

describe('2.12 → 2.13', () => {
  const v4 = (font?: string) => {
    const old = { ...createDefaultConfig(), version: 4 } as Record<string, unknown>;
    (old['settings'] as Record<string, unknown>)['font'] = font;
    return old;
  };
  const fontOf = (r: ReturnType<typeof migrate>) =>
    r.kind === 'migrated' ? (r.raw as { settings: { font: string } }).settings.font : null;

  it('moves the old default text font to Anthropic Serif, quietly', () => {
    const result = migrate(v4('Anthropic Sans'), opts());
    expect(result).toMatchObject({
      kind: 'migrated',
      from: 'Smaran 2.12',
      quiet: true,
      raw: { version: 5 },
    });
    expect(fontOf(result)).toBe('Anthropic Serif');
    expect(fontOf(migrate(v4(undefined), opts()))).toBe('Anthropic Serif');
  });

  it('keeps a font the user chose', () => {
    expect(fontOf(migrate(v4('Georgia'), opts()))).toBe('Georgia');
    expect(migrate({ version: 4 }, opts())).toMatchObject({ raw: { version: 5 } });
  });
});
