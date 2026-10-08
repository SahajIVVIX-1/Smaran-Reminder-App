import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BurstRunner, sleep, type BurstJob } from '../../src/main/scheduler/BurstRunner';

/** Fake popups: each stays `ms` unless aborted. Records what was shown and when. */
function harness(opts: { popupMs?: number; suppress?: () => boolean; fail?: boolean } = {}) {
  const shown: { messageId: string; at: number }[] = [];
  let open = 0;
  let maxOpen = 0;
  const runner = new BurstRunner({
    show: (messageId, signal) => {
      if (opts.fail) return Promise.reject(new Error('window failed'));
      shown.push({ messageId, at: Date.now() });
      open++;
      maxOpen = Math.max(maxOpen, open);
      return sleep(opts.popupMs ?? 1000, signal).then(() => {
        open--;
      });
    },
    shouldSuppress: opts.suppress ?? (() => false),
  });
  return { runner, shown, maxOpen: () => maxOpen };
}

const job = (
  messageId: string,
  count = 1,
  gapMs = 500,
  extra: Partial<BurstJob> = {},
): BurstJob => ({
  scheduleId: 's',
  messageId,
  count,
  gapMs,
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('BurstRunner', () => {
  it('shows a burst one popup at a time with the gap between', async () => {
    const h = harness();
    h.runner.enqueue(job('a', 3, 500), 'queue');
    await vi.runAllTimersAsync();
    expect(h.shown.map((s) => [s.messageId, s.at])).toEqual([
      ['a', 0],
      ['a', 1500],
      ['a', 3000],
    ]);
    expect(h.maxOpen()).toBe(1);
    expect(h.runner.isBusy).toBe(false);
  });

  it('queue: a second job waits for the running burst', async () => {
    const h = harness();
    h.runner.enqueue(job('a', 2), 'queue');
    h.runner.enqueue(job('b'), 'queue');
    expect(h.runner.pending).toHaveLength(1);
    expect(h.runner.activeJob?.messageId).toBe('a');
    await vi.runAllTimersAsync();
    expect(h.shown.map((s) => s.messageId)).toEqual(['a', 'a', 'b']);
    expect(h.maxOpen()).toBe(1);
  });

  it('skip: a job arriving during a burst is dropped', async () => {
    const h = harness();
    h.runner.enqueue(job('a', 2), 'queue');
    h.runner.enqueue(job('b'), 'skip');
    await vi.runAllTimersAsync();
    expect(h.shown.map((s) => s.messageId)).toEqual(['a', 'a']);
  });

  it('replace: the running burst stops and the new one starts — never two chains', async () => {
    const h = harness();
    h.runner.enqueue(job('a', 3), 'queue');
    await vi.advanceTimersByTimeAsync(200);
    h.runner.enqueue(job('b', 2), 'replace');
    await vi.runAllTimersAsync();
    expect(h.shown.map((s) => s.messageId)).toEqual(['a', 'b', 'b']);
    expect(h.maxOpen()).toBe(1);
  });

  it('an idle runner starts any job at once, whatever the policy', async () => {
    const h = harness();
    h.runner.enqueue(job('a'), 'skip');
    await vi.runAllTimersAsync();
    expect(h.shown).toHaveLength(1);
  });

  it('cancelActive ends the burst and moves on to the queue', async () => {
    const h = harness();
    h.runner.enqueue(job('a', 3), 'queue');
    h.runner.enqueue(job('b'), 'queue');
    await vi.advanceTimersByTimeAsync(100);
    h.runner.cancelActive();
    await vi.runAllTimersAsync();
    expect(h.shown.map((s) => s.messageId)).toEqual(['a', 'b']);
  });

  it('cancelAll clears the queue and pending snoozes', async () => {
    const h = harness();
    h.runner.enqueue(job('a', 3), 'queue');
    h.runner.enqueue(job('b'), 'queue');
    await vi.advanceTimersByTimeAsync(100);
    h.runner.snoozeActive(5);
    h.runner.cancelAll();
    await vi.runAllTimersAsync();
    expect(h.shown.map((s) => s.messageId)).toEqual(['a']);
  });

  it('snooze stops the burst and runs it again later', async () => {
    const h = harness();
    h.runner.enqueue(job('a', 2), 'queue');
    await vi.advanceTimersByTimeAsync(100);
    h.runner.snoozeActive(5);
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(h.shown).toHaveLength(1);
    await vi.runAllTimersAsync();
    expect(h.shown.map((s) => s.at)).toEqual([0, 5 * 60_000 + 100, 5 * 60_000 + 1600]);
  });

  it('snooze with nothing running does nothing', () => {
    const h = harness();
    h.runner.snoozeActive(5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('suppression stops scheduled bursts but not manual ones', async () => {
    const h = harness({ suppress: () => true });
    h.runner.enqueue(job('a', 2), 'queue');
    h.runner.enqueue(job('b', 1, 0, { manual: true }), 'queue');
    await vi.runAllTimersAsync();
    expect(h.shown.map((s) => s.messageId)).toEqual(['b']);
  });

  it('a popup that fails ends its burst and the queue carries on', async () => {
    const h = harness({ fail: true });
    h.runner.enqueue(job('a', 3), 'queue');
    h.runner.enqueue(job('b'), 'queue');
    await vi.runAllTimersAsync();
    expect(h.runner.isBusy).toBe(false);
    expect(h.runner.pending).toHaveLength(0);
  });
});

describe('sleep', () => {
  it('resolves at once for an already-aborted signal', async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(sleep(10_000, abort.signal)).resolves.toBeUndefined();
  });
});
