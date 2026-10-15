import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReminder, DEFAULT_SETTINGS, emptyState, PAUSED_FOREVER } from '@shared/defaults';
import type { NotificationRequest, SaveResult } from '@shared/ipc';
import {
  SCHEMA_VERSION,
  type Config,
  type HistoryEntry,
  type Reminder,
  type Rule,
} from '@shared/schema';
import {
  BUSY_GIVE_UP_MS,
  BUSY_RECHECK_MS,
  Engine,
  MAX_TIMER_MS,
  isPaused,
  pickLine,
} from '../../src/main/engine/Engine';

const MIN = 60_000;
const HOUR = 60 * MIN;
const START = new Date(2026, 9, 8, 8, 0); // Thu 8 Oct 2026 08:00 local

function reminder(id: string, rule: Rule, patch: Partial<Reminder> = {}): Reminder {
  return { ...createReminder({ title: id, rule }, () => id, START), ...patch };
}

function setup(reminders: Reminder[], change: (c: Config) => void = () => undefined, busy = false) {
  let config: Config = {
    version: SCHEMA_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    reminders,
    state: Object.fromEntries(reminders.map((r) => [r.id, emptyState()])),
    automations: [],
  };
  change(config);
  const shown: NotificationRequest[] = [];
  const closed: string[] = [];
  const history: HistoryEntry[] = [];
  let engine: Engine | null = null;
  const store = {
    get: () => config,
    update(fn: (c: Config) => Config): SaveResult {
      config = fn(structuredClone(config));
      engine?.onConfigChanged();
      return { ok: true };
    },
    /** A save from the app. */
    set(next: Config) {
      config = next;
      engine?.onConfigChanged();
    },
  };
  const isBusy = vi.fn(() => Promise.resolve(busy));
  engine = new Engine({
    store,
    history: { add: (e) => history.push(e) },
    notifier: {
      show: (r) => shown.push(r),
      close: (k) => closed.push(k),
      closeAll: () => undefined,
    },
    isBusy,
    random: () => 0,
  });
  const last = () => shown[shown.length - 1] as NotificationRequest;
  return { engine, store, shown, closed, history, isBusy, config: () => config, last };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('scheduling', () => {
  it('shows each reminder at its time, independently', async () => {
    const t = setup([
      reminder('water', { kind: 'interval', everyMs: HOUR }),
      reminder('nine', { kind: 'daily', times: ['09:00'] }),
    ]);
    t.engine.start();
    expect(t.shown).toHaveLength(0); // nothing pops up at start-up
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    expect(t.shown.map((s) => [s.title, s.label])).toEqual([
      ['water', ''],
      ['nine', ''],
      ['water', ''],
    ]);
    expect(t.config().state['nine']?.lastDueAt).toBe(new Date(2026, 9, 8, 9).toISOString());
  });

  it('uses one timer, never more than an hour long', () => {
    const t = setup([reminder('y', { kind: 'yearly', month: 12, day: 25, time: '08:00' })]);
    t.engine.start();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(MAX_TIMER_MS);
    expect(vi.getTimerCount()).toBe(1);
    expect(t.engine.upcoming()[0]?.at).toEqual(new Date(2026, 11, 25, 8));
  });

  it('keeps an interval rhythm across restarts without popping up at start', async () => {
    const t = setup([reminder('w', { kind: 'interval', everyMs: HOUR })], (c) => {
      c.state['w'] = {
        ...emptyState(),
        lastDueAt: new Date(START.getTime() - 20 * MIN).toISOString(),
      };
    });
    t.engine.start();
    expect(t.engine.nextTimes()).toEqual([
      { reminderId: 'w', at: new Date(START.getTime() + 40 * MIN).toISOString() },
    ]);
  });

  it('a one-time reminder shows once and is completed when answered', async () => {
    const t = setup([reminder('o', { kind: 'once', at: '2026-10-08T08:30:00' })]);
    t.engine.start();
    await vi.advanceTimersByTimeAsync(31 * MIN);
    expect(t.shown).toHaveLength(1);
    t.engine.handleAction(t.last().key, { kind: 'done' });
    expect(t.config().state['o']?.completed).toBe(true);
    expect(t.history.map((h) => h.outcome)).toEqual(['done']);
    expect(t.engine.nextTimes()).toEqual([{ reminderId: 'o', at: null }]);
  });

  it('editing a one-time reminder arms it again; disabling and deleting stop it', async () => {
    const t = setup([reminder('o', { kind: 'once', at: '2026-10-08T08:30:00' })], (c) => {
      c.state['o'] = { ...emptyState(), completed: true };
    });
    t.engine.start();
    const c = structuredClone(t.config());
    c.reminders[0] = reminder('o', { kind: 'once', at: '2026-10-08T10:00:00' });
    t.store.set(c);
    expect(t.config().state['o']?.completed).toBe(false);
    expect(t.engine.nextTimes()[0]?.at).toBe(new Date(2026, 9, 8, 10).toISOString());

    const off = structuredClone(t.config());
    off.reminders[0] = { ...off.reminders[0]!, enabled: false };
    t.store.set(off);
    expect(t.engine.upcoming()).toEqual([]);

    t.store.set({ ...t.config(), reminders: [] });
    await vi.advanceTimersByTimeAsync(4 * HOUR);
    expect(t.shown).toHaveLength(0);
  });
});

describe('missed while off or asleep', () => {
  it('shows a time-of-day reminder missed while Smaran was off, once, marked missed', async () => {
    const t = setup([reminder('d', { kind: 'daily', times: ['07:00'] })], (c) => {
      c.state['d'] = { ...emptyState(), lastDueAt: new Date(2026, 9, 6, 7).toISOString() };
    });
    t.engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.shown.map((s) => s.label)).toEqual(['Missed at 07:00']);
  });

  it('records old one-time reminders without a popup', () => {
    const t = setup([reminder('o', { kind: 'once', at: '2026-10-06T07:00:00' })]);
    t.engine.start();
    expect(t.shown).toHaveLength(0);
    expect(t.history[0]).toMatchObject({ outcome: 'missed', detail: 'Smaran was not running' });
    expect(t.config().state['o']?.completed).toBe(true);
  });

  it('shows at most three missed reminders and summarises the rest', async () => {
    const rs = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      reminder(id, { kind: 'daily', times: ['07:00'] }),
    );
    const t = setup(rs, (c) => {
      for (const r of rs)
        c.state[r.id] = { ...emptyState(), lastDueAt: new Date(2026, 9, 7, 7).toISOString() };
    });
    t.engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.shown).toHaveLength(4);
    expect(t.shown.find((s) => s.reminderId === null)).toMatchObject({
      title: '2 more reminders were missed',
    });
    expect(t.history.filter((h) => h.outcome === 'missed')).toHaveLength(2);
  });

  it('after sleep, what came due is handled once', async () => {
    const t = setup([
      reminder('w', { kind: 'interval', everyMs: HOUR }),
      reminder('d', { kind: 'daily', times: ['09:00'] }),
    ]);
    t.engine.start();
    t.engine.stop();
    vi.setSystemTime(START.getTime() + 5 * HOUR);
    t.engine.onResume();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.shown.map((s) => [s.title, s.label])).toEqual([
      ['w', ''],
      ['d', 'Missed at 09:00'],
    ]);
  });
});

