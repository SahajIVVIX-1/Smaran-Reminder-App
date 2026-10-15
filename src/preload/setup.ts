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
} as const satisfies Partial<typeof IPC>;

const api = {
  onInit: (listener: (init: SetupInit) => void): void => {
    ipcRenderer.on(CH.setupInit, (_event, init: SetupInit) => listener(init));
  },
  onProgress: (listener: (progress: SetupProgress) => void): void => {
    ipcRenderer.on(CH.setupProgress, (_event, progress: SetupProgress) => listener(progress));
  },
  retry: (): void => ipcRenderer.send(CH.setupRetry),
  close: (): void => ipcRenderer.send(CH.setupClose),
  /** Opens a picker for the license image; installing starts once it is accepted. */
  chooseLicense: (): void => ipcRenderer.send(CH.setupLicense),
};

export type SmaranSetupApi = typeof api;

contextBridge.exposeInMainWorld('smaranSetup', api);
