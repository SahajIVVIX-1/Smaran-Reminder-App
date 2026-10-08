import { describe, expect, it } from 'vitest';
import { emptyScheduleRuntime } from '@shared/defaults';
import { candidatesFor, pickMessage, shuffle } from '@shared/picker';
import type { Message, Picker, ScheduleRuntime } from '@shared/schema';

const STAMP = '2026-10-08T00:00:00.000Z';

function msg(id: string, opts: { enabled?: boolean; tags?: string[] } = {}): Message {
  return {
    id,
    text: `Message ${id}`,
    enabled: opts.enabled ?? true,
    tags: opts.tags ?? [],
    styleId: 'style',
    overrides: {},
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

/** Runs `n` picks, threading runtime through, and returns the ids picked. */
function run(
  picker: Picker,
  messages: Message[],
  n: number,
  runtime: ScheduleRuntime = emptyScheduleRuntime(),
  random?: () => number,
): { ids: (string | null)[]; runtime: ScheduleRuntime } {
  const ids: (string | null)[] = [];
  let rt = runtime;
  for (let i = 0; i < n; i++) {
    const r = pickMessage(picker, messages, rt, random);
    ids.push(r.messageId);
    rt = r.runtime;
  }
  return { ids, runtime: rt };
}

const seq: Picker = { mode: 'sequential' };

describe('candidatesFor', () => {
  it('keeps enabled messages in list order', () => {
    const list = [msg('a'), msg('b', { enabled: false }), msg('c')];
    expect(candidatesFor(seq, list).map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('filters by any matching tag when tags are given', () => {
    const list = [msg('a', { tags: ['work'] }), msg('b', { tags: ['home'] }), msg('c')];
    const picker: Picker = { mode: 'sequential', tags: ['work', 'gym'] };
    expect(candidatesFor(picker, list).map((m) => m.id)).toEqual(['a']);
    expect(candidatesFor({ mode: 'sequential', tags: [] }, list)).toHaveLength(3);
  });
});

describe('sequential', () => {
  const list = [msg('a'), msg('b'), msg('c')];

  it('cycles in list order and wraps', () => {
    expect(run(seq, list, 5).ids).toEqual(['a', 'b', 'c', 'a', 'b']);
  });

  it('records the pick so a restart continues', () => {
    const { runtime } = run(seq, list, 2);
    expect(runtime).toMatchObject({ lastMessageId: 'b', seqIndex: 1 });
    expect(pickMessage(seq, list, runtime).messageId).toBe('c');
  });

  it('continues with the message that took the slot of a deleted last pick', () => {
    const { runtime } = run(seq, list, 2); // last = b
    const afterDelete = [msg('a'), msg('c'), msg('d')];
    expect(run(seq, afterDelete, 3, runtime).ids).toEqual(['c', 'd', 'a']);
  });

  it('wraps to the start when the deleted last pick was at the end', () => {
    const { runtime } = run(seq, list, 3); // last = c
    expect(pickMessage(seq, [msg('a'), msg('b')], runtime).messageId).toBe('a');
  });

  it('follows the message id when the list is reordered', () => {
    const { runtime } = run(seq, list, 1); // last = a
    const reordered = [msg('c'), msg('a'), msg('b')];
    expect(run(seq, reordered, 3, runtime).ids).toEqual(['b', 'c', 'a']);
  });

  it('skips disabled messages, including a last pick that was disabled since', () => {
    const { runtime } = run(seq, list, 1); // last = a
    const disabled = [msg('a', { enabled: false }), msg('b', { enabled: false }), msg('c')];
    expect(pickMessage(seq, disabled, runtime).messageId).toBe('c');
  });
});

describe('random', () => {
  const list = [msg('a'), msg('b'), msg('c')];
  const random: Picker = { mode: 'random' };

  it('uses the supplied random source', () => {
    expect(pickMessage(random, list, emptyScheduleRuntime(), () => 0).messageId).toBe('a');
    expect(pickMessage(random, list, emptyScheduleRuntime(), () => 0.5).messageId).toBe('b');
    expect(pickMessage(random, list, emptyScheduleRuntime(), () => 0.99).messageId).toBe('c');
  });

  it('stays in range even if the source returns 1', () => {
    expect(pickMessage(random, list, emptyScheduleRuntime(), () => 1).messageId).toBe('c');
  });

  it('defaults to Math.random', () => {
    const id = pickMessage(random, list, emptyScheduleRuntime()).messageId;
    expect(['a', 'b', 'c']).toContain(id);
  });
});

describe('shuffle mode', () => {
  const list = [msg('a'), msg('b'), msg('c'), msg('d')];
  const shuffled: Picker = { mode: 'shuffle' };

  it('never repeats until every message has been shown', () => {
    for (let trial = 0; trial < 50; trial++) {
      const { ids } = run(shuffled, list, 8);
      expect(new Set(ids.slice(0, 4)).size).toBe(4);
      expect(new Set(ids.slice(4, 8)).size).toBe(4);
      expect(ids[4]).not.toBe(ids[3]); // no back-to-back repeat across a refill
    }
  });

  it('swaps the first of a new bag if it equals the last message shown', () => {
    const three = [msg('a'), msg('b'), msg('c')];
    // With random() = 0, Fisher–Yates turns [a, b, c] into [b, c, a].
    expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
    const runtime: ScheduleRuntime = { ...emptyScheduleRuntime(), lastMessageId: 'b' };
    const r = pickMessage(shuffled, three, runtime, () => 0);
    expect(r.messageId).toBe('c');
    expect(r.runtime.shuffleBag).toEqual(['b', 'a']);
  });

  it('keeps a single message when it is the only one', () => {
    const runtime: ScheduleRuntime = { ...emptyScheduleRuntime(), lastMessageId: 'a' };
    expect(pickMessage(shuffled, [msg('a')], runtime).messageId).toBe('a');
  });

  it('drops deleted or disabled messages from the bag', () => {
    const runtime: ScheduleRuntime = { ...emptyScheduleRuntime(), shuffleBag: ['x', 'b', 'c'] };
    const r = pickMessage(shuffled, [msg('b', { enabled: false }), msg('c')], runtime);
    expect(r.messageId).toBe('c');
    expect(r.runtime.shuffleBag).toEqual([]);
  });
});

describe('fixed', () => {
  const list = [msg('a'), msg('b', { enabled: false })];

  it('always picks its message', () => {
    expect(run({ mode: 'fixed', messageId: 'a' }, list, 2).ids).toEqual(['a', 'a']);
  });

  it('picks nothing when its message is disabled or gone', () => {
    expect(
      pickMessage({ mode: 'fixed', messageId: 'b' }, list, emptyScheduleRuntime()).messageId,
    ).toBeNull();
    expect(
      pickMessage({ mode: 'fixed', messageId: 'z' }, list, emptyScheduleRuntime()).messageId,
    ).toBeNull();
  });
});

describe('no candidates', () => {
  it('picks nothing and leaves runtime unchanged', () => {
    const runtime = emptyScheduleRuntime();
    const r = pickMessage(seq, [msg('a', { enabled: false })], runtime);
    expect(r.messageId).toBeNull();
    expect(r.runtime).toEqual(runtime);
    expect(r.runtime).not.toBe(runtime);
  });
});