describe('answers on the card', () => {
  it('snooze brings it back later and keeps the schedule', async () => {
    const t = setup([reminder('d', { kind: 'daily', times: ['08:30', '20:00'] })]);
    t.engine.start();
    await vi.advanceTimersByTimeAsync(30 * MIN);
    t.engine.handleAction(t.last().key, { kind: 'snooze', minutes: 15 });
    expect(t.closed).toHaveLength(1);
    expect(t.history[0]).toMatchObject({ outcome: 'snoozed', detail: 'Snoozed 15 min' });
    expect(t.engine.nextTimes()[0]?.at).toBe(new Date(2026, 9, 8, 8, 45).toISOString());
    await vi.advanceTimersByTimeAsync(15 * MIN);
    expect(t.last().label).toBe('Snoozed');
    expect(t.config().state['d']?.snoozedUntil).toBeNull();
    expect(t.engine.nextTimes()[0]?.at).toBe(new Date(2026, 9, 8, 20).toISOString());
  });

  it('snooze until tomorrow morning, or by the hour', () => {
    const t = setup([reminder('d', { kind: 'interval', everyMs: HOUR })]);
    t.engine.start();
    t.engine.showNow('d');
    t.engine.handleAction(t.last().key, { kind: 'snooze', minutes: 'tomorrow' });
    expect(t.config().state['d']?.snoozedUntil).toBe(new Date(2026, 9, 9, 9).toISOString());
    t.engine.showNow('d');
    t.engine.handleAction(t.last().key, { kind: 'snooze', minutes: 60 });
    expect(t.history.map((h) => h.detail)).toEqual(['Snoozed until tomorrow 09:00', 'Snoozed 1 h']);
  });

  it('dismiss is recorded; unknown cards are just closed', () => {
    const t = setup([reminder('d', { kind: 'interval', everyMs: HOUR })]);
    t.engine.start();
    t.engine.showNow('d');
    t.engine.handleAction(t.last().key, { kind: 'dismiss' });
    t.engine.handleAction('nope', { kind: 'done' });
    expect(t.history.map((h) => h.outcome)).toEqual(['dismissed']);
    expect(t.closed).toContain('nope');
  });

  it('ignored cards follow up, then count as missed', async () => {
    const t = setup([
      reminder(
        'f',
        { kind: 'interval', everyMs: 6 * HOUR },
        { followUp: { enabled: true, everyMin: 5, times: 2 } },
      ),
    ]);
    t.engine.start();
    t.engine.showNow('f');
    t.engine.handleAction(t.last().key, { kind: 'expired' });
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(t.last().label).toBe('Again · 1 of 2');
    t.engine.handleAction(t.last().key, { kind: 'expired' });
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(t.last().label).toBe('Again · 2 of 2');
    t.engine.handleAction(t.last().key, { kind: 'expired' });
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(t.shown).toHaveLength(3);
    expect(t.history.map((h) => [h.outcome, h.detail])).toEqual([['missed', 'Not acknowledged']]);
  });

  it('answering cancels a pending follow-up', async () => {
    const t = setup([
      reminder(
        'f',
        { kind: 'interval', everyMs: 6 * HOUR },
        { followUp: { enabled: true, everyMin: 5, times: 2 } },
      ),
    ]);
    t.engine.start();
    t.engine.showNow('f');
    t.engine.handleAction(t.last().key, { kind: 'expired' });
    await vi.advanceTimersByTimeAsync(5 * MIN);
    t.engine.handleAction(t.last().key, { kind: 'done' });
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(t.shown).toHaveLength(2);
  });

  it('a newer occurrence replaces an unanswered card', async () => {
    const t = setup([reminder('w', { kind: 'interval', everyMs: HOUR })]);
    t.engine.start();
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    expect(t.shown).toHaveLength(2);
    expect(t.closed).toEqual([t.shown[0]?.key]);
    expect(t.history[0]).toMatchObject({
      outcome: 'missed',
      detail: 'Replaced by a newer reminder',
    });
  });

  it('a one-time reminder ignored until it hides is completed as missed', () => {
    const t = setup([reminder('o', { kind: 'once', at: '2026-10-08T09:00:00' })]);
    t.engine.start();
    t.engine.showNow('o');
    t.engine.handleAction(t.last().key, { kind: 'expired' });
    expect(t.config().state['o']?.completed).toBe(true);
  });
});

