import { BrowserWindow, type Display } from 'electron';
import { loadRenderer } from './loadRenderer';

/**
 * Creates and manages a fullscreen click-through transparent overlay window
 * that renders an animated, moving light beam around the perimeter of the screen
 * while notifications or tasks are active.
 */
export class ScreenBorderWindow {
  private win: BrowserWindow | null = null;
  private currentDisplayId: number | null = null;
  private isShown = false;

  constructor(private readonly isEnabled: () => boolean) {}

  show(display: Display): void {
    if (!this.isEnabled()) {
      this.hide();
      return;
    }

    if (this.win && !this.win.isDestroyed()) {
      if (this.currentDisplayId !== display.id) {
        this.win.setBounds(display.bounds);
        this.currentDisplayId = display.id;
      }
      if (!this.isShown) {
        this.win.showInactive();
        this.isShown = true;
      }
      return;
    }

    this.currentDisplayId = display.id;
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true);
    win.setIgnoreMouseEvents(true, { forward: true });

    void loadRenderer(win, 'screenborder').then(() => {
      if (this.win === win && !win.isDestroyed()) {
        win.showInactive();
        this.isShown = true;
      }
    });

    win.on('closed', () => {
      if (this.win === win) {
        this.win = null;
        this.isShown = false;
      }
    });

    this.win = win;
  }

  hide(): void {
    if (this.win && !this.win.isDestroyed() && this.isShown) {
      this.win.hide();
      this.isShown = false;
    }
  }

  destroy(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy();
      this.win = null;
      this.isShown = false;
    }
  }
}
