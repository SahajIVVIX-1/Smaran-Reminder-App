import { create } from 'zustand';
import type { FontCatalog } from '@shared/fonts';
import type { NextFire, Route } from '@shared/ipc';
import { plainRich } from '@shared/richText';
import type { Config, HistoryEntry, Id, Reminder, Settings } from '@shared/schema';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
  undo?: () => void;
}

/** Which reminder the side panel shows: an existing one, or a new one not saved yet. */
export type Editing = { mode: 'edit'; id: Id } | { mode: 'new'; draft: Reminder } | null;

interface AppState {
  config: Config | null;
  history: HistoryEntry[];
  nextTimes: NextFire[];
  route: Route;
  editing: Editing;
  toast: Toast | null;
  /** True while a local change waits to be saved. */
  pending: boolean;
  /** Tasks in flight (loading, backups, showing a reminder now). */
  tasks: number;
  /** Fonts on this PC and fonts the user added; loaded on demand. */
  fonts: FontCatalog | null;
  loadFonts(): Promise<void>;

  init(config: Config, history: HistoryEntry[]): void;
  external(config: Config): void;
  setHistory(history: HistoryEntry[]): void;
  refreshNext(): Promise<void>;
  go(route: Route): void;
  edit(editing: Editing): void;
  /** Changes reminders or settings; saved shortly after (changes in a burst are combined). */
  update(change: (config: Config) => Config): void;
  upsertReminder(reminder: Reminder): void;
  removeReminder(id: Id): void;
  setSettings(change: (s: Settings) => Settings): void;
  toastMsg(text: string, tone?: Toast['tone'], undo?: () => void): void;
  dismissToast(): void;
  /** Marks the app busy until `work` settles (drives the animated spark). */
  track<T>(work: Promise<T>): Promise<T>;
}

const SAVE_DELAY_MS = 350;
let saveTimer: number | undefined;
let toastSeq = 0;

export const useApp = create<AppState>((set, get) => ({
  config: null,
  history: [],
  nextTimes: [],
  route: 'today',
  editing: null,
  toast: null,
  pending: false,
  tasks: 0,
  fonts: null,

  async loadFonts() {
    set({ fonts: await get().track(window.smaran.fonts.list()) });
  },

  init(config, history) {
    set({ config, history });
    void get().refreshNext();
  },

  external(config) {
    const { pending, config: local } = get();
    // A save is on its way: keep the user's edits, take main's state and pause.
    if (pending && local) {
      set({
        config: {
          ...config,
          reminders: local.reminders,
          settings: { ...local.settings, pausedUntil: config.settings.pausedUntil },
        },
      });
    } else {
      set({ config });
    }
    void get().refreshNext();
  },

  setHistory(history) {
    set({ history });
  },

  async refreshNext() {
    set({ nextTimes: await window.smaran.reminders.nextTimes() });
  },

  go(route) {
    set({ route });
  },

  edit(editing) {
    set({ editing });
  },

  update(change) {
    const { config } = get();
    if (!config) return;
    set({ config: change(config), pending: true });
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      const latest = get().config;
      if (!latest) return;
      const result = await window.smaran.config.save(latest);
      set({ pending: false });
      if (!result.ok)
        get().toastMsg(`Couldn’t save: ${result.error.split('\n')[0] ?? ''}`, 'error');
    }, SAVE_DELAY_MS);
  },

  upsertReminder(reminder) {
    get().update((c) => {
      const exists = c.reminders.some((r) => r.id === reminder.id);
      return {
        ...c,
        reminders: exists
          ? c.reminders.map((r) => (r.id === reminder.id ? reminder : r))
          : [...c.reminders, reminder],
      };
    });
  },

  removeReminder(id) {
    const { config, update, toastMsg, editing } = get();
    if (!config) return;
    const index = config.reminders.findIndex((r) => r.id === id);
    const removed = config.reminders[index];
    if (!removed) return;
    update((c) => ({ ...c, reminders: c.reminders.filter((r) => r.id !== id) }));
    if (editing?.mode === 'edit' && editing.id === id) set({ editing: null });
    toastMsg(`Deleted “${plainRich(removed.title)}”`, 'info', () =>
      update((c) => {
        const reminders = [...c.reminders];
        reminders.splice(Math.min(index, reminders.length), 0, removed);
        return { ...c, reminders };
      }),
    );
  },

  setSettings(change) {
    get().update((c) => ({ ...c, settings: change(c.settings) }));
  },

  toastMsg(text, tone = 'info', undo) {
    set({ toast: { id: ++toastSeq, text, tone, undo } });
  },

  dismissToast() {
    set({ toast: null });
  },

  async track(work) {
    set({ tasks: get().tasks + 1 });
    try {
      return await work;
    } finally {
      set({ tasks: Math.max(0, get().tasks - 1) });
    }
  },
}));

/** The app is doing something the user is waiting on. */
export const selectBusy = (s: { pending: boolean; tasks: number; config: unknown }) =>
  s.pending || s.tasks > 0 || s.config === null;
