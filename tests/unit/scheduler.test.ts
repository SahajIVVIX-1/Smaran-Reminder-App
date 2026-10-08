import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig, emptyScheduleRuntime, PAUSED_FOREVER } from '@shared/defaults';
import type { SaveResult } from '@shared/ipc';
import type { Config, Rule, Schedule } from '@shared/schema';
import type { BurstJob, OverlapPolicy } from '../../src/main/scheduler/BurstRunner';
import {
  initialDue,
  isPaused,
  MAX_TIMER_MS,
  ONCE_GRACE_MS,
  SchedulerService,
} from '../../src/main/scheduler/SchedulerService';

const HOUR = 3_600_000;
const START = new Date(2026, 9, 8, 8, 0); // Thu 8 Oct 2026 08:00 local

function schedule(id: string, rule: Rule, extra: Partial<Schedule> = {}): Schedule {
  return {
    id,
    name: id,
    enabled: true,
    rule,
    burst: { count: 1, gapMs: 0, overlap: 'queue' },
    picker: { mode: 'sequential' },
    ...extra,
  };
}

/** In-memory store with the same update semantics as ConfigStore. */
function setup(schedules: Schedule[], change: (c: Config) => void = () => undefined) {
  let config = createDefaultConfig(() => crypto.randomUUID(), START);
  config.schedules = schedules;
  config.runtime = Object.fromEntries(schedules.map((s) => [s.id, emptyScheduleRuntime()]));
  config.messages = [
    { ...config.messages[0]!, id: 'm1', text: 'one' },
    { ...config.messages[0]!, id: 'm2', text: 'two' },
  ];
  change(config);
  const jobs: { job: BurstJob; overlap: OverlapPolicy; at: number }[] = [];
  let scheduler: SchedulerService | null = null;
  const store = {
    get: () => config,
    update(fn: (c: Config) => Config): SaveResult {
      config = fn(structuredClone(config));
      scheduler?.onConfigChanged();
      return { ok: true };
    },
    set(next: Config) {
      config = next;
      scheduler?.onConfigChanged();
    },
  };
  scheduler = new SchedulerService({
    store,
    enqueue: (job, overlap) => jobs.push({ job, overlap, at: Date.now() }),
    random: () => 0,
  });
  return { scheduler, store, jobs, config: () => config };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SchedulerService', () => {
  it('two schedules with different messages fire independently', async () => {
    const t = setup([
      schedule(
        'hourly',
        { kind: 'interval', everyMs: HOUR },
        { picker: { mode: 'fixed', messageId: 'm1' } },
      ),
      schedule(
        'nine',
        { kind: 'daily', times: ['09:00'] },
        { picker: { mode: 'fixed', messageId: 'm2' } },
      ),
    ]);
    t.scheduler.start();
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    expect(
      t.jobs.map((j) => [j.job.scheduleId, j.job.messageId, new Date(j.at).getHours()]),
    ).toEqual([
      ['hourly', 'm1', 9],
      ['nine', 'm2', 9],
      ['hourly', 'm1', 10],
    ]);
    expect(t.config().runtime['nine']?.lastFiredAt).toBe(new Date(2026, 9, 8, 9).toISOString());
  });

  it('passes the burst settings and overlap policy to the runner', async () => {
    const t = setup([
      schedule(
        's',
        { kind: 'interval', everyMs: HOUR },
        { burst: { count: 3, gapMs: 2000, overlap: 'replace' } },
      ),
    ]);
    t.scheduler.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.jobs[0]).toMatchObject({
      job: { scheduleId: 's', messageId: 'm1', count: 3, gapMs: 2000, manual: false },
      overlap: 'replace',
    });
  });

  it('advances the sequential picker and persists it', async () => {
    const t = setup([schedule('s', { kind: 'interval', everyMs: HOUR })]);
    t.scheduler.start();
    await vi.advanceTimersByTimeAsync(3 * HOUR);
    expect(t.jobs.map((j) => j.job.messageId)).toEqual(['m1', 'm2', 'm1']);
    expect(t.config().runtime['s']?.lastMessageId).toBe('m1');
  });

  it('never polls: one timer, capped at an hour', () => {
    const t = setup([schedule('y', { kind: 'yearly', month: 12, day: 25, time: '08:00' })]);
    t.scheduler.start();
    expect(vi.getTimerCount()).toBe(1);
    expect(t.scheduler.nextSummary()?.at).toEqual(new Date(2026, 11, 25, 8));
    vi.advanceTimersByTime(MAX_TIMER_MS);
    expect(vi.getTimerCount()).toBe(1);
    expect(t.jobs).toHaveLength(0);
  });

  it('after sleep, a missed schedule fires once, not once per missed slot', async () => {
    const t = setup([schedule('s', { kind: 'interval', everyMs: HOUR })]);
    t.scheduler.start();
    // Asleep for 5 hours: timers did not run, the clock moved on.
    t.scheduler.stop();
    vi.setSystemTime(START.getTime() + 5 * HOUR);
    t.scheduler.onResume();
    expect(t.jobs).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(HOUR - 1000);
    expect(t.jobs).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.jobs).toHaveLength(2);
  });

  it('while paused it keeps time but shows nothing', async () => {
    const t = setup([schedule('s', { kind: 'interval', everyMs: HOUR })], (c) => {
      c.app.pausedUntil = PAUSED_FOREVER;
    });
    t.scheduler.start();
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    expect(t.jobs).toHaveLength(0);
    expect(t.config().runtime['s']?.lastFiredAt).not.toBeNull();
    expect(t.config().runtime['s']?.lastMessageId).toBeNull();
  });

  it('runNow fires a schedule as a manual job without moving its next time', () => {
    const t = setup([schedule('s', { kind: 'daily', times: ['20:00'] })]);
    t.scheduler.start();
    const before = t.scheduler.nextTimes();
    expect(t.scheduler.runNow('s')).toBe(true);
    expect(t.jobs[0]?.job.manual).toBe(true);
    expect(t.scheduler.nextTimes()).toEqual(before);
    expect(t.scheduler.runNow('missing')).toBe(false);
  });

  it('a one-time schedule fires once and is marked done', async () => {
    const t = setup([schedule('o', { kind: 'once', at: '2026-10-08T08:30:00' })]);
    t.scheduler.start();
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    expect(t.jobs).toHaveLength(1);
    expect(t.config().runtime['o']?.done).toBe(true);
    expect(t.scheduler.nextTimes()).toEqual([{ scheduleId: 'o', at: null }]);
  });

  it('editing a one-time schedule that already fired arms it again', async () => {
    const t = setup([schedule('o', { kind: 'once', at: '2026-10-08T08:30:00' })]);
    t.scheduler.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    const c = structuredClone(t.config());
    c.schedules[0] = schedule('o', { kind: 'once', at: '2026-10-08T12:00:00' });
    t.store.set(c);
    expect(t.config().runtime['o']?.done).toBe(false);
    await vi.advanceTimersByTimeAsync(4 * HOUR);
    expect(t.jobs).toHaveLength(2);
  });

  it('a one-time reminder missed by over an hour while closed is marked done unshown', () => {
    vi.setSystemTime(START.getTime() + 3 * HOUR);
    const t = setup([schedule('o', { kind: 'once', at: '2026-10-08T08:30:00' })]);
    t.scheduler.start();
    expect(t.jobs).toHaveLength(0);
    expect(t.config().runtime['o']?.done).toBe(true);
  });

  it('picks up new, changed and deleted schedules on config change', () => {
    const t = setup([schedule('a', { kind: 'daily', times: ['20:00'] })]);
    t.scheduler.start();
    const c = structuredClone(t.config());
    c.schedules = [schedule('b', { kind: 'daily', times: ['10:00'] })];
    t.store.set(c);
    expect(t.scheduler.nextTimes()).toEqual([
      { scheduleId: 'b', at: new Date(2026, 9, 8, 10).toISOString() },
    ]);
    expect(t.scheduler.nextSummary()?.schedule.id).toBe('b');
  });

  it('a disabled schedule has no next time and nothing armed', () => {
    const t = setup([schedule('a', { kind: 'daily', times: ['20:00'] }, { enabled: false })]);
    t.scheduler.start();
    expect(t.scheduler.nextSummary()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a schedule with no matching messages advances without a job', async () => {
    const t = setup([
      schedule(
        's',
        { kind: 'interval', everyMs: HOUR },
        { picker: { mode: 'fixed', messageId: 'gone' } },
      ),
    ]);
    t.scheduler.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.jobs).toHaveLength(0);
    expect(t.config().runtime['s']?.lastFiredAt).not.toBeNull();
  });

  it('uses real time and randomness by default', () => {
    const config = createDefaultConfig();
    const s = new SchedulerService({
      store: { get: () => config, update: () => ({ ok: true }) },
      enqueue: () => undefined,
    });
    s.start();
    expect(s.nextSummary()).not.toBeNull();
    s.stop();
    s.stop();
  });
});

