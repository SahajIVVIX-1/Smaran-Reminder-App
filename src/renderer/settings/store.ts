import { create } from 'zustand';
import type { NextFire } from '@shared/ipc';
import { ConfigSchema, type Config, type Id } from '@shared/schema';

export type Page = 'messages' | 'styles' | 'schedules' | 'app' | 'backup';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
  undo?: () => void;
}

interface SettingsState {
  saved: Config | null;
  draft: Config | null;
  page: Page;
  selected: { messages: Id | null; styles: Id | null; schedules: Id | null };
  nextTimes: NextFire[];
  toast: Toast | null;
  saveErrors: string[];

  init(config: Config): void;
  /** Applies a change to the draft. */
  edit(change: (draft: Config) => Config): void;
  setPage(page: Page): void;
  select(page: 'messages' | 'styles' | 'schedules', id: Id | null): void;
  save(): Promise<boolean>;
  discard(): void;
  /** A write from main (popup drag, scheduler, import) arrived. */
  external(config: Config): void;
  showToast(text: string, tone?: Toast['tone'], undo?: () => void): void;
  dismissToast(): void;
  refreshNextTimes(): Promise<void>;
}

/** What the user edits; runtime and pause state are main's and never make the draft dirty. */
function editable(config: Config | null): string {
  if (!config) return '';
  return JSON.stringify({ ...config, runtime: null, app: { ...config.app, pausedUntil: null } });
}

export function isDirty(state: Pick<SettingsState, 'saved' | 'draft'>): boolean {
  return editable(state.saved) !== editable(state.draft);
}

let toastId = 0;

export const useSettings = create<SettingsState>((set, get) => ({
  saved: null,
  draft: null,
  page: 'messages',
  selected: { messages: null, styles: null, schedules: null },
  nextTimes: [],
  toast: null,
  saveErrors: [],

  init(config) {
    set({
      saved: config,
      draft: config,
      selected: {
        messages: config.messages[0]?.id ?? null,
        styles: config.styles[0]?.id ?? null,
        schedules: config.schedules[0]?.id ?? null,
      },
    });
  },

  edit(change) {
    const { draft } = get();
    if (!draft) return;
    set({ draft: change(structuredClone(draft)), saveErrors: [] });
  },

  setPage(page) {
    set({ page });
  },

  select(page, id) {
    set({ selected: { ...get().selected, [page]: id } });
  },

  async save() {
    const { draft } = get();
    if (!draft) return false;
    const parsed = ConfigSchema.safeParse(draft);
    if (!parsed.success) {
      set({
        saveErrors: parsed.error.issues.map((i) => describeIssue(draft, i.path, i.message)),
      });
      return false;
    }
    const result = await window.smaran.config.save(parsed.data);
    if (!result.ok) {
      set({ saveErrors: [result.error] });
      return false;
    }
    // config:changed brings the saved copy back; mark it saved now so the dot clears at once.
    set({ saved: parsed.data, draft: parsed.data, saveErrors: [] });
    get().showToast('Saved');
    return true;
  },

  discard() {
    set({ draft: get().saved, saveErrors: [] });
  },

  external(config) {
    const { saved, draft } = get();
    if (!draft || !saved || !isDirty({ saved, draft })) {
      set({ saved: config, draft: config });
      return;
    }
    // Keep the user's edits; take main's runtime, pause state and any dragged positions
    // for messages whose position the user has not touched.
    const next = structuredClone(draft);
    next.runtime = config.runtime;
    next.app.pausedUntil = config.app.pausedUntil;
    for (const message of next.messages) {
      const before = saved.messages.find((m) => m.id === message.id);
      const after = config.messages.find((m) => m.id === message.id);
      if (
        before &&
        after &&
        JSON.stringify(before.overrides.position) === JSON.stringify(message.overrides.position)
      ) {
        if (after.overrides.position) message.overrides.position = after.overrides.position;
        else delete message.overrides.position;
      }
    }
    set({ saved: config, draft: next });
  },

  showToast(text, tone = 'info', undo) {
    set({ toast: { id: ++toastId, text, tone, undo } });
  },

  dismissToast() {
    set({ toast: null });
  },

  async refreshNextTimes() {
    set({ nextTimes: await window.smaran.schedule.next() });
  },
}));

/** "Message “Drink water”: text: Too small…" */
function describeIssue(config: Config, path: readonly PropertyKey[], message: string): string {
  const [list, index] = path;
  if (typeof index === 'number') {
    if (list === 'messages') {
      const text = config.messages[index]?.text ?? '';
      return `Message “${text.slice(0, 30) || 'empty'}”: ${message}`;
    }
    if (list === 'styles') return `Style “${config.styles[index]?.name ?? ''}”: ${message}`;
    if (list === 'schedules')
      return `Schedule “${config.schedules[index]?.name ?? ''}”: ${message}`;
  }
  return message;
}
