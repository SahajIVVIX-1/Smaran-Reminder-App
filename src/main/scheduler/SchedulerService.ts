import { emptyScheduleRuntime } from '@shared/defaults';
import type { NextFire, SaveResult } from '@shared/ipc';
import { nextFireAt } from '@shared/nextFireAt';
import { pickMessage, type Random } from '@shared/picker';
import type { Config, Id, Schedule, ScheduleRuntime } from '@shared/schema';
import type { SaveOptions } from '../store/ConfigStore';
import type { BurstJob, OverlapPolicy } from './BurstRunner';

/** The parts of ConfigStore the scheduler uses. */
export interface SchedulerStore {
  get(): Config;
  update(change: (current: Config) => Config, options?: SaveOptions): SaveResult;
}

export interface SchedulerDeps {
  store: SchedulerStore;
  enqueue(job: BurstJob, overlap: OverlapPolicy): void;
  now?: () => Date;
  random?: Random;
}

/** A missed one-time reminder still fires if it is less than this late (e.g. after sleep). */
export const ONCE_GRACE_MS = 60 * 60_000;
/** Re-check at least this often, so a changed system clock is noticed. */
export const MAX_TIMER_MS = 60 * 60_000;

interface Due {
  at: Date | null;
  /** Rule + enabled; when it changes the next time is recomputed. */
  key: string;
}

/**
 * Never polls. Keeps each schedule's next fire time, sets one timeout to the earliest,
 * fires everything that is due, then re-arms. Missed fires (sleep) run once, not once per slot.
 */
export class SchedulerService {
  private readonly due = new Map<Id, Due>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly now: () => Date;
  private readonly random: Random;
  private firing = false;

  constructor(private readonly deps: SchedulerDeps) {
    this.now = deps.now ?? (() => new Date());
    this.random = deps.random ?? Math.random;
  }

  /** Computes start-up times (missed slots while the app was closed are not replayed) and arms. */
  start(): void {
    this.sync();
    this.arm();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Call after every config change: picks up new, changed and deleted schedules. */
  onConfigChanged(): void {
    if (this.firing) return;
    this.sync();
    this.arm();
  }

  /** Call on resume / unlock: anything that came due while asleep fires once now. */
  onResume(): void {
    this.onDue();
  }

  /** Fires a schedule immediately, as the user asked, without moving its next time. */
  runNow(scheduleId: Id): boolean {
    const schedule = this.deps.store.get().schedules.find((s) => s.id === scheduleId);
    if (!schedule) return false;
    this.fire([schedule], { manual: true, advance: false });
    return true;
  }

  /** Next fire time per schedule, for the settings list. */
  nextTimes(): NextFire[] {
    return this.deps.store.get().schedules.map((s) => ({
      scheduleId: s.id,
      at: this.due.get(s.id)?.at?.toISOString() ?? null,
    }));
  }

  /** The earliest upcoming reminder, for the tray tooltip. */
  nextSummary(): { schedule: Schedule; at: Date } | null {
    let best: { schedule: Schedule; at: Date } | null = null;
    for (const schedule of this.deps.store.get().schedules) {
      const at = this.due.get(schedule.id)?.at;
      if (at && (!best || at < best.at)) best = { schedule, at };
    }
    return best;
  }

  // ---------- internals ----------

  private sync(): void {
    const config = this.deps.store.get();
    const now = this.now();
    const seen = new Set<Id>();
    const expired: Id[] = [];
    const rearmed: Id[] = [];

    for (const schedule of config.schedules) {
      seen.add(schedule.id);
      const key = JSON.stringify([schedule.enabled, schedule.rule]);
      const previous = this.due.get(schedule.id);
      if (previous?.key === key) continue;
      let runtime = config.runtime[schedule.id] ?? emptyScheduleRuntime();
      // Editing a one-time reminder that already fired arms it again.
      if (previous && schedule.rule.kind === 'once' && runtime.done) {
        runtime = { ...runtime, done: false };
        rearmed.push(schedule.id);
      }
      const at = initialDue(schedule, runtime, now);
      if (at === 'expired') expired.push(schedule.id);
      this.due.set(schedule.id, { at: at === 'expired' ? null : at, key });
    }
    for (const id of [...this.due.keys()]) if (!seen.has(id)) this.due.delete(id);

    // A one-time reminder missed by more than the grace period is marked done, unshown.
    if (expired.length > 0 || rearmed.length > 0) {
      this.persist((config) => {
        for (const id of expired) {
          config.runtime[id] = { ...(config.runtime[id] ?? emptyScheduleRuntime()), done: true };
        }
        for (const id of rearmed) {
          config.runtime[id] = { ...(config.runtime[id] ?? emptyScheduleRuntime()), done: false };
        }
      });
    }
  }

  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const times = [...this.due.values()].flatMap((d) => (d.at ? [d.at.getTime()] : []));
    if (times.length === 0) return;
    const delay = Math.min(Math.max(0, Math.min(...times) - this.now().getTime()), MAX_TIMER_MS);
    this.timer = setTimeout(() => this.onDue(), delay);
  }

