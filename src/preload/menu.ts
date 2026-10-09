import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '@shared/channels';
import type { MenuInit } from '@shared/menu';

// Sandboxed preloads may only require 'electron', so the channel names are repeated here;
// `satisfies` keeps them in step with IPC.
const CH = {
  menuInit: 'menu:init',
  menuMeasured: 'menu:measured',
  menuPick: 'menu:pick',
} as const satisfies Partial<typeof IPC>;

// The menu window is reused: main sends a new menu each time it opens.
const api = {
  onInit: (listener: (init: MenuInit) => void): void => {
    ipcRenderer.on(CH.menuInit, (_event, init: MenuInit) => listener(init));
  },
  measured: (w: number, h: number): void => ipcRenderer.send(CH.menuMeasured, { w, h }),
  /** The chosen item's id, or null when the menu was closed without a choice. */
  pick: (id: string | null): void => ipcRenderer.send(CH.menuPick, id),
};

export type SmaranMenuApi = typeof api;

contextBridge.exposeInMainWorld('smaranMenu', api);
