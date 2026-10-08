import { join } from 'node:path';
import { app, Menu, nativeImage, Tray } from 'electron';
import { tooltipFor, type TrayState } from './tooltip';

export interface TrayActions {
  showNow(): void;
  pause(minutes?: number): void;
  resume(): void;
  openSettings(): void;
  about(): void;
  quit(): void;
}

export function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png');
}

/** Tray icon with show now, pause, settings and quit. */
export class AppTray {
  private readonly tray: Tray;
  private state: TrayState = { pausedUntil: null, next: null };

  constructor(private readonly actions: TrayActions) {
    const image = nativeImage
      .createFromPath(iconPath())
      .resize({ width: 16, height: 16, quality: 'best' });
    this.tray = new Tray(image);
    this.tray.on('click', () => this.actions.openSettings());
    this.render();
  }

  update(state: TrayState): void {
    this.state = state;
    this.render();
  }

  destroy(): void {
    this.tray.destroy();
  }

  private render(): void {
    const paused = this.state.pausedUntil !== null && new Date(this.state.pausedUntil) > new Date();
    const a = this.actions;
    this.tray.setToolTip(tooltipFor(this.state));
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Show now', click: () => a.showNow() },
        { type: 'separator' },
        paused
          ? { label: 'Resume', click: () => a.resume() }
          : {
              label: 'Pause',
              submenu: [
                { label: 'For 30 minutes', click: () => a.pause(30) },
                { label: 'For 1 hour', click: () => a.pause(60) },
                { label: 'Until I resume', click: () => a.pause() },
              ],
            },
        { type: 'separator' },
        { label: 'Settings…', click: () => a.openSettings() },
        { label: 'About Smaran', click: () => a.about() },
        { type: 'separator' },
        { label: 'Quit Smaran', click: () => a.quit() },
      ]),
    );
  }
}
