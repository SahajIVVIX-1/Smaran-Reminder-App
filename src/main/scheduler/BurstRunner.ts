import type { Burst, Id } from '@shared/schema';

export interface BurstJob {
  scheduleId: Id | 'manual';
  messageId: Id;
  count: number;
  gapMs: number;
  /** Started by the user (show now, run now): not held back by pause or full-screen apps. */
  manual?: boolean;
}

export type OverlapPolicy = Burst['overlap'];

export interface BurstRunnerDeps {
  /** Shows one popup; resolves after it fades out, is closed, or `signal` aborts. */
  show(messageId: Id, signal: AbortSignal): Promise<void>;
  /** True while reminders must not appear (paused, Focus Assist, full-screen app). */
  shouldSuppress(): boolean | Promise<boolean>;
}

interface Active {
  job: BurstJob;
  abort: AbortController;
}

/**
 * Runs bursts one at a time from a queue. A popup's end never calls back into scheduling:
 * the runner awaits each popup and cancels through an AbortController.
 */
export class BurstRunner {
  private queue: BurstJob[] = [];
  private active: Active | null = null;
  private readonly snoozes = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly deps: BurstRunnerDeps) {}

  get isBusy(): boolean {
    return this.active !== null;
  }

  get pending(): readonly BurstJob[] {
    return this.queue;
  }

  get activeJob(): BurstJob | null {
    return this.active?.job ?? null;
  }

  /** Adds a job. While a burst runs: queue waits, skip drops it, replace cancels the running one. */
  enqueue(job: BurstJob, overlap: OverlapPolicy): void {
    if (!this.active) {
      this.start(job);
      return;
    }
    if (overlap === 'skip') return;
    if (overlap === 'queue') {
      this.queue.push(job);
      return;
    }
    this.queue.unshift(job);
    this.cancelActive();
  }

  /** Stops the running burst; the next queued one starts. */
  cancelActive(): void {
    this.active?.abort.abort();
  }

  /** Stops everything: running burst, queue and pending snoozes (pause, quit). */
  cancelAll(): void {
    this.queue = [];
    for (const timer of this.snoozes) clearTimeout(timer);
    this.snoozes.clear();
    this.cancelActive();
  }

  /** Stops the running burst and runs it again after `minutes`. */
  snoozeActive(minutes: number): void {
    const job = this.active?.job;
    if (!job) return;
    this.cancelActive();
    const timer = setTimeout(() => {
      this.snoozes.delete(timer);
      this.enqueue(job, 'queue');
    }, minutes * 60_000);
    this.snoozes.add(timer);
  }

  private start(job: BurstJob): void {
    const active: Active = { job, abort: new AbortController() };
    this.active = active;
    void this.run(active);
  }

  private async run(active: Active): Promise<void> {
    const { job, abort } = active;
    const { signal } = abort;
    try {
      for (let i = 0; i < job.count && !signal.aborted; i++) {
        if (!job.manual && (await this.deps.shouldSuppress())) break;
        await this.deps.show(job.messageId, signal);
        if (i < job.count - 1) await sleep(job.gapMs, signal);
      }
    } catch {
      // A failed popup ends this burst; the queue carries on.
    } finally {
      if (this.active === active) this.active = null;
      const next = this.queue.shift();
      if (next) this.start(next);
    }
  }
}

/** Resolves after `ms`, or immediately when `signal` aborts. */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}