describe('initialDue', () => {
  const now = START;

  it('continues an interval rhythm across restarts but never fires at once on start-up', () => {
    const rule: Rule = { kind: 'interval', everyMs: HOUR };
    const recent = {
      ...emptyScheduleRuntime(),
      lastFiredAt: new Date(now.getTime() - 20 * 60_000).toISOString(),
    };
    expect(initialDue(schedule('s', rule), recent, now)).toEqual(
      new Date(now.getTime() + 40 * 60_000),
    );
    const old = {
      ...emptyScheduleRuntime(),
      lastFiredAt: new Date(now.getTime() - 5 * HOUR).toISOString(),
    };
    expect(initialDue(schedule('s', rule), old, now)).toEqual(new Date(now.getTime() + HOUR));
  });

  it('fires a one-time reminder missed by less than the grace period right away', () => {
    const at = new Date(now.getTime() - ONCE_GRACE_MS / 2);
    const rule: Rule = { kind: 'once', at: `2026-10-08T07:30:00` };
    expect(at.getHours()).toBe(7);
    expect(initialDue(schedule('o', rule), emptyScheduleRuntime(), now)).toEqual(now);
  });

  it('done one-time reminders stay off', () => {
    const rule: Rule = { kind: 'once', at: '2026-10-09T07:30:00' };
    expect(
      initialDue(schedule('o', rule), { ...emptyScheduleRuntime(), done: true }, now),
    ).toBeNull();
  });

  it('isPaused compares against now', () => {
    const config = createDefaultConfig();
    expect(isPaused(config, now)).toBe(false);
    config.app.pausedUntil = new Date(now.getTime() + 1000).toISOString();
    expect(isPaused(config, now)).toBe(true);
    expect(isPaused(config, new Date(now.getTime() + 2000))).toBe(false);
  });
});
