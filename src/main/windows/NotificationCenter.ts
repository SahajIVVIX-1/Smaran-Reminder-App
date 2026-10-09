import { BrowserWindow, ipcMain, nativeTheme, screen, type WebContents } from 'electron';
import {
  IPC,
  MeasuredSchema,
  NotificationActionSchema,
  type NotificationAction,
  type NotificationInit,
  type NotificationLook,
  type NotificationRequest,
} from '@shared/ipc';
import type { CustomFont } from '@shared/fonts';
import type { Settings } from '@shared/schema';
import type { Notifier } from '../engine/Engine';
import { loadRenderer, preloadPath } from './loadRenderer';
import { pickDisplay, stackLayout, type Size } from './placement';

/** First guess at the window width; the card reports its real size (card + shadow room). */
const WINDOW_WIDTH: Record<Settings['notification']['size'], number> = {
  compact: 336,
  comfortable: 368,
  large: 412,
};
/** Cards already on screen glide to their new place when the stack changes. */
const GLIDE_MS = 220;
const MAX_VISIBLE = 4;
const MEASURE_TIMEOUT_MS = 4000;

interface Card {
  key: string;
  win: BrowserWindow;
  size: Size;
  ready: boolean;
  shown: boolean;
  closing: boolean;
  createdAt: number;
  glide: ReturnType<typeof setInterval> | null;
}

/**
 * Shows notification cards as small always-on-top windows that never take focus, stacked in the
 * chosen corner (newest nearest the corner, up to four at a time; more wait their turn).
 */
export class NotificationCenter implements Notifier {
  private readonly cards = new Map<string, Card>();
  private onAction: (key: string, action: NotificationAction) => void = () => undefined;
  private onOpenApp: () => void = () => undefined;

  constructor(
    private readonly settings: () => Settings,
    private readonly faces: () => CustomFont[] = () => [],
  ) {}

  handleActions(
    handler: (key: string, action: NotificationAction) => void,
    openApp: () => void,
  ): void {
    this.onAction = handler;
    this.onOpenApp = openApp;
  }

  registerIpc(): void {
    ipcMain.on(IPC.notifMeasured, (event, payload: unknown) => {
      const card = this.fromSender(event.sender);
      const size = MeasuredSchema.safeParse(payload);
      if (!card || !size.success) return;
      card.size = { width: Math.ceil(size.data.w), height: Math.ceil(size.data.h) };
      card.ready = true;
      this.layout();
    });
    ipcMain.on(IPC.notifAction, (event, payload: unknown) => {
      const card = this.fromSender(event.sender);
      const action = NotificationActionSchema.safeParse(payload);
      if (card && action.success) this.onAction(card.key, action.data);
    });
    ipcMain.on(IPC.notifDone, (event) => {
      const card = this.fromSender(event.sender);
      if (card) this.destroy(card);
    });
    // The window is sized for the expanded card; outside the card, clicks reach the apps below.
    ipcMain.on(IPC.notifInteractive, (event, on: unknown) => {
      const card = this.fromSender(event.sender);
      if (card && !card.win.isDestroyed())
        card.win.setIgnoreMouseEvents(on !== true, { forward: true });
    });
    ipcMain.on(IPC.navigate, (event) => {
      if (this.fromSender(event.sender)) this.onOpenApp();
    });
  }

