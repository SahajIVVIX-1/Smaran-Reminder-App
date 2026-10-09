import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '@shared/channels';
import type { NotificationAction, NotificationInit } from '@shared/ipc';
import type { MenuEntry } from '@shared/menu';

/** Where the card sits, so it slides in from the nearest edge and lines up with its corner. */
export interface ShownInfo {
  fromBottom: boolean;
  align: 'left' | 'center' | 'right';
}

// Sandboxed preloads may only require 'electron', so this file must not share a chunk with the
// app preload. The channel names are repeated here; `satisfies` keeps them in step with IPC.
const CH = {
  notifInit: 'notif:init',
  notifShown: 'notif:shown',
  notifMeasured: 'notif:measured',
  notifAction: 'notif:action',
  notifClose: 'notif:close',
  notifDone: 'notif:done',
  notifInteractive: 'notif:interactive',
  notifShape: 'notif:shape',
  menuPopup: 'menu:popup',
  navigate: 'app:navigate',
} as const satisfies Partial<typeof IPC>;

// Main identifies the card by its window, so no ids cross this boundary.
const api = {
  onInit: (listener: (init: NotificationInit) => void): void => {
    ipcRenderer.once(CH.notifInit, (_event, init: NotificationInit) => listener(init));
  },
  onShown: (listener: (info: ShownInfo) => void): void => {
    ipcRenderer.once(CH.notifShown, (_event, info: ShownInfo) => listener(info));
  },
  /** Main asks the card to animate out; answer with done(). */
  onClose: (listener: () => void): void => {
    ipcRenderer.once(CH.notifClose, () => listener());
  },
  measured: (w: number, h: number): void => ipcRenderer.send(CH.notifMeasured, { w, h }),
  act: (action: NotificationAction): void => ipcRenderer.send(CH.notifAction, action),
  done: (): void => ipcRenderer.send(CH.notifDone),
  /** The card's visible height changed (pill ↔ expanded). */
  shape: (h: number): void => ipcRenderer.send(CH.notifShape, { h }),
  /** True while the pointer is over the card; elsewhere clicks pass through to what's below. */
  interactive: (on: boolean): void => ipcRenderer.send(CH.notifInteractive, on),
  openApp: (): void => ipcRenderer.send(CH.navigate),
  /** Opens Smaran's themed menu at the pointer; resolves to the chosen id, or null. */
  menu: (items: MenuEntry[]): Promise<string | null> => ipcRenderer.invoke(CH.menuPopup, items),
};

export type SmaranNotificationApi = typeof api;

contextBridge.exposeInMainWorld('smaranNotification', api);
