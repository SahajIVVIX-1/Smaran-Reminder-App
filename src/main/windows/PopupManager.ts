import {
  BrowserWindow,
  Menu,
  ipcMain,
  screen,
  type IpcMainEvent,
  type WebContents,
} from 'electron';
import { effectiveStyle, resolveStyle } from '@shared/effectiveStyle';
import { IPC, PopupDragMoveSchema, PopupMeasuredSchema, type PopupInit } from '@shared/ipc';
import type { Config, Id, Placement, StyleFields } from '@shared/schema';
import type { ConfigStore } from '../store/ConfigStore';
import { loadRenderer, preloadPath } from './loadRenderer';
import { resolvePlacement, toExactPlacement, type DisplayInfo, type Size } from './placement';

export interface ShowRequest {
  /** Message the popup belongs to; drags save their position here. Null for unsaved test text. */
  messageId: Id | null;
  text: string;
  style: StyleFields;
  /** Used when `style.position` is an exact spot on a display that is gone. */
  fallback: Placement;
  /** Popups shown by a schedule burst offer snooze / dismiss-burst. */
  inBurst: boolean;
}

export type PopupAction =
  | { kind: 'snooze'; minutes: number }
  | { kind: 'dismissBurst' }
  | { kind: 'editMessage'; messageId: Id }
  | { kind: 'openSettings' };

export type PopupActionHandler = (action: PopupAction) => void;

interface Popup {
  win: BrowserWindow;
  request: ShowRequest;
  size: Size;
  shown: boolean;
  finish: () => void;
}

const MEASURE_TIMEOUT_MS = 5000;

/** Builds the show request for a saved message, or null if it no longer exists. */
export function requestForMessage(
  config: Config,
  messageId: Id,
  inBurst: boolean,
): ShowRequest | null {
  const message = config.messages.find((m) => m.id === messageId);
  if (!message) return null;
  return {
    messageId,
    text: message.text,
    style: effectiveStyle(message, config.styles),
    fallback: resolveStyle(message.styleId, config.styles).position,
    inBurst,
  };
}

/**
 * Creates one frameless, transparent, always-on-top, non-focusable window per popup.
 * show() resolves when the popup has faded out, was closed, or `signal` aborted it.
 */
export class PopupManager {
  private readonly popups = new Map<number, Popup>();
  private actionHandler: PopupActionHandler = () => undefined;

  constructor(private readonly store: ConfigStore) {}

  onAction(handler: PopupActionHandler): void {
    this.actionHandler = handler;
  }

  registerIpc(): void {
    ipcMain.on(IPC.popupMeasured, (event, payload: unknown) => {
      const popup = this.fromSender(event.sender);
      const size = PopupMeasuredSchema.safeParse(payload);
      if (popup && size.success)
        this.reveal(popup, { width: Math.ceil(size.data.w), height: Math.ceil(size.data.h) });
    });
    ipcMain.on(IPC.popupDone, (event) => this.fromSender(event.sender)?.finish());
    ipcMain.on(IPC.popupContextMenu, (event) => this.showMenu(event));
    ipcMain.on(IPC.popupDragMove, (event, payload: unknown) => {
      const popup = this.fromSender(event.sender);
      const pos = PopupDragMoveSchema.safeParse(payload);
      if (popup && pos.success && !popup.win.isDestroyed()) {
        popup.win.setBounds({
          x: Math.round(pos.data.x),
          y: Math.round(pos.data.y),
          ...popup.size,
        });
      }
    });
    ipcMain.on(IPC.popupDragEnd, (event) => {
      const popup = this.fromSender(event.sender);
      if (popup) this.savePosition(popup);
    });
  }

