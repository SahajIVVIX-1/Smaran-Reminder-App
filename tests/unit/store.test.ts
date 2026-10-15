import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig, DEFAULT_SETTINGS, emptyState } from '@shared/defaults';
import { ConfigSchema, type Config } from '@shared/schema';
import { ConfigStore } from '../../src/main/store/ConfigStore';
import { HISTORY_LIMIT, HistoryStore } from '../../src/main/store/HistoryStore';
import { fillDefaults, reconcileState } from '../../src/main/store/normalize';

let dir: string;
let clock: number;

beforeEach(() => {
  dir = fs.mkdtempSync(join(tmpdir(), 'smaran-store-'));
  clock = Date.UTC(2026, 9, 8, 9, 0, 0);
});
afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(dir, { recursive: true, force: true });
});

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
const files = () => fs.readdirSync(dir).sort();
const backups = () => fs.readdirSync(join(dir, 'backups')).sort();
const fixture = (name: string) => join(__dirname, '..', 'fixtures', name);

describe('defaults', () => {
  it('are valid, with two example reminders and nothing that pops up at login unasked', () => {
    const c = createDefaultConfig();
    expect(ConfigSchema.safeParse(c).success).toBe(true);
    expect(c.reminders.map((r) => r.title)).toEqual(['Drink some water', 'Stand up and stretch']);
    expect(c.settings.onboarded).toBe(false);
    expect(Object.keys(c.state)).toEqual(c.reminders.map((r) => r.id));
  });

  it('reject duplicate ids', () => {
    const c = createDefaultConfig();
    c.reminders[1] = { ...c.reminders[1]!, id: c.reminders[0]!.id };
    const result = ConfigSchema.safeParse(c);
    expect(!result.success && result.error.issues[0]?.message).toContain('used twice');
  });
});