describe('quiet hours, pause and busy', () => {
  const quiet = (c: Config) => {
    c.settings.quietHours = { enabled: true, from: '07:00', to: '10:00' };
  };

  it('skips interval reminders during quiet hours', async () => {
    const t = setup([reminder('w', { kind: 'interval', everyMs: HOUR })], quiet);
    t.engine.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.shown).toHaveLength(0);
    expect(t.history[0]).toMatchObject({ outcome: 'skipped', detail: 'Quiet hours' });
  });

  it('holds timed reminders until quiet hours end', async () => {
    const t = setup([reminder('d', { kind: 'daily', times: ['09:00'] })], quiet);
    t.engine.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.shown).toHaveLength(0);
    expect(t.engine.heldCount).toBe(1);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.last().label).toBe('Delayed from 09:00');
  });

  it('important reminders come through quiet hours', async () => {
    const t = setup(
      [reminder('i', { kind: 'daily', times: ['09:00'] }, { priority: 'important' })],
      quiet,
    );
    t.engine.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.last()).toMatchObject({ important: true, hideAfterSec: null });
  });

  it('while paused, reminders are skipped (one-time ones completed)', async () => {
    const t = setup(
      [
        reminder('w', { kind: 'interval', everyMs: HOUR }),
        reminder('o', { kind: 'once', at: '2026-10-08T08:30:00' }),
      ],
      (c) => {
        c.settings.pausedUntil = PAUSED_FOREVER;
      },
    );
    t.engine.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.shown).toHaveLength(0);
    expect(t.history.map((h) => h.detail)).toEqual(['Paused', 'Paused']);
    expect(t.config().state['o']?.completed).toBe(true);
  });

  it('holds normal reminders while a full-screen app is in front, then shows them', async () => {
    let busy = true;
    const t = setup([reminder('w', { kind: 'interval', everyMs: 3 * HOUR })]);
    t.isBusy.mockImplementation(() => Promise.resolve(busy));
    t.engine.start();
    await vi.advanceTimersByTimeAsync(3 * HOUR);
    expect(t.shown).toHaveLength(0);
    busy = false;
    await vi.advanceTimersByTimeAsync(BUSY_RECHECK_MS);
    expect(t.last().label).toBe('Delayed from 11:00');
  });

  it('gives up on a held reminder after a few hours', async () => {
    const t = setup([reminder('d', { kind: 'daily', times: ['09:00'] })], () => undefined, true);
    t.engine.start();
    await vi.advanceTimersByTimeAsync(HOUR + BUSY_GIVE_UP_MS + BUSY_RECHECK_MS);
    expect(t.shown).toHaveLength(0);
    expect(t.history.some((h) => h.detail === 'Held while you were busy')).toBe(true);
  });

  it('does not ask whether Windows is busy when the setting is off', async () => {
    const t = setup(
      [reminder('w', { kind: 'interval', everyMs: HOUR })],
      (c) => {
        c.settings.holdWhenBusy = false;
      },
      true,
    );
    t.engine.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.isBusy).not.toHaveBeenCalled();
    expect(t.shown).toHaveLength(1);
  });

  it('isPaused compares against now', () => {
    const t = setup([]);
    expect(isPaused(t.config(), START)).toBe(false);
    t.config().settings.pausedUntil = new Date(START.getTime() + 1000).toISOString();
    expect(isPaused(t.config(), START)).toBe(true);
  });
});

