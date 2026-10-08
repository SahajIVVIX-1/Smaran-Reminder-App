// Smaran 2.0 (messages + styles + schedules) → 2.1 (reminders).
// Each schedule becomes a reminder: the messages it picked become its title or rotating lines,
// and its burst becomes a follow-up. Messages no schedule used are kept in one disabled reminder.

import { DEFAULT_SETTINGS, emptyState, type NewId } from '@shared/defaults';
import type { Config as V1Config, Message, Schedule } from '@shared/legacy/schemaV1';
import { SCHEMA_VERSION, type Config, type Reminder, type ReminderState } from '@shared/schema';

function candidates(schedule: Schedule, messages: readonly Message[]): Message[] {
  const { picker } = schedule;
  if (picker.mode === 'fixed') return messages.filter((m) => m.id === picker.messageId);
  const tags = picker.tags ?? [];
  return messages.filter(
    (m) => m.enabled && (tags.length === 0 || m.tags.some((t) => tags.includes(t))),
  );
}

const clampText = (text: string, max: number) => text.trim().slice(0, max);

export function v1ToV2(old: V1Config, newId: NewId, now: Date): Config {
  const stamp = now.toISOString();
  const used = new Set<string>();
  const reminders: Reminder[] = [];
  const state: Record<string, ReminderState> = {};

  for (const schedule of old.schedules) {
    const picked = candidates(schedule, old.messages);
    for (const m of picked) used.add(m.id);
    const single = picked.length === 1 ? picked[0] : undefined;
    const lines = single
      ? []
      : picked
          .map((m) => clampText(m.text, 500))
          .filter(Boolean)
          .slice(0, 200);
    const extra = Math.min(20, schedule.burst.count - 1);

    reminders.push({
      id: schedule.id,
      title: clampText(single?.text.split('\n')[0] ?? schedule.name, 200) || 'Reminder',
      note:
        single && single.text.includes('\n')
          ? clampText(single.text.split('\n').slice(1).join('\n'), 2000)
          : '',
      lines,
      lineOrder:
        schedule.picker.mode === 'random' || schedule.picker.mode === 'shuffle'
          ? 'shuffle'
          : 'inOrder',
      enabled: schedule.enabled && picked.length > 0,
      rule: schedule.rule,
      priority: 'normal',
      hideAfterSec: null,
      followUp: {
        enabled: extra > 0,
        everyMin: Math.min(240, Math.max(1, Math.round(schedule.burst.gapMs / 60_000))),
        times: Math.max(1, extra),
      },
      color: 'clay',
      createdAt: stamp,
      updatedAt: stamp,
    });

    const runtime = old.runtime[schedule.id];
    state[schedule.id] = {
      ...emptyState(),
      lastDueAt: runtime?.lastFiredAt ?? null,
      completed: runtime?.done ?? false,
    };
  }

  const leftovers = old.messages.filter((m) => !used.has(m.id));
  if (leftovers.length > 0) {
    const id = newId();
    reminders.push({
      id,
      title: 'Imported messages',
      note: 'Messages from Smaran 2.0 that no schedule used. Turn this on to rotate through them.',
      lines: leftovers
        .map((m) => clampText(m.text, 500))
        .filter(Boolean)
        .slice(0, 200),
      lineOrder: 'inOrder',
      enabled: false,
      rule: { kind: 'interval', everyMs: 60 * 60_000 },
      priority: 'normal',
      hideAfterSec: null,
      followUp: { enabled: false, everyMin: 10, times: 2 },
      color: 'slate',
      createdAt: stamp,
      updatedAt: stamp,
    });
    state[id] = emptyState();
  }

  return {
    version: SCHEMA_VERSION,
    settings: {
      ...structuredClone(DEFAULT_SETTINGS),
      startAtLogin: old.app.startAtLogin,
      theme: old.app.theme,
      holdWhenBusy: old.app.respectFocusAssist,
      pausedUntil: old.app.pausedUntil,
      onboarded: old.app.onboarded,
    },
    reminders,
    state,
  };
}
