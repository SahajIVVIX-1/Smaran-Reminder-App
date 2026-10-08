import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '@shared/channels';
import type { NotificationAction, NotificationInit } from '@shared/ipc';

// Sandboxed preloads may only require 'electron', so this file must not share a chunk with the
// app preload. The channel names are repeated here; `satisfies` keeps them in step with IPC.
const CH = {
  notifInit: 'notif:init',
  notifShown: 'notif:shown',
  notifMeasured: 'notif:measured',
  notifAction: 'notif:action',
  notifClose: 'notif:close',
  notifDone: 'notif:done',
  navigate: 'app:navigate',
} as const satisfies Partial<typeof IPC>;

// Main identifies the card by its window, so no ids cross this boundary.
const api = {
  onInit: (listener: (init: NotificationInit) => void): void => {
    ipcRenderer.once(CH.notifInit, (_event, init: NotificationInit) => listener(init));
  },
  onShown: (listener: (info: { fromBottom: boolean }) => void): void => {
    ipcRenderer.once(CH.notifShown, (_event, info: { fromBottom: boolean }) => listener(info));
  },
  /** Main asks the card to animate out; answer with done(). */
  onClose: (listener: () => void): void => {
    ipcRenderer.once(CH.notifClose, () => listener());
  },
  measured: (w: number, h: number): void => ipcRenderer.send(CH.notifMeasured, { w, h }),
  act: (action: NotificationAction): void => ipcRenderer.send(CH.notifAction, action),
  done: (): void => ipcRenderer.send(CH.notifDone),
  openApp: (): void => ipcRenderer.send(CH.navigate),
};

export type SmaranNotificationApi = typeof api;

contextBridge.exposeInMainWorld('smaranNotification', api);