  show(request: NotificationRequest): void {
    const settings = this.settings();
    const look: NotificationLook = {
      theme:
        settings.theme === 'system'
          ? nativeTheme.shouldUseDarkColors
            ? 'dark'
            : 'light'
          : settings.theme,
      size: settings.notification.size,
      font: settings.font,
      faces: this.faces(),
    };
    const width = WINDOW_WIDTH[look.size];
    const win = new BrowserWindow({
      width,
      height: 160,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath('notification'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    const card: Card = {
      key: request.key,
      win,
      size: { width, height: 160 },
      ready: false,
      shown: false,
      closing: false,
      createdAt: Date.now(),
      glide: null,
    };
    this.cards.set(request.key, card);
    win.on('closed', () => {
      if (this.cards.get(card.key) === card) {
        this.cards.delete(card.key);
        this.layout();
      }
    });
    win.webContents.once('did-finish-load', () => {
      const init: NotificationInit = { request, look };
      win.webContents.send(IPC.notifInit, init);
    });
    setTimeout(() => {
      if (!card.ready) {
        card.ready = true;
        this.layout();
      }
    }, MEASURE_TIMEOUT_MS);
    void loadRenderer(win, 'notification').catch(() => this.destroy(card));
  }

  /** Plays the card's exit animation, then removes it. */
  close(key: string): void {
    const card = this.cards.get(key);
    if (!card || card.closing) return;
    card.closing = true;
    if (!card.shown || card.win.isDestroyed()) {
      this.destroy(card);
      return;
    }
    card.win.webContents.send(IPC.notifClose);
    setTimeout(() => this.destroy(card), 600); // in case the renderer never answers
  }

  closeAll(): void {
    for (const card of [...this.cards.values()]) this.destroy(card);
  }

  get count(): number {
    return this.cards.size;
  }

  private fromSender(sender: WebContents): Card | undefined {
    for (const card of this.cards.values())
      if (!card.win.isDestroyed() && card.win.webContents === sender) return card;
    return undefined;
  }

  private destroy(card: Card): void {
    if (this.cards.get(card.key) !== card) return;
    this.cards.delete(card.key);
    if (card.glide) clearInterval(card.glide);
    if (!card.win.isDestroyed()) card.win.destroy();
    this.layout();
  }

  /** Places visible cards; newest nearest the corner. Cards beyond the first four wait. */
  private layout(): void {
    const settings = this.settings().notification;
    const display = pickDisplay(
      settings.screen,
      screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, workArea: d.workArea })),
      screen.getPrimaryDisplay().id,
      screen.getCursorScreenPoint(),
    );
    const ready = [...this.cards.values()]
      .filter((c) => c.ready && !c.win.isDestroyed())
      .sort((a, b) => a.createdAt - b.createdAt);
    // The oldest cards stay; newer ones wait for room.
    const visible = ready.slice(0, MAX_VISIBLE).reverse();
    const positions = stackLayout(
      settings.corner,
      display.workArea,
      visible.map((c) => c.size),
    );

    visible.forEach((card, i) => {
      const pos = positions[i];
      if (!pos) return;
      if (card.shown) this.glideTo(card, pos);
      else card.win.setBounds({ ...pos, ...card.size });
      if (!card.shown) {
        card.shown = true;
        card.win.setAlwaysOnTop(true, 'screen-saver');
        card.win.setVisibleOnAllWorkspaces(true);
        card.win.setIgnoreMouseEvents(true, { forward: true });
        card.win.showInactive(); // never takes focus
        card.win.webContents.send(IPC.notifShown, {
          fromBottom: settings.corner.startsWith('bottom'),
          align: settings.corner.endsWith('left')
            ? 'left'
            : settings.corner.endsWith('right')
              ? 'right'
              : 'center',
        });
      }
    });
  }

  /** Eases a visible card to a new spot instead of jumping. */
  private glideTo(card: Card, to: { x: number; y: number }): void {
    if (card.glide) clearInterval(card.glide);
    const from = card.win.getBounds();
    if (from.x === to.x && from.y === to.y) return;
    const start = Date.now();
    card.glide = setInterval(() => {
      if (card.win.isDestroyed()) {
        if (card.glide) clearInterval(card.glide);
        return;
      }
      const t = Math.min(1, (Date.now() - start) / GLIDE_MS);
      const e = 1 - Math.pow(1 - t, 3);
      card.win.setBounds({
        x: Math.round(from.x + (to.x - from.x) * e),
        y: Math.round(from.y + (to.y - from.y) * e),
        ...card.size,
      });
      if (t === 1 && card.glide) {
        clearInterval(card.glide);
        card.glide = null;
      }
    }, 16);
  }
}