  private onDue(): void {
    const config = this.deps.store.get();
    const horizon = this.now().getTime() + 1000;
    const dueNow = config.schedules.filter((s) => {
      const at = this.due.get(s.id)?.at;
      return at !== null && at !== undefined && at.getTime() <= horizon;
    });
    if (dueNow.length > 0) {
      const paused = isPaused(config, this.now());
      // While paused the scheduler keeps counting but shows nothing.
      this.fire(dueNow, { manual: false, advance: true, silent: paused });
    }
    this.arm();
  }

  private fire(
    schedules: readonly Schedule[],
    opts: { manual: boolean; advance: boolean; silent?: boolean },
  ): void {
    const now = this.now();
    const config = this.deps.store.get();
    const jobs: { job: BurstJob; overlap: OverlapPolicy }[] = [];
    const runtimes = new Map<Id, ScheduleRuntime>();

    for (const schedule of schedules) {
      let runtime = config.runtime[schedule.id] ?? emptyScheduleRuntime();
      if (!opts.silent) {
        const pick = pickMessage(schedule.picker, config.messages, runtime, this.random);
        runtime = pick.runtime;
        if (pick.messageId) {
          jobs.push({
            job: {
              scheduleId: schedule.id,
              messageId: pick.messageId,
              count: schedule.burst.count,
              gapMs: schedule.burst.gapMs,
              manual: opts.manual,
            },
            overlap: schedule.burst.overlap,
          });
        }
      }
      if (opts.advance) {
        runtime = {
          ...runtime,
          lastFiredAt: now.toISOString(),
          ...(schedule.rule.kind === 'once' ? { done: true } : {}),
        };
        const next = schedule.rule.kind === 'once' ? null : nextFireAt(schedule.rule, now);
        const entry = this.due.get(schedule.id);
        if (entry) entry.at = next;
      }
      runtimes.set(schedule.id, runtime);
    }

    this.persist((draft) => {
      for (const [id, runtime] of runtimes) draft.runtime[id] = runtime;
    });
    for (const { job, overlap } of jobs) this.deps.enqueue(job, overlap);
  }

  private persist(change: (draft: Config) => void): void {
    this.firing = true;
    try {
      this.deps.store.update(
        (config) => {
          change(config);
          return config;
        },
        { backup: false },
      );
    } finally {
      this.firing = false;
    }
  }
}

export function isPaused(config: Config, now: Date): boolean {
  const until = config.app.pausedUntil;
  return until !== null && new Date(until).getTime() > now.getTime();
}

/** Next time at start-up or after the rule changed. 'expired' = a once-rule missed long ago. */
export function initialDue(
  schedule: Schedule,
  runtime: ScheduleRuntime,
  now: Date,
): Date | null | 'expired' {
  if (!schedule.enabled) return null;
  const { rule } = schedule;

  if (rule.kind === 'once') {
    if (runtime.done) return null;
    const at = nextFireAt(rule, new Date(0));
    if (!at) return null;
    if (at > now) return at;
    return now.getTime() - at.getTime() < ONCE_GRACE_MS ? now : 'expired';
  }

  if (rule.kind === 'interval' && runtime.lastFiredAt) {
    const last = new Date(runtime.lastFiredAt);
    // Continue the rhythm across restarts, but never fire immediately on start-up.
    if (last.getTime() + rule.everyMs > now.getTime()) return nextFireAt(rule, last);
  }
  return nextFireAt(rule, now);
}
