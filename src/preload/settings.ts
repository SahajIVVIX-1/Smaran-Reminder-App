import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '@shared/channels';
import type { AppInfo, BackupResult, NextFire, PopupTestRequest, SaveResult } from '@shared/ipc';
import type { Config, Id } from '@shared/schema';

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// The only bridge between the settings renderer and main. The renderer never sees ipcRenderer.
const api = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  config: {
    get: (): Promise<Config> => ipcRenderer.invoke(IPC.configGet),
    save: (config: Config): Promise<SaveResult> => ipcRenderer.invoke(IPC.configSave, config),
    /** Called after every write, including popup drags. Returns an unsubscribe function. */
    onChanged: (listener: (config: Config) => void): (() => void) =>
      subscribe(IPC.configChanged, listener),
  },
  popup: {
    test: (request: PopupTestRequest): Promise<void> => ipcRenderer.invoke(IPC.popupTest, request),
  },
  schedule: {
    runNow: (scheduleId: Id): Promise<boolean> =>
      ipcRenderer.invoke(IPC.scheduleRunNow, { scheduleId }),
    next: (): Promise<NextFire[]> => ipcRenderer.invoke(IPC.scheduleNext),
  },
  app: {
    pause: (minutes?: number): Promise<void> => ipcRenderer.invoke(IPC.appPause, { minutes }),
    resume: (): Promise<void> => ipcRenderer.invoke(IPC.appResume),
    info: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
    openDataFolder: (): Promise<string> => ipcRenderer.invoke(IPC.appOpenDataFolder),
  },
  fonts: {
    list: (): Promise<string[]> => ipcRenderer.invoke(IPC.fontsList),
  },
  backup: {
    export: (format: 'json' | 'csv'): Promise<BackupResult> =>
      ipcRenderer.invoke(IPC.backupExport, { format }),
    import: (format: 'json' | 'csv' | 'v1'): Promise<BackupResult> =>
      ipcRenderer.invoke(IPC.backupImport, { format }),
  },
  settings: {
    setDirty: (dirty: boolean): void => ipcRenderer.send(IPC.settingsDirty, dirty),
    onFocusMessage: (listener: (messageId: Id) => void): (() => void) =>
      subscribe(IPC.settingsFocusMessage, listener),
  },
};

export type SmaranApi = typeof api;

contextBridge.exposeInMainWorld('smaran', api);