  show(request: ShowRequest, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const initial: Size =
        request.style.size.mode === 'fixed'
          ? { width: request.style.size.widthPx, height: request.style.size.heightPx }
          : { width: request.style.size.maxWidthPx, height: 200 };

      const win = new BrowserWindow({
        ...initial,
        frame: false,
        transparent: true,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        show: false,
        hasShadow: false,
        backgroundColor: '#00000000',
        webPreferences: {
          preload: preloadPath('popup'),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      const id = win.webContents.id;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.popups.delete(id);
        signal?.removeEventListener('abort', finish);
        clearTimeout(measureTimer);
        if (!win.isDestroyed()) win.destroy();
        resolve();
      };

      const popup: Popup = { win, request, size: initial, shown: false, finish };
      this.popups.set(id, popup);

      signal?.addEventListener('abort', finish, { once: true });
      win.on('closed', finish);
      // If the renderer never reports its size, show it at the initial size anyway.
      const measureTimer = setTimeout(() => this.reveal(popup, initial), MEASURE_TIMEOUT_MS);

      win.webContents.once('did-finish-load', () => {
        const init: PopupInit = { text: request.text, style: request.style };
        win.webContents.send(IPC.popupInit, init);
      });
      void loadRenderer(win, 'popup').catch(finish);
    });
  }

  /** Closes every popup (quit, pause). */
  closeAll(): void {
    for (const popup of [...this.popups.values()]) popup.finish();
  }

  get openCount(): number {
    return this.popups.size;
  }

  // ---------- internals ----------

  private fromSender(sender: WebContents): Popup | undefined {
    return this.popups.get(sender.id);
  }

  private reveal(popup: Popup, size: Size): void {
    if (popup.shown || popup.win.isDestroyed()) return;
    popup.shown = true;
    popup.size = size;
    const pos = resolvePlacement(popup.request.style.position, popup.request.fallback, size, {
      displays: displays(),
      primaryId: screen.getPrimaryDisplay().id,
      cursor: screen.getCursorScreenPoint(),
    });
    popup.win.setBounds({ x: pos.x, y: pos.y, ...size });
    popup.win.setAlwaysOnTop(true, 'screen-saver');
    popup.win.setVisibleOnAllWorkspaces(true);
    popup.win.showInactive(); // never takes focus
    popup.win.webContents.send(IPC.popupShown);
  }

  private savePosition(popup: Popup): void {
    const { messageId } = popup.request;
    if (!messageId || popup.win.isDestroyed()) return;
    const bounds = popup.win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const position = toExactPlacement(bounds, display);
    this.store.update(
      (config) => ({
        ...config,
        messages: config.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                overrides: { ...m.overrides, position },
                updatedAt: new Date().toISOString(),
              }
            : m,
        ),
      }),
      { backup: false },
    );
  }

  private showMenu(event: IpcMainEvent): void {
    const popup = this.fromSender(event.sender);
    if (!popup) return;
    const { messageId, inBurst } = popup.request;
    const act = (action: PopupAction) => () => this.actionHandler(action);

    const template: Electron.MenuItemConstructorOptions[] = [];
    if (inBurst) {
      template.push(
        { label: 'Snooze 5 minutes', click: act({ kind: 'snooze', minutes: 5 }) },
        { label: 'Snooze 15 minutes', click: act({ kind: 'snooze', minutes: 15 }) },
        { label: 'Snooze 1 hour', click: act({ kind: 'snooze', minutes: 60 }) },
        { type: 'separator' },
        { label: 'Dismiss this burst', click: act({ kind: 'dismissBurst' }) },
      );
    } else {
      template.push({ label: 'Close', click: () => popup.finish() });
    }
    template.push({ type: 'separator' });
    if (messageId) {
      template.push({ label: 'Edit this message', click: act({ kind: 'editMessage', messageId }) });
    }
    template.push({ label: 'Open settings', click: act({ kind: 'openSettings' }) });

    Menu.buildFromTemplate(template).popup({ window: popup.win });
  }
}

function displays(): DisplayInfo[] {
  return screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, workArea: d.workArea }));
}
