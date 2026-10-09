import { join } from 'node:path';
import { app, dialog, nativeTheme, powerMonitor, screen } from 'electron';
import { PAUSED_FOREVER } from '@shared/defaults';
import type { AppInfo, Route } from '@shared/ipc';
import type { Config } from '@shared/schema';
import { Engine, isPaused } from './engine/Engine';
import { ConfigStore } from './store/ConfigStore';
import { HistoryStore } from './store/HistoryStore';
import { windowsIsBusy } from './system/focusAssist';
import { FontLibrary } from './system/fonts';
import { applyLoginItem } from './system/loginItem';
import { AppTray } from './tray/Tray';
import { GLASS, getAppWindow, showAppWindow } from './windows/AppWindow';
import { NotificationCenter } from './windows/NotificationCenter';

const TRAY_REFRESH_MS = 30_000;

/** Wires the main-process pieces together: store → engine → notification cards, plus the tray. */
export class SmaranApp {
  readonly store: ConfigStore;
  readonly history: HistoryStore;
  readonly notifications: NotificationCenter;
  readonly engine: Engine;
  readonly fonts: FontLibrary;
  private tray: AppTray | null = null;
  private trayTimer: ReturnType<typeof setInterval> | null = null;
  private lastLoginItem: boolean | null = null;

  constructor(
    dataDir: string,
    private readonly portable: boolean,
  ) {
    this.store = new ConfigStore(dataDir, {
      primaryDisplayId: () => screen.getPrimaryDisplay().id,
    });
    this.history = new HistoryStore(dataDir);
    this.fonts = new FontLibrary(join(dataDir, 'fonts'));
    this.notifications = new NotificationCenter(
      () => this.store.get().settings,
      () => this.fonts.customFonts(),
    );
    this.engine = new Engine({
      store: this.store,
      history: this.history,
      notifier: this.notifications,
      isBusy: windowsIsBusy,
    });
  }

  /** Loads data and starts everything. Returns a notice to show the user, if any. */
  start(): { notice: string | null; firstRun: boolean } {
    const { config, notice } = this.store.load();
    this.history.load();

    this.fonts.serve();
    this.notifications.registerIpc();
    this.notifications.handleActions(
      (key, action) => this.engine.handleAction(key, action),
      () => this.openApp('history'),
    );

    this.tray = new AppTray({
      showNow: () => this.engine.showNow(),
      newReminder: () => this.openApp('reminders'),
      pause: (minutes) => this.pause(minutes),
      resume: () => this.resume(),
      open: () => this.openApp('today'),
      about: () => this.about(),
      quit: () => app.quit(),
    });

    nativeTheme.themeSource = config.settings.theme;
    this.store.onChange((next) => {
      nativeTheme.themeSource = next.settings.theme;
      this.engine.onConfigChanged();
      this.syncSystem(next);
      this.refreshTray();
    });

    // Sleep and lock: handle what came due, once, on the way back.
    powerMonitor.on('resume', () => this.engine.onResume());
    powerMonitor.on('unlock-screen', () => this.engine.onResume());

    this.engine.start();
    this.syncSystem(config);
    this.refreshTray();
    this.trayTimer = setInterval(() => this.refreshTray(), TRAY_REFRESH_MS);
    return { notice, firstRun: !config.settings.onboarded };
  }

  stop(): void {
    this.engine.stop();
    this.notifications.closeAll();
    this.history.flush();
    if (this.trayTimer) clearInterval(this.trayTimer);
    this.tray?.destroy();
    this.tray = null;
  }

  get dark(): boolean {
    const theme = this.store.get().settings.theme;
    return theme === 'system' ? nativeTheme.shouldUseDarkColors : theme === 'dark';
  }

  openApp(route?: Route): void {
    showAppWindow(this.dark, route);
  }

  pause(minutes?: number): void {
    const until = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : PAUSED_FOREVER;
    this.store.update((c) => ({ ...c, settings: { ...c.settings, pausedUntil: until } }), {
      backup: false,
    });
  }

  resume(): void {
    this.store.update((c) => ({ ...c, settings: { ...c.settings, pausedUntil: null } }), {
      backup: false,
    });
  }

  info(): AppInfo {
    return {
      version: app.getVersion(),
      dataFolder: this.store.dir,
      portable: this.portable,
      electron: process.versions.electron,
      glass: GLASS,
    };
  }

  about(): void {
    const info = this.info();
    const options: Electron.MessageBoxOptions = {
      type: 'info',
      title: 'About Smaran',
      message: `Smaran ${info.version}`,
      detail:
        `Gentle reminders, on your schedule.\n\n` +
        `${info.portable ? 'Portable edition. ' : ''}Your reminders are stored in:\n${info.dataFolder}\n\n` +
        `Electron ${info.electron}\n© 2026 SahajS`,
      buttons: ['OK'],
    };
    const win = getAppWindow();
    void (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options));
  }

  // ---------- internals ----------

  /**
   * Applies start-at-login once per launch and on every change (so a moved portable exe is
   * re-registered at its new path). Nothing is written until the user has seen the welcome.
   */
  private syncSystem(config: Config): void {
    if (!config.settings.onboarded) return;
    if (this.lastLoginItem !== config.settings.startAtLogin) {
      this.lastLoginItem = config.settings.startAtLogin;
      applyLoginItem(config.settings.startAtLogin);
    }
  }

  private refreshTray(): void {
    const config = this.store.get();
    // A timed pause that has run out is cleared so the menu shows "Pause" again.
    if (config.settings.pausedUntil && !isPaused(config, new Date())) {
      this.resume();
      return;
    }
    const next = this.engine.upcoming()[0];
    this.tray?.update({
      pausedUntil: config.settings.pausedUntil,
      next: next ? { name: next.reminder.title, at: next.at } : null,
    });
  }
}
