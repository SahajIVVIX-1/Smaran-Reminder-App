import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type SaveResult } from '@shared/ipc';
import type { Config } from '@shared/schema';

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
    onChanged: (listener: (config: Config) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, config: Config) => listener(config);
      ipcRenderer.on(IPC.configChanged, handler);
      return () => ipcRenderer.removeListener(IPC.configChanged, handler);
    },
  },
};

export type SmaranApi = typeof api;

contextBridge.exposeInMainWorld('smaran', api);
