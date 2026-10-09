import { BrowserWindow, ipcMain, nativeImage, screen, type NativeImage } from 'electron';
import { IPC } from '@shared/ipc';
import type { LogoFrame, LogoPlay } from '@shared/logoArt';
import type { LogoAnimation } from '@shared/logoState';
import { loadRenderer, preloadPath } from '../windows/loadRenderer';

/**
 * Tray icons are 16 px at 100 % scaling. The taskbar button shows 24-32 px; it gets a 64 px frame
 * that Windows scales down smoothly, so its edges stay clean.
 */
const TRAY_PX = 16;
const WINDOW_PX = 64;

/**
 * Animates the Smaran dots frame by frame for the notification-area icon and the taskbar button.
 * A hidden page runs the dots engine and sends PNG frames; each one is swapped in with
 * Tray.setImage (Shell_NotifyIcon under the hood) and BrowserWindow.setIcon. Frames only flow
 * while something is moving, so a still logo costs nothing.
 */
export class LogoAnimator {
  private win: BrowserWindow | null = null;
  private ready: Promise<void> | null = null;

  constructor(private readonly onFrame: (tray: NativeImage, window: NativeImage) => void) {}

  registerIpc(): void {
    ipcMain.on(IPC.logoFrame, (event, frame: LogoFrame) => {
      if (!this.win || event.sender !== this.win.webContents) return;
      if (!(frame?.tray instanceof Uint8Array) || !(frame.window instanceof Uint8Array)) return;
      if (frame.tray.length === 0 || frame.window.length === 0) return;
      const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
      const tray = nativeImage.createFromBuffer(Buffer.from(frame.tray), { scaleFactor });
      const window = nativeImage.createFromBuffer(Buffer.from(frame.window), { scaleFactor });
      if (!tray.isEmpty() && !window.isEmpty()) this.onFrame(tray, window);
    });
  }

  play(animation: LogoAnimation, lightTaskbar: boolean, flourish = false): void {
    const scale = screen.getPrimaryDisplay().scaleFactor;
    const play: LogoPlay = {
      ...animation,
      lightTaskbar,
      flourish,
      traySize: Math.round(TRAY_PX * scale),
      windowSize: Math.round(WINDOW_PX * scale),
    };
    void this.ensure().then(() => {
      if (this.win && !this.win.isDestroyed()) this.win.webContents.send(IPC.logoPlay, play);
    });
  }

  destroy(): void {
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
    this.ready = null;
  }

  private ensure(): Promise<void> {
    if (this.ready && this.win && !this.win.isDestroyed()) return this.ready;
    const win = new BrowserWindow({
      show: false,
      width: 64,
      height: 64,
      skipTaskbar: true,
      focusable: false,
      webPreferences: {
        preload: preloadPath('trayart'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        // Keep animating while hidden.
        backgroundThrottling: false,
      },
    });
    win.on('closed', () => {
      if (this.win === win) {
        this.win = null;
        this.ready = null;
      }
    });
    this.win = win;
    this.ready = loadRenderer(win, 'trayart');
    return this.ready;
  }
}
