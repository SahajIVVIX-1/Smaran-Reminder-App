import { join } from 'node:path';
import {
  app,
  Menu,
  nativeImage,
  nativeTheme,
  Tray,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron';
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

/** Tray icon: click opens Smaran; right-click opens native context menu. */
export class AppTray {
  private readonly tray: Tray;
  private state: TrayState = { pausedUntil: null, next: null };
  private lightTaskbar: boolean;
  private onTaskbar: (light: boolean) => void = () => undefined;

  constructor(
    private readonly actions: TrayActions,
    private readonly onHover: () => void = () => undefined,
  ) {
    // First guess from the app theme; refreshIcon() reads the taskbar's own setting.
    this.lightTaskbar = !nativeTheme.shouldUseDarkColors;
    this.tray = new Tray(nativeImage.createFromPath(trayIconPath(this.lightTaskbar)));
    nativeTheme.on('updated', () => void this.refreshIcon());
    void this.refreshIcon();
    this.tray.on('click', () => this.actions.open());
    this.tray.on('right-click', () => this.openMenu());
    this.tray.on('mouse-enter', () => this.onHover());
    this.tray.setToolTip(tooltipFor(this.state));
  }

  update(state: TrayState): void {
    this.state = state;
    this.tray.setToolTip(tooltipFor(this.state));
  }

  get isLightTaskbar(): boolean {
    return this.lightTaskbar;
  }

  /** Called when the taskbar switches between light and dark. */
  watchTaskbar(listener: (light: boolean) => void): void {
    this.onTaskbar = listener;
  }

  /** One frame of the animated logo. */
  setFrame(image: NativeImage): void {
    if (!this.tray.isDestroyed()) this.tray.setImage(image);
  }

  /** Matches the icon to the taskbar's light/dark mode. Cheap; also called on a timer. */
  async refreshIcon(): Promise<void> {
    const light = (await taskbarIsLight()) ?? !nativeTheme.shouldUseDarkColors;
    if (light === this.lightTaskbar || this.tray.isDestroyed()) return;
    this.lightTaskbar = light;
    this.tray.setImage(nativeImage.createFromPath(trayIconPath(light)));
    this.onTaskbar(light);
  }

  destroy(): void {
    this.tray.destroy();
  }

  private openMenu(): void {
    const paused = this.state.pausedUntil !== null && new Date(this.state.pausedUntil) > new Date();
    const a = this.actions;
    const template: MenuItemConstructorOptions[] = [
      { label: 'Open Smaran', click: () => a.open() },
      { label: 'New Reminder…', click: () => a.newReminder() },
      { type: 'separator' },
      {
        label: 'Show Next Reminder Now',
        enabled: this.state.next !== null,
        click: () => a.showNow(),
      },
      { type: 'separator' },
      ...(paused
        ? [
            {
              label: 'Resume Reminders',
              click: () => a.resume(),
            },
          ]
        : [
            { label: 'Pause Reminders', enabled: false },
            { label: 'For 30 Minutes', click: () => a.pause(30) },
            { label: 'For 1 Hour', click: () => a.pause(60) },
            { label: 'For 3 Hours', click: () => a.pause(180) },
            { label: 'Until I Resume', click: () => a.pause() },
          ]),
      { type: 'separator' },
      { label: 'About Smaran', click: () => a.about() },
      { label: 'Quit Smaran', click: () => a.quit() },
    ];

    const menu = Menu.buildFromTemplate(template);
    this.tray.popUpContextMenu(menu);
  }
}
