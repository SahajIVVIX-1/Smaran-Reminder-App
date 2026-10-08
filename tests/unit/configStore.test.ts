import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig, DEFAULT_STYLE_FIELDS, emptyScheduleRuntime } from '@shared/defaults';
import type { Config } from '@shared/schema';
import { ConfigStore } from '../../src/main/store/ConfigStore';
import { fillDefaults, reconcileRuntime } from '../../src/main/store/normalize';

let dir: string;
let clock: number;

beforeEach(() => {
  dir = fs.mkdtempSync(join(tmpdir(), 'smaran-store-'));
  clock = Date.UTC(2026, 9, 8, 9, 0, 0);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Store whose clock moves forward 1 s on every read, so backups get distinct names. */
function makeStore(opts: { fixedClock?: boolean; maxBackups?: number } = {}): ConfigStore {
  let n = 0;
  return new ConfigStore(dir, {
    newId: () => `id-${++n}`,
    now: () => new Date(opts.fixedClock ? clock : (clock += 1000)),
    maxBackups: opts.maxBackups,
    primaryDisplayId: () => 3,
  });
}

const configPath = () => join(dir, 'config.json');
const readFile = (): Config => JSON.parse(fs.readFileSync(configPath(), 'utf8'));
const writeFile = (content: unknown) =>
  fs.writeFileSync(
    configPath(),
    typeof content === 'string' ? content : JSON.stringify(content),
    'utf8',
  );
const backups = () => fs.readdirSync(join(dir, 'backups')).sort();
const files = () => fs.readdirSync(dir).sort();

describe('load', () => {
  it('creates a default config on first run', () => {
    const store = makeStore();
    const { config, notice } = store.load();
    expect(notice).toBeNull();
    expect(readFile()).toEqual(config);
    expect(store.get()).toBe(config);
    expect(store.filePath).toBe(configPath());
  });

  it('creates the folder if it does not exist', () => {
    const nested = new ConfigStore(join(dir, 'a', 'b'));
    nested.load();
    expect(fs.existsSync(join(dir, 'a', 'b', 'config.json'))).toBe(true);
  });

  it('reads back what was saved', () => {
    const first = makeStore();
    const { config } = first.load();
    const again = makeStore().load();
    expect(again).toEqual({ config, notice: null });
  });

  it('fills in fields a partial file left out', () => {
    const full = createDefaultConfig(() => crypto.randomUUID());
    const style = full.styles[0];
    if (!style) throw new Error('fixture');
    const partial = {
      ...full,
      app: { theme: 'dark' },
      styles: [{ ...style, timing: { stayMs: 9000 }, colors: undefined }],
      messages: full.messages.map((m) => ({ ...m, tags: undefined })),
      runtime: undefined,
    };
    writeFile(partial);
    const { config, notice } = makeStore().load();
    expect(notice).toBeNull();
    expect(config.app).toMatchObject({ theme: 'dark', startAtLogin: true, pausedUntil: null });
    expect(config.styles[0]?.timing).toEqual({ ...DEFAULT_STYLE_FIELDS.timing, stayMs: 9000 });
    expect(config.styles[0]?.colors).toEqual(DEFAULT_STYLE_FIELDS.colors);
    expect(config.messages[0]?.tags).toEqual([]);
    expect(Object.keys(config.runtime)).toEqual(full.schedules.map((s) => s.id));
  });

  it.each([
    ['not JSON', '{ broken', 'it is not valid JSON'],
    ['invalid values', { version: 1, styles: [] }, 'it has invalid values'],
    ['from a newer version', { version: 99 }, 'saved by a newer version of Smaran (format 99)'],
  ])('sets aside a file that is %s and starts with defaults', (_label, content, reason) => {
    writeFile(content);
    const { config, notice } = makeStore().load();
    expect(notice).toContain(reason);
    expect(notice).toContain('started with default settings');
    expect(readFile()).toEqual(config);
    const setAside = files().filter((f) => f.startsWith('config.invalid-'));
    expect(setAside).toHaveLength(1);
    expect(notice).toContain(setAside[0]);
  });

  it('converts a v1 settings file and keeps the original', () => {
    fs.copyFileSync(
      join(__dirname, '..', 'fixtures', 'v1', 'smaran_settings.default.json'),
      configPath(),
    );
    const { config, notice } = makeStore().load();
    expect(notice).toContain('converted from Smaran v1');
    expect(config.messages).toHaveLength(3);
    expect(config.messages[0]?.overrides.position).toMatchObject({ displayId: 3 });
    expect(readFile()).toEqual(config);
    const original = files().find((f) => f.startsWith('config.before-upgrade-'));
    expect(original).toBeDefined();
    expect(JSON.parse(fs.readFileSync(join(dir, original ?? ''), 'utf8'))).toHaveProperty(
      'message_settings',
    );
  });

  it('places v1 positions on display 0 when no display lookup is given', () => {
    fs.copyFileSync(
      join(__dirname, '..', 'fixtures', 'v1', 'smaran_settings.default.json'),
      configPath(),
    );
    const { config } = new ConfigStore(dir).load();
    expect(config.messages[0]?.overrides.position).toMatchObject({ displayId: 0 });
  });

  it('get() before load() is a programming error', () => {
    expect(() => makeStore().get()).toThrow();
  });
});

describe('save', () => {
  it('validates, writes and notifies listeners', () => {
    const store = makeStore();
    const { config } = store.load();
    const listener = vi.fn();
    store.onChange(listener);

    const next = { ...config, app: { ...config.app, theme: 'light' as const } };
    expect(store.save(next)).toEqual({ ok: true });
    expect(readFile().app.theme).toBe('light');
    expect(store.get().app.theme).toBe('light');
    expect(listener).toHaveBeenCalledWith(store.get());
  });

  it('rejects an invalid config without touching the file or listeners', () => {
    const store = makeStore();
    const { config } = store.load();
    const listener = vi.fn();
    store.onChange(listener);

    const result = store.save({ ...config, styles: [] });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('Keep at least one style');
    expect(readFile()).toEqual(config);
    expect(listener).not.toHaveBeenCalled();
  });

  it('writes atomically and leaves no temp file', () => {
    const store = makeStore();
    store.load();
    store.save(store.get());
    expect(files()).toEqual(['backups', 'config.json']);
  });

  it('reports a write failure in plain English', () => {
    const store = makeStore();
    store.load();
    fs.mkdirSync(join(dir, 'config.json.tmp')); // writing the temp file now fails
    const result = store.save(store.get());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('Could not write');
  });

  it('keeps only the 5 newest backups', () => {
    const store = makeStore();
    store.load();
    for (let i = 1; i <= 8; i++) {
      const c = store.get();
      store.save({ ...c, messages: c.messages.map((m) => ({ ...m, text: `v${i}` })) });
    }
    const kept = backups();
    expect(kept).toHaveLength(5);
    const newest = JSON.parse(fs.readFileSync(join(dir, 'backups', kept[4] ?? ''), 'utf8'));
    expect(newest.messages[0].text).toBe('v7'); // the file as it was before the last save
  });

  it('honours a custom backup count and same-millisecond saves', () => {
    const store = makeStore({ fixedClock: true, maxBackups: 2 });
    store.load();
    store.save(store.get());
    store.save(store.get());
    store.save(store.get());
    expect(backups()).toEqual([
      'config-2026-10-08T09-00-00-000Z-01.json',
      'config-2026-10-08T09-00-00-000Z-02.json',
    ]);
  });

  it('keeps runtime in step with schedules', () => {
    const store = makeStore();
    const { config } = store.load();
    const [schedule] = config.schedules;
    if (!schedule) throw new Error('fixture');
    const added = { ...schedule, id: 'new-schedule' };
    store.save({ ...config, schedules: [added] });
    expect(Object.keys(store.get().runtime)).toEqual(['new-schedule']);
  });
});

describe('update and onChange', () => {
  it('applies a change to a copy of the current config', () => {
    const store = makeStore();
    store.load();
    const before = store.get();
    const result = store.update((c) => {
      c.app.respectFocusAssist = false;
      return c;
    });
    expect(result).toEqual({ ok: true });
    expect(before.app.respectFocusAssist).toBe(true);
    expect(store.get().app.respectFocusAssist).toBe(false);
  });

  it('stops notifying after unsubscribe', () => {
    const store = makeStore();
    store.load();
    const listener = vi.fn();
    const off = store.onChange(listener);
    off();
    store.save(store.get());
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('fillDefaults', () => {
  it('leaves non-objects and wrong-typed groups for validation to reject', () => {
    expect(fillDefaults(42)).toBe(42);
    expect(fillDefaults(null)).toBeNull();
    const filled = fillDefaults({ app: 5, styles: 'x', messages: ['m'] }) as Record<
      string,
      unknown
    >;
    expect(filled['app']).toBe(5);
    expect(filled['styles']).toEqual([]);
    expect(filled['messages']).toEqual(['m']);
    expect(filled['schedules']).toEqual([]);
    expect(filled['runtime']).toEqual({});
  });

  it('keeps an explicit position instead of merging it with the default', () => {
    const exact = { kind: 'exact', displayId: 1, x: 5, y: 6 };
    const filled = fillDefaults({ styles: [{ position: exact }] }) as { styles: unknown[] };
    expect(filled.styles[0]).toMatchObject({ position: exact });
  });
});

describe('reconcileRuntime', () => {
  it('keeps existing entries', () => {
    const config = createDefaultConfig();
    const id = config.schedules[0]?.id ?? '';
    const runtime = { ...emptyScheduleRuntime(), seqIndex: 4 };
    const result = reconcileRuntime({ ...config, runtime: { [id]: runtime, gone: runtime } });
    expect(result.runtime).toEqual({ [id]: runtime });
  });
});