describe('ConfigStore.load', () => {
  it('creates a default config on first run', () => {
    const store = makeStore();
    const { config, notice } = store.load();
    expect(notice).toBeNull();
    expect(readFile()).toEqual(config);
    expect(store.get()).toBe(config);
  });

  it('reads back what was saved', () => {
    const { config } = makeStore().load();
    expect(makeStore().load()).toEqual({ config, notice: null });
  });

  it('fills in fields a partial file left out', () => {
    const full = createDefaultConfig();
    const r = full.reminders[0]!;
    writeFile({
      version: 2,
      settings: { theme: 'dark', notification: { corner: 'top-left' } },
      reminders: [
        { id: r.id, title: r.title, rule: r.rule, createdAt: r.createdAt, updatedAt: r.updatedAt },
      ],
    });
    const { config, notice } = makeStore().load();
    expect(notice).toBeNull();
    expect(config.settings.theme).toBe('dark');
    expect(config.settings.notification).toEqual({
      ...DEFAULT_SETTINGS.notification,
      corner: 'top-left',
    });
    expect(config.reminders[0]).toMatchObject({
      lines: [],
      priority: 'normal',
      followUp: { enabled: false },
    });
    expect(config.state[r.id]).toEqual(emptyState());
  });

  it.each([
    ['not JSON', '{ broken', 'it is not valid JSON'],
    ['invalid values', { version: 2, reminders: [{ id: 'x' }] }, 'it has invalid values'],
    ['an invalid 2.0 file', { version: 1, styles: [] }, 'it has invalid values'],
    ['from a newer version', { version: 99 }, 'saved by a newer version of Smaran (format 99)'],
  ])('sets aside a file that is %s and starts with defaults', (_label, content, reason) => {
    writeFile(content);
    const { config, notice } = makeStore().load();
    expect(notice).toContain(reason);
    expect(readFile()).toEqual(config);
    expect(files().filter((f) => f.startsWith('config.invalid-'))).toHaveLength(1);
  });

  it('upgrades a Smaran 2.0 config and keeps the original', () => {
    fs.copyFileSync(fixture('v2.0/config.json'), configPath());
    const { config, notice } = makeStore().load();
    expect(notice).toContain('converted from Smaran 2.0');
    expect(config.version).toBe(5);
    expect(config.reminders.length).toBeGreaterThan(0);
    expect(files().some((f) => f.startsWith('config.before-upgrade-'))).toBe(true);
  });

  it('upgrades a Smaran v1 settings file all the way', () => {
    fs.copyFileSync(fixture('v1/smaran_settings.default.json'), configPath());
    const { config, notice } = makeStore().load();
    expect(notice).toContain('converted from Smaran v1');
    expect(config.reminders).toHaveLength(1);
    expect(config.reminders[0]?.lines).toHaveLength(3);
  });

  it('get() before load() is a programming error', () => {
    expect(() => makeStore().get()).toThrow();
  });

  it('uses real ids and time by default', () => {
    const store = new ConfigStore(dir);
    expect(store.load().config.reminders[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('ConfigStore.save', () => {
  it('validates, writes, notifies and backs up', () => {
    const store = makeStore();
    const { config } = store.load();
    const listener = vi.fn();
    store.onChange(listener);
    expect(store.save({ ...config, settings: { ...config.settings, theme: 'light' } })).toEqual({
      ok: true,
    });
    expect(readFile().settings.theme).toBe('light');
    expect(listener).toHaveBeenCalledWith(store.get());
    expect(backups()).toHaveLength(1);
  });

  it('rejects an invalid config without touching anything', () => {
    const store = makeStore();
    const { config } = store.load();
    const listener = vi.fn();
    store.onChange(listener);
    const result = store.save({ ...config, reminders: [{ ...config.reminders[0], title: ' ' }] });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('Give the reminder a title');
    expect(readFile()).toEqual(config);
    expect(listener).not.toHaveBeenCalled();
  });

  it('skips the backup for frequent internal writes', () => {
    const store = makeStore();
    store.load();
    store.update((c) => c, { backup: false });
    expect(fs.existsSync(join(dir, 'backups'))).toBe(false);
  });

  it('keeps only the newest backups and leaves no temp file', () => {
    const store = makeStore({ maxBackups: 3 });
    store.load();
    for (let i = 0; i < 6; i++) store.update((c) => c);
    expect(backups()).toHaveLength(3);
    expect(files()).toEqual(['backups', 'config.json']);
  });

  it('names same-millisecond backups apart', () => {
    const store = makeStore({ fixedClock: true });
    store.load();
    store.update((c) => c);
    store.update((c) => c);
    expect(backups()).toEqual([
      'config-2026-10-08T09-00-00-000Z-00.json',
      'config-2026-10-08T09-00-00-000Z-01.json',
    ]);
  });

  it('reports a write failure in plain English', () => {
    const store = makeStore();
    store.load();
    fs.mkdirSync(join(dir, 'config.json.tmp'));
    const result = store.save(store.get());
    expect(!result.ok && result.error).toContain('Could not write');
  });

  it('stops notifying after unsubscribe', () => {
    const store = makeStore();
    store.load();
    const listener = vi.fn();
    store.onChange(listener)();
    store.update((c) => c);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('normalize', () => {
  it('leaves non-objects and wrong types for validation to reject', () => {
    expect(fillDefaults(42)).toBe(42);
    const filled = fillDefaults({ settings: 5, reminders: 'x', state: [] }) as Record<
      string,
      unknown
    >;
    expect(filled['settings']).toBe(5);
    expect(filled['reminders']).toEqual([]);
    expect(filled['state']).toEqual({});
  });

  it('reconcileState adds missing and drops stale entries', () => {
    const c = createDefaultConfig();
    const id = c.reminders[0]!.id;
    const kept = { ...emptyState(), nextLine: 2 };
    const result = reconcileState({
      ...c,
      reminders: [c.reminders[0]!],
      state: { [id]: kept, gone: kept },
    });
    expect(result.state).toEqual({ [id]: kept });
  });
});

describe('HistoryStore', () => {
  const entry = (i: number) => ({
    id: `e${i}`,
    reminderId: 'r',
    title: `t${i}`,
    dueAt: new Date(2026, 9, 8).toISOString(),
    at: new Date(2026, 9, 8).toISOString(),
    outcome: 'done' as const,
  });

  it('keeps newest first, notifies, and writes shortly after', async () => {
    vi.useFakeTimers();
    const h = new HistoryStore(dir, 100);
    h.load();
    const listener = vi.fn();
    h.onChange(listener);
    h.add(entry(1));
    h.add(entry(2));
    expect(h.list().map((e) => e.id)).toEqual(['e2', 'e1']);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(fs.existsSync(h.filePath)).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    const again = new HistoryStore(dir);
    again.load();
    expect(again.list()).toHaveLength(2);
  });

  it('caps the list, clears, and survives a damaged file', () => {
    const h = new HistoryStore(dir, 10_000);
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h.add(entry(i));
    expect(h.list()).toHaveLength(HISTORY_LIMIT);
    h.clear();
    h.flush();
    expect(h.list()).toEqual([]);
    fs.writeFileSync(h.filePath, '{oops');
    h.load();
    expect(h.list()).toEqual([]);
    fs.writeFileSync(h.filePath, JSON.stringify([{ bad: true }]));
    h.load();
    expect(h.list()).toEqual([]);
    const unsubscribe = h.onChange(() => undefined);
    unsubscribe();
  });
});
