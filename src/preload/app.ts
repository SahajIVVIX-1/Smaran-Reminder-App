import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '@shared/channels';
import type {
  AppInfo,
  BackupResult,
  FontsAddResult,
  NextFire,
  NotifyTestRequest,
  Route,
  SaveResult,
} from '@shared/ipc';
import type { FontCatalog } from '@shared/fonts';
import type { Config, HistoryEntry, Id } from '@shared/schema';

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// The only bridge between the app window and main. The renderer never sees ipcRenderer.
const api = {
  config: {
    get: (): Promise<Config> => ipcRenderer.invoke(IPC.configGet),
    save: (config: Config): Promise<SaveResult> => ipcRenderer.invoke(IPC.configSave, config),
    /** Every write from anywhere (engine, imports, other edits). Returns an unsubscribe. */
    onChanged: (listener: (config: Config) => void): (() => void) =>
      subscribe(IPC.configChanged, listener),
  },
  history: {
    get: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IPC.historyGet),
    clear: (): Promise<void> => ipcRenderer.invoke(IPC.historyClear),
    onChanged: (listener: (entries: HistoryEntry[]) => void): (() => void) =>
      subscribe(IPC.historyChanged, listener),
  },
  reminders: {
    nextTimes: (): Promise<NextFire[]> => ipcRenderer.invoke(IPC.nextTimes),
    showNow: (reminderId: Id): Promise<boolean> => ipcRenderer.invoke(IPC.showNow, { reminderId }),
    test: (request: NotifyTestRequest): Promise<void> =>
      ipcRenderer.invoke(IPC.notifyTest, request),
  },
  app: {
    pause: (minutes?: number): Promise<void> => ipcRenderer.invoke(IPC.appPause, { minutes }),
    resume: (): Promise<void> => ipcRenderer.invoke(IPC.appResume),
    info: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
    openDataFolder: (): Promise<string> => ipcRenderer.invoke(IPC.appOpenDataFolder),
    /** Tells main the page's theme so the window's caption buttons match. */
    setTheme: (dark: boolean): void => ipcRenderer.send(IPC.appTheme, { dark }),
    onNavigate: (listener: (route: Route) => void): (() => void) =>
      subscribe(IPC.navigate, listener),
  },
  fonts: {
    list: (): Promise<FontCatalog> => ipcRenderer.invoke(IPC.fontsList),
    add: (): Promise<FontsAddResult> => ipcRenderer.invoke(IPC.fontsAdd),
  },
  backup: {
    export: (): Promise<BackupResult> => ipcRenderer.invoke(IPC.backupExport),
    import: (mode: 'replace' | 'add'): Promise<BackupResult> =>
      ipcRenderer.invoke(IPC.backupImport, { mode }),
  },
};

export type SmaranApi = typeof api;

contextBridge.exposeInMainWorld('smaran', api);
