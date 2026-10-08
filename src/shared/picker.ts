import type { Id, Message, Picker, ScheduleRuntime } from './schema';

export type Random = () => number;

export interface PickResult {
  messageId: Id | null;
  /** Runtime to persist for the schedule. Unchanged fields are copied from the input. */
  runtime: ScheduleRuntime;
}

/** Enabled messages the picker may choose from, in the user's list order. */
export function candidatesFor(picker: Picker, messages: readonly Message[]): Message[] {
  const tags = picker.tags ?? [];
  return messages.filter(
    (m) => m.enabled && (tags.length === 0 || m.tags.some((t) => tags.includes(t))),
  );
}

/**
 * Picks the next message for a schedule. Pure: randomness comes from `random`,
 * and the cursor / shuffle bag come back in `runtime` for the caller to persist.
 */
export function pickMessage(
  picker: Picker,
  messages: readonly Message[],
  runtime: ScheduleRuntime,
  random: Random = Math.random,
): PickResult {
  if (picker.mode === 'fixed') {
    const fixed = messages.find((m) => m.id === picker.messageId && m.enabled);
    return { messageId: fixed?.id ?? null, runtime: { ...runtime } };
  }

  const candidates = candidatesFor(picker, messages);
  if (candidates.length === 0) return { messageId: null, runtime: { ...runtime } };

  switch (picker.mode) {
    case 'random': {
      const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
      return done(candidates[index] as Message, messages, runtime);
    }
    case 'sequential':
      return done(nextSequential(candidates, messages, runtime), messages, runtime);
    case 'shuffle':
      return pickShuffle(candidates, messages, runtime, random);
  }
}

function done(
  pick: Message,
  messages: readonly Message[],
  runtime: ScheduleRuntime,
  shuffleBag: Id[] = runtime.shuffleBag,
): PickResult {
  return {
    messageId: pick.id,
    runtime: {
      ...runtime,
      lastMessageId: pick.id,
      seqIndex: messages.findIndex((m) => m.id === pick.id),
      shuffleBag,
    },
  };
}

/**
 * The candidate after the last pick in list order, wrapping at the end.
 * If the last pick was deleted, the message that moved into its slot comes next.
 */
function nextSequential(
  candidates: readonly Message[],
  messages: readonly Message[],
  runtime: ScheduleRuntime,
): Message {
  const first = candidates[0] as Message;
  if (runtime.lastMessageId === null) return first;

  const lastPos = messages.findIndex((m) => m.id === runtime.lastMessageId);
  const position = (m: Message) => messages.indexOf(m);
  const next =
    lastPos >= 0
      ? candidates.find((m) => position(m) > lastPos)
      : candidates.find((m) => position(m) >= runtime.seqIndex);
  return next ?? first;
}

/** Random without repeats: every candidate is shown once before any is shown again. */
function pickShuffle(
  candidates: readonly Message[],
  messages: readonly Message[],
  runtime: ScheduleRuntime,
  random: Random,
): PickResult {
  const valid = new Set(candidates.map((m) => m.id));
  let bag = runtime.shuffleBag.filter((id) => valid.has(id));

  if (bag.length === 0) {
    bag = shuffle(
      candidates.map((m) => m.id),
      random,
    );
    // Don't show the same message twice in a row across a refill.
    if (bag.length > 1 && bag[0] === runtime.lastMessageId) {
      [bag[0], bag[1]] = [bag[1] as Id, bag[0]];
    }
  }

  const [nextId, ...rest] = bag;
  const pick = candidates.find((m) => m.id === nextId) as Message;
  return done(pick, messages, runtime, rest);
}

/** Fisher–Yates. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
