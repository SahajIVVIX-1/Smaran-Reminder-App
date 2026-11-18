import { app, BrowserWindow, ipcMain, nativeTheme, screen } from 'electron';
import { IPC, MeasuredSchema } from '@shared/ipc';
import type { CustomFont } from '@shared/fonts';
import { MenuEntriesSchema, MenuPickSchema, type MenuEntry, type MenuInit } from '@shared/menu';
import type { Settings } from '@shared/schema';
import { loadRenderer, preloadPath } from './loadRenderer';
import { menuPosition } from './placement';

/** Transparent room round the panel for its shadow (matches PAD in the menu renderer). */
const PAD = 10;
/** If Windows won't give the menu focus, it closes once the pointer has been away this long. */
const AWAY_CLOSE_MS = 250;

/**
 * Smaran's own right-click menu, drawn in its theme instead of the plain Windows one. One small
 * window is kept ready and reused; it closes when you choose, press Escape or click elsewhere.
 */
export class MenuWindow {
  private win: BrowserWindow | null = null;
  private loading: Promise<BrowserWindow> | null = null;
  private pending: ((id: string | null) => void) | null = null;
  private at = { x: 0, y: 0 };
  private watch: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly settings: () => Settings,
    private readonly faces: () => CustomFont[] = () => [],
  ) {}

  registerIpc(): void {
    ipcMain.on(IPC.menuMeasured, (event, payload: unknown) => {
      const win = this.win;
      const size = MeasuredSchema.safeParse(payload);
      if (!win || win.isDestroyed() || event.sender !== win.webContents || !size.success) return;
      if (!this.pending) return;
      const width = Math.ceil(size.data.w);
      const height = Math.ceil(size.data.h);
      const { workArea } = screen.getDisplayNearestPoint(this.at);
      const { x, y } = menuPosition(this.at, { width, height }, workArea, PAD);
      win.setBounds({ x, y, width, height });
      win.setAlwaysOnTop(true, 'pop-up-menu');
      win.show();
      app.focus({ steal: true });
      win.focus();
      this.watchPointer(win);
    });
    ipcMain.on(IPC.menuPick, (event, payload: unknown) => {
      if (!this.win || event.sender !== this.win.webContents) return;
      const id = MenuPickSchema.safeParse(payload);
      this.finish(id.success ? id.data : null);
    });
    // Notification cards ask for a menu with their own items.
    ipcMain.handle(IPC.menuPopup, (_event, payload: unknown) => {
      const items = MenuEntriesSchema.safeParse(payload);
      return items.success ? this.popup(items.data) : null;
    });
  }

  /** Loads the window ahead of time so the first right-click opens instantly. */
  warm(): void {
    void this.ensure();
  }

  /** Shows a menu at the pointer (or `at`); resolves to the chosen id, or null if dismissed. */
  async popup(items: MenuEntry[], at = screen.getCursorScreenPoint()): Promise<string | null> {
    this.finish(null);
    const win = await this.ensure();
    this.at = at;
    const settings = this.settings();
    const init: MenuInit = {
      items,
      theme:
        settings.theme === 'system'
          ? nativeTheme.shouldUseDarkColors
            ? 'dark'
            : 'light'
          : settings.theme,
      font: settings.font,
      faces: this.faces(),
    };
    return new Promise((resolve) => {
      this.pending = resolve;
      win.webContents.send(IPC.menuInit, init);
    });
  }

  close(): void {
    this.finish(null);
  }

  destroy(): void {
    this.finish(null);
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
  }

  private finish(id: string | null): void {
    if (this.watch) clearInterval(this.watch);
    this.watch = null;
    const resolve = this.pending;
    this.pending = null;
    if (this.win && !this.win.isDestroyed() && this.win.isVisible()) this.win.hide();
    resolve?.(id);
  }

  /**
   * Windows sometimes refuses focus to a window opened from a notification, and then clicking
   * elsewhere can't close it. In that case, close once the pointer has wandered off for a while.
   */
  private watchPointer(win: BrowserWindow): void {
    if (this.watch) clearInterval(this.watch);
    let awaySince: number | null = null;
    this.watch = setInterval(() => {
      if (win.isDestroyed() || !win.isVisible()) return this.finish(null);
      if (win.isFocused()) return;
      const p = screen.getCursorScreenPoint();
      const b = win.getBounds();
      const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
      if (inside) awaySince = null;
      else if (awaySince === null) awaySince = Date.now();
      else if (Date.now() - awaySince > AWAY_CLOSE_MS) this.finish(null);
    }, 150);
  }

  private ensure(): Promise<BrowserWindow> {
    if (this.win && !this.win.isDestroyed()) return this.loading ?? Promise.resolve(this.win);
    const win = new BrowserWindow({
      width: 320,
      height: 400,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath('menu'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    win.on('blur', () => this.finish(null));
    win.on('closed', () => {
      if (this.win === win) this.win = null;
      this.finish(null);
    });
    this.win = win;
    this.loading = loadRenderer(win, 'menu').then(() => {
      this.loading = null;
      return win;
    });
    return this.loading;
  }
}
