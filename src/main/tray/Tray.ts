import { join } from 'node:path';
import { app, nativeImage, Tray } from 'electron';
import { separator, type MenuEntry } from '@shared/menu';
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

export function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png');
}

/** Tray icon: click opens Smaran; right-click opens Smaran's themed menu. */
export class AppTray {
  private readonly tray: Tray;
  private state: TrayState = { pausedUntil: null, next: null };

  constructor(
    private readonly actions: TrayActions,
    private readonly menu: (items: MenuEntry[]) => Promise<string | null>,
  ) {
    const image = nativeImage
      .createFromPath(iconPath())
      .resize({ width: 16, height: 16, quality: 'best' });
    this.tray = new Tray(image);
    this.tray.on('click', () => this.actions.open());
    this.tray.on('right-click', () => void this.openMenu());
    this.tray.setToolTip(tooltipFor(this.state));
  }

  update(state: TrayState): void {
    this.state = state;
    this.tray.setToolTip(tooltipFor(this.state));
  }

  destroy(): void {
    this.tray.destroy();
  }

  private async openMenu(): Promise<void> {
    const paused = this.state.pausedUntil !== null && new Date(this.state.pausedUntil) > new Date();
    const items: MenuEntry[] = [
      { kind: 'item', id: 'open', label: 'Open Smaran' },
      { kind: 'item', id: 'new', label: 'New reminder…' },
      separator,
      {
        kind: 'item',
        id: 'show',
        label: 'Show next reminder now',
        disabled: this.state.next === null,
      },
      separator,
      ...(paused
        ? [{ kind: 'item', id: 'resume', label: 'Resume reminders' } as const]
        : ([
            { kind: 'heading', label: 'Pause reminders' },
            { kind: 'item', id: 'pause-30', label: 'For 30 minutes' },
            { kind: 'item', id: 'pause-60', label: 'For 1 hour' },
            { kind: 'item', id: 'pause-180', label: 'For 3 hours' },
            { kind: 'item', id: 'pause', label: 'Until I resume' },
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
