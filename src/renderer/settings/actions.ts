import { format } from 'date-fns';
import { createDefaultStyle } from '@shared/defaults';
import { resolveStyle } from '@shared/effectiveStyle';
import type { Config, Message, Rule, Schedule, Style } from '@shared/schema';
import { useSettings, type Page } from './store';

const nowIso = () => new Date().toISOString();

export function newMessage(config: Config, text = 'New message'): Message {
  return {
    id: crypto.randomUUID(),
    text,
    enabled: true,
    tags: [],
    styleId: resolveStyle('', config.styles).id,
    overrides: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function newSchedule(): Schedule {
  return {
    id: crypto.randomUUID(),
    name: 'New schedule',
    enabled: true,
    rule: { kind: 'daily', times: ['09:00'] },
    burst: { count: 1, gapMs: 5000, overlap: 'skip' },
    picker: { mode: 'sequential' },
  };
}

export function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

/** Moves item `from` to where item `to` is. */
export function moveById<T extends { id: string }>(
  list: readonly T[],
  from: string,
  to: string,
): T[] {
  const next = [...list];
  const fromIndex = next.findIndex((x) => x.id === from);
  const toIndex = next.findIndex((x) => x.id === to);
  if (fromIndex < 0 || toIndex < 0) return next;
  const [moved] = next.splice(fromIndex, 1);
  if (moved) next.splice(toIndex, 0, moved);
  return next;
}

// ---------- add / delete per page (also used by Ctrl+N and Delete) ----------

export function addMessage(): void {
  const { draft, edit, select } = useSettings.getState();
  if (!draft) return;
  const message = newMessage(draft);
  edit((c) => ({ ...c, messages: [...c.messages, message] }));
  select('messages', message.id);
}

export function addStyle(from?: Style): void {
  const { draft, edit, select } = useSettings.getState();
  if (!draft) return;
  const base = from ?? createDefaultStyle();
  const style: Style = {
    ...structuredClone(base),
    id: crypto.randomUUID(),
    name: from ? `${from.name} copy` : 'New style',
    isDefault: false,
  };
  edit((c) => ({ ...c, styles: [...c.styles, style] }));
  select('styles', style.id);
}

export function addSchedule(from?: Schedule): void {
  const { edit, select } = useSettings.getState();
  const schedule: Schedule = from
    ? { ...structuredClone(from), id: crypto.randomUUID(), name: `${from.name} copy` }
    : newSchedule();
  edit((c) => ({ ...c, schedules: [...c.schedules, schedule] }));
  select('schedules', schedule.id);
}

/** Removes the selected item and offers Undo. Styles in use are handled by the Styles page. */
export function deleteSelected(page: 'messages' | 'schedules'): void {
  const { draft, selected, edit, select, showToast } = useSettings.getState();
  const id = selected[page];
  if (!draft || !id) return;
  const list: readonly { id: string }[] = draft[page];
  const index = list.findIndex((x) => x.id === id);
  if (index < 0) return;
  const before = draft;
  const label =
    page === 'messages'
      ? `“${draft.messages[index]?.text.slice(0, 30) ?? ''}”`
      : `“${draft.schedules[index]?.name ?? ''}”`;

  edit((c) => ({ ...c, [page]: c[page].filter((x: { id: string }) => x.id !== id) }));
  select(page, (list[index + 1] ?? list[index - 1])?.id ?? null);
  showToast(`Deleted ${label}`, 'info', () => {
    edit(() => before);
    select(page, id);
  });
}

export function addOnPage(page: Page): void {
  if (page === 'messages') addMessage();
  else if (page === 'styles') addStyle();
  else if (page === 'schedules') addSchedule();
}

/** A sensible starting rule when the user switches kind. */
export function defaultRule(kind: Rule['kind']): Rule {
  switch (kind) {
    case 'interval':
      return { kind, everyMs: 60 * 60_000 };
    case 'once': {
      const soon = new Date(Date.now() + 60 * 60_000);
      soon.setMinutes(0, 0, 0);
      return { kind, at: format(soon, "yyyy-MM-dd'T'HH:mm:ss") };
    }
    case 'daily':
      return { kind, times: ['09:00'] };
    case 'weekly':
      return { kind, weekdays: [1, 2, 3, 4, 5], time: '09:00' };
    case 'monthly':
      return { kind, day: 1, time: '09:00' };
    case 'yearly':
      return { kind, month: 1, day: 1, time: '09:00' };
  }
}
