import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '@shared/channels';
import type { PopupInit } from '@shared/ipc';

// Sandboxed preloads may only require 'electron', so this file must not share a chunk with the
// settings preload. The channel names are repeated here; `satisfies` keeps them in step with IPC.
const CH = {
  popupInit: 'popup:init',
  popupShown: 'popup:shown',
  popupMeasured: 'popup:measured',
  popupDone: 'popup:done',
  popupContextMenu: 'popup:contextMenu',
  popupDragMove: 'popup:dragMove',
  popupDragEnd: 'popup:dragEnd',
} as const satisfies Partial<typeof IPC>;

// Popup bridge. Main identifies the popup by its window, so no ids cross this boundary.
const api = {
  onInit: (listener: (init: PopupInit) => void): void => {
    ipcRenderer.once(CH.popupInit, (_event, init: PopupInit) => listener(init));
  },
  onShown: (listener: () => void): void => {
    ipcRenderer.once(CH.popupShown, () => listener());
  },
  measured: (w: number, h: number): void => ipcRenderer.send(CH.popupMeasured, { w, h }),
  done: (): void => ipcRenderer.send(CH.popupDone),
  contextMenu: (): void => ipcRenderer.send(CH.popupContextMenu),
  dragMove: (x: number, y: number): void => ipcRenderer.send(CH.popupDragMove, { x, y }),
  dragEnd: (): void => ipcRenderer.send(CH.popupDragEnd),
};

export type SmaranPopupApi = typeof api;

contextBridge.exposeInMainWorld('smaranPopup', api);
