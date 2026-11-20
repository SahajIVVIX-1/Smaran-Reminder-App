import { create } from 'zustand';
import type { ServerStatus } from '@shared/fileserver';
import type { FontCatalog } from '@shared/fonts';
import type { AutomationNext, AutomationRun, NextFire, Route } from '@shared/ipc';
import { plainRich } from '@shared/richText';
import type { Automation, Config, HistoryEntry, Id, Reminder, Settings } from '@shared/schema';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
  undo?: () => void;
}

/** Which reminder the side panel shows: an existing one, or a new one not saved yet. */
export type Editing = { mode: 'edit'; id: Id } | { mode: 'new'; draft: Reminder } | null;

/** Which automation the editor shows. */
export type EditingAutomation =
  { mode: 'edit'; id: Id } | { mode: 'new'; draft: Automation } | null;

interface AppState {
  config: Config | null;
  history: HistoryEntry[];
  nextTimes: NextFire[];
  automationNext: AutomationNext[];
  /** Automations running now (waiting between steps or showing their Cancel card). */
  running: AutomationRun[];
  route: Route;
  editing: Editing;
  editingAutomation: EditingAutomation;
  toast: Toast | null;
  /** True while a local change waits to be saved. */
  pending: boolean;
  /** Tasks in flight (loading, backups, showing a reminder now). */
  tasks: number;
  /** Fonts on this PC and fonts the user added; loaded on demand. */
  fonts: FontCatalog | null;
  /** Authoritative persistent file server status synchronized with main process. */
  fileServerStatus: ServerStatus | null;
  setFileServerStatus(status: ServerStatus): void;
  loadFonts(): Promise<void>;

  init(config: Config, history: HistoryEntry[]): void;
  external(config: Config): void;
  setHistory(history: HistoryEntry[]): void;
  refreshNext(): Promise<void>;
  go(route: Route): void;
  edit(editing: Editing): void;
  editAutomation(editing: EditingAutomation): void;
  setRunning(running: AutomationRun[]): void;
  upsertAutomation(automation: Automation): void;
  removeAutomation(id: Id): void;
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
  automationNext: [],
  running: [],
  route: 'today',
  editing: null,
  editingAutomation: null,
  toast: null,
  pending: false,
  tasks: 0,
  fonts: null,
  fileServerStatus: null,

  setFileServerStatus(fileServerStatus) {
    set({ fileServerStatus });
  },

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
          automations: local.automations,
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
    const [nextTimes, automationNext] = await Promise.all([
      window.smaran.reminders.nextTimes(),
      window.smaran.automations.nextTimes(),
    ]);
    set({ nextTimes, automationNext });
  },

  go(route) {
    set({ route });
  },

  edit(editing) {
    set({ editing });
  },

  editAutomation(editingAutomation) {
    set({ editingAutomation });
  },

  setRunning(running) {
    set({ running });
  },

  upsertAutomation(automation) {
    get().update((c) => {
      const exists = c.automations.some((a) => a.id === automation.id);
      return {
        ...c,
        automations: exists
          ? c.automations.map((a) => (a.id === automation.id ? automation : a))
          : [...c.automations, automation],
      };
    });
  },

  removeAutomation(id) {
    const { config, update, toastMsg, editingAutomation } = get();
    if (!config) return;
    const index = config.automations.findIndex((a) => a.id === id);
    const removed = config.automations[index];
    if (!removed) return;
    update((c) => ({ ...c, automations: c.automations.filter((a) => a.id !== id) }));
    if (editingAutomation?.mode === 'edit' && editingAutomation.id === id)
      set({ editingAutomation: null });
    toastMsg(`Deleted “${removed.name}”`, 'info', () =>
      update((c) => {
        const automations = [...c.automations];
        automations.splice(Math.min(index, automations.length), 0, removed);
        return { ...c, automations };
      }),
    );
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
