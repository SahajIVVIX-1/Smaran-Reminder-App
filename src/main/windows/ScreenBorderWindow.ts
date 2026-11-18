import { BrowserWindow, type Display } from 'electron';
import { loadRenderer } from './loadRenderer';

export interface ScreenBorderOptions {
  enabled: boolean;
  thickness: number;
  brightness: number;
}

/**
 * Creates and manages a fullscreen click-through transparent overlay window
 * that renders an animated, moving light beam around the perimeter of the screen
 * while notifications or tasks are active.
 *
 * Enters by smooth fade-in and leaves strictly by smooth fade-out.
 */
export class ScreenBorderWindow {
  private win: BrowserWindow | null = null;
  private currentDisplayId: number | null = null;
  private isShown = false;
  private hideTimer: NodeJS.Timeout | null = null;
  private previewTimer: NodeJS.Timeout | null = null;

  constructor(private readonly getOptions: () => ScreenBorderOptions) {}

  show(display: Display): void {
    const opts = this.getOptions();
    if (!opts.enabled) {
      this.hide();
      return;
    }

    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (this.win && !this.win.isDestroyed()) {
      if (this.currentDisplayId !== display.id) {
        this.win.setBounds(display.bounds);
        this.currentDisplayId = display.id;
      }
      this.applyOptions(opts);
      this.triggerFadeIn();
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
        this.applyOptions(opts);
        this.triggerFadeIn();
        win.showInactive();
        this.isShown = true;
      }
    });

    win.on('closed', () => {
      if (this.win === win) {
        this.win = null;
        this.isShown = false;
        if (this.hideTimer) {
          clearTimeout(this.hideTimer);
          this.hideTimer = null;
        }
      }
    });

    this.win = win;
  }

  /**
   * Leaves strictly via smooth fade-out before hiding the window.
   */
  hide(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }

    if (!this.win || this.win.isDestroyed() || !this.isShown) return;

    if (this.hideTimer) return; // already fading out

    this.triggerFadeOut();
    this.hideTimer = setTimeout(() => {
      if (this.win && !this.win.isDestroyed()) {
        this.win.hide();
      }
      this.isShown = false;
      this.hideTimer = null;
    }, 380);
  }

  /**
   * Temporarily fades in the border light for a user preview (e.g. from Settings),
   * then smoothly fades out.
   */
  preview(display: Display, durationMs = 2500): void {
    this.show(display);
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      this.hide();
    }, durationMs);
  }

  /**
   * Updates thickness, brightness, or visibility live while currently shown.
   */
  applyLiveSettings(): void {
    if (this.win && !this.win.isDestroyed() && this.isShown) {
      const opts = this.getOptions();
      if (!opts.enabled) {
        this.hide();
      } else {
        this.applyOptions(opts);
      }
    }
  }

  private applyOptions(opts: ScreenBorderOptions): void {
    if (!this.win || this.win.isDestroyed()) return;
    const script = `window.__borderSetOptions && window.__borderSetOptions(${JSON.stringify({
      thickness: opts.thickness,
      brightness: opts.brightness,
    })});`;
    this.win.webContents.executeJavaScript(script).catch(() => {});
  }

  private triggerFadeIn(): void {
    if (!this.win || this.win.isDestroyed()) return;
    this.win
      .webContents.executeJavaScript('window.__borderFadeIn && window.__borderFadeIn();')
      .catch(() => {});
  }

  private triggerFadeOut(): void {
    if (!this.win || this.win.isDestroyed()) return;
    this.win
      .webContents.executeJavaScript('window.__borderFadeOut && window.__borderFadeOut();')
      .catch(() => {});
  }

  destroy(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy();
      this.win = null;
      this.isShown = false;
    }
  }
}
