import { contextBridge } from 'electron';

// The only bridge between the settings renderer and main. Later phases add typed
// config, schedule and backup calls here; the renderer never sees ipcRenderer.
const api = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
};

export type SmaranApi = typeof api;

contextBridge.exposeInMainWorld('smaran', api);