describe('content', () => {
  it('rotates lines in order', () => {
    const t = setup([
      reminder('l', { kind: 'interval', everyMs: HOUR }, { lines: ['a', 'b', 'c'] }),
    ]);
    t.engine.start();
    for (let i = 0; i < 4; i++) t.engine.showNow('l');
    expect(t.shown.map((s) => s.body)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('uses the note when there are no lines, and the default display time', () => {
    const t = setup([reminder('n', { kind: 'interval', everyMs: HOUR }, { note: 'a note' })]);
    t.engine.start();
    t.engine.showNow('n');
    expect(t.last()).toMatchObject({
      body: 'a note',
      hideAfterSec: DEFAULT_SETTINGS.notification.hideAfterSec,
      color: 'clay',
    });
  });

  it('showNow without an id shows the next reminder; false when there is none', () => {
    const t = setup([reminder('d', { kind: 'daily', times: ['09:00'] })]);
    t.engine.start();
    expect(t.engine.showNow()).toBe(true);
    expect(t.last().title).toBe('d');
    expect(t.engine.showNow('missing')).toBe(false);
  });

  it('test cards record nothing', () => {
    const t = setup([]);
    t.engine.test({
      reminderId: null,
      title: 'x',
      body: '',
      color: 'sky',
      important: false,
      label: '',
      hideAfterSec: 5,
      sound: false,
    });
    expect(t.shown).toHaveLength(1);
    t.engine.handleAction(t.last().key, { kind: 'done' });
    expect(t.history).toHaveLength(0);
  });
});

describe('pickLine', () => {
  it('shuffles without repeats until every line is shown, and not twice in a row', () => {
    const r = { lines: ['a', 'b', 'c'], lineOrder: 'shuffle' as const };
    let state = { nextLine: 0, shuffleBag: [] as number[] };
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      const { index, next } = pickLine(r, state, Math.random);
      seen.push(index);
      state = next;
    }
    expect(new Set(seen.slice(0, 3)).size).toBe(3);
    expect(new Set(seen.slice(3)).size).toBe(3);
    expect(seen[3]).not.toBe(seen[2]);
  });

  it('swaps the first of a refill if it equals the last shown line', () => {
    // With random() = 0 the bag [0,1,2] shuffles to [1,2,0].
    const { index } = pickLine(
      { lines: ['a', 'b', 'c'], lineOrder: 'shuffle' },
      { nextLine: 1, shuffleBag: [] },
      () => 0,
    );
    expect(index).toBe(2);
  });
});
