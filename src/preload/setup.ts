import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '@shared/channels';
import type { SetupInit, SetupProgress } from '@shared/setup';

// Sandboxed preloads may only require 'electron', so the channel names are repeated here;
// `satisfies` keeps them in step with IPC.
const CH = {
  setupInit: 'setup:init',
  setupProgress: 'setup:progress',
  setupRetry: 'setup:retry',
  setupClose: 'setup:close',
  setupLicense: 'setup:license',
  setupUninstall: 'setup:uninstall',
} as const satisfies Partial<typeof IPC>;

// Main may send before the page has subscribed (React mounts after the init arrives), so the
// latest message of each kind is kept and handed to listeners when they subscribe.
let lastInit: SetupInit | null = null;
let lastProgress: SetupProgress | null = null;
const initListeners = new Set<(init: SetupInit) => void>();
const progressListeners = new Set<(progress: SetupProgress) => void>();

ipcRenderer.on(CH.setupInit, (_event, init: SetupInit) => {
  lastInit = init;
  for (const l of initListeners) l(init);
});
ipcRenderer.on(CH.setupProgress, (_event, progress: SetupProgress) => {
  lastProgress = progress;
  for (const l of progressListeners) l(progress);
});

const api = {
  onInit: (listener: (init: SetupInit) => void): (() => void) => {
    initListeners.add(listener);
    if (lastInit) listener(lastInit);
    return () => initListeners.delete(listener);
  },
  onProgress: (listener: (progress: SetupProgress) => void): (() => void) => {
    progressListeners.add(listener);
    if (lastProgress) listener(lastProgress);
    return () => progressListeners.delete(listener);
  },
  retry: (): void => ipcRenderer.send(CH.setupRetry),
  close: (): void => ipcRenderer.send(CH.setupClose),
  /** Opens a picker for the license image; installing starts once it is accepted. */
  chooseLicense: (): void => ipcRenderer.send(CH.setupLicense),
  /** Uninstall: go ahead, optionally deleting reminders and settings too. */
  uninstall: (deleteData: boolean): void => ipcRenderer.send(CH.setupUninstall, deleteData),
};

export type SmaranSetupApi = typeof api;

contextBridge.exposeInMainWorld('smaranSetup', api);
