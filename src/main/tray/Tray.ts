import { join } from 'node:path';
import { app, nativeImage, nativeTheme, Tray } from 'electron';
import { separator, type MenuEntry } from '@shared/menu';
import { taskbarIsLight } from './taskbarTheme';
import { tooltipFor, type TrayState } from './tooltip';

export interface TrayActions {
  showNow(): void;
  newReminder(): void;
  pause(minutes?: number): void;
  resume(): void;
  open(): void;
  about(): void;
  quit(): void;
}

function resource(...parts: string[]): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', ...parts)
    : join(app.getAppPath(), 'resources', ...parts);
}

/** The app icon, for windows and dialogs. */
export function iconPath(): string {
  return resource('icon.png');
}

/** Monochrome tray icon: a dark glyph on a light taskbar, a white glyph on a dark one. */
export function trayIconPath(lightTaskbar: boolean): string {
  return resource('tray', lightTaskbar ? 'tray-light.ico' : 'tray-dark.ico');
}

/** Tray icon: click opens Smaran; right-click opens Smaran's themed menu. */
export class AppTray {
  private readonly tray: Tray;
  private state: TrayState = { pausedUntil: null, next: null };
  private lightTaskbar: boolean;

  constructor(
    private readonly actions: TrayActions,
    private readonly menu: (items: MenuEntry[]) => Promise<string | null>,
  ) {
    // First guess from the app theme; refreshIcon() reads the taskbar's own setting.
    this.lightTaskbar = !nativeTheme.shouldUseDarkColors;
    this.tray = new Tray(nativeImage.createFromPath(trayIconPath(this.lightTaskbar)));
    nativeTheme.on('updated', () => void this.refreshIcon());
    void this.refreshIcon();
    this.tray.on('click', () => this.actions.open());
    this.tray.on('right-click', () => void this.openMenu());
    this.tray.setToolTip(tooltipFor(this.state));
  }

  update(state: TrayState): void {
    this.state = state;
    this.tray.setToolTip(tooltipFor(this.state));
  }

  /** Matches the icon to the taskbar's light/dark mode. Cheap; also called on a timer. */
  async refreshIcon(): Promise<void> {
    const light = (await taskbarIsLight()) ?? !nativeTheme.shouldUseDarkColors;
    if (light === this.lightTaskbar || this.tray.isDestroyed()) return;
    this.lightTaskbar = light;
    this.tray.setImage(nativeImage.createFromPath(trayIconPath(light)));
  }

  destroy(): void {
    this.tray.destroy();
  }

  private async openMenu(): Promise<void> {
    const paused = this.state.pausedUntil !== null && new Date(this.state.pausedUntil) > new Date();
    const items: MenuEntry[] = [
      { kind: 'item', id: 'open', label: 'Open Smaran' },
      { kind: 'item', id: 'new', label: 'New Reminder…' },
      separator,
      {
        kind: 'item',
        id: 'show',
        label: 'Show Next Reminder Now',
        disabled: this.state.next === null,
      },
      separator,
      ...(paused
        ? [{ kind: 'item', id: 'resume', label: 'Resume Reminders' } as const]
        : ([
            { kind: 'heading', label: 'Pause Reminders' },
            { kind: 'item', id: 'pause-30', label: 'For 30 Minutes' },
            { kind: 'item', id: 'pause-60', label: 'For 1 Hour' },
            { kind: 'item', id: 'pause-180', label: 'For 3 Hours' },
            { kind: 'item', id: 'pause', label: 'Until I Resume' },
          ] as const)),
      separator,
      { kind: 'item', id: 'about', label: 'About Smaran' },
      { kind: 'item', id: 'quit', label: 'Quit Smaran' },
    ];
    const id = await this.menu(items);
    const a = this.actions;
    if (id === 'open') a.open();
    else if (id === 'new') a.newReminder();
    else if (id === 'show') a.showNow();
    else if (id === 'resume') a.resume();
    else if (id === 'pause') a.pause();
    else if (id?.startsWith('pause-')) a.pause(Number(id.slice(6)));
    else if (id === 'about') a.about();
    else if (id === 'quit') a.quit();
  }
}
