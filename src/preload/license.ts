import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '@shared/channels';
import type { LicenseImportResult, LicenseInfo } from '@shared/license/info';

// Sandboxed preloads may only require 'electron', so the channel names are repeated here;
// `satisfies` keeps them in step with IPC.
const CH = {
  licenseGet: 'license:get',
  licenseImport: 'license:import',
  licenseActivate: 'license:activate',
  licenseQuit: 'license:quit',
} as const satisfies Partial<typeof IPC>;

const api = {
  get: (): Promise<LicenseInfo> => ipcRenderer.invoke(CH.licenseGet),
  /** Opens a file picker and imports the chosen license image. */
  import: (): Promise<LicenseImportResult> => ipcRenderer.invoke(CH.licenseImport),
  /** Confirms activation to main process after verification animation. */
  activate: (): Promise<void> => ipcRenderer.invoke(CH.licenseActivate),
  quit: (): void => ipcRenderer.send(CH.licenseQuit),
};

export type SmaranLicenseApi = typeof api;

contextBridge.exposeInMainWorld('smaranLicense', api);
