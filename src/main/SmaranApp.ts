import { uptime } from 'node:os';
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  nativeImage,
  nativeTheme,
  powerMonitor,
  screen,
} from 'electron';
import { PAUSED_FOREVER } from '@shared/defaults';
import { IPC, type AppInfo, type Route } from '@shared/ipc';
import type { LogoState } from '@shared/logoState';
import { plainRich } from '@shared/richText';
import { inWindow } from '@shared/time';
import type { Config } from '@shared/schema';
import { runAction } from './automations/actions';
import { AutomationEngine, CARD_PREFIX } from './automations/AutomationEngine';
import type { FileServerSecurityEvent } from '@shared/fileserver';
import type { AppNotification } from '@shared/notifications';
import { Engine, isPaused } from './engine/Engine';
import { FileServerManager } from './fileserver/FileServerManager';
import { LogoAnimator } from './logo/LogoAnimator';
import { LogoConductor } from './logo/LogoConductor';
import { ConfigStore } from './store/ConfigStore';
import { HistoryStore } from './store/HistoryStore';
import { NotificationStore } from './store/NotificationStore';
import { windowsIsBusy } from './system/focusAssist';
import { FontLibrary } from './system/fonts';
import { applyLoginItem, launchedHidden } from './system/loginItem';
import { AppTray, iconPath } from './tray/Tray';
import { GLASS, getAppWindow, setWindowBehavior, showAppWindow } from './windows/AppWindow';
import { MenuWindow } from './windows/MenuWindow';
import { NotificationCenter } from './windows/NotificationCenter';

const TRAY_REFRESH_MS = 30_000;
/** Smaran started at sign-in this soon after Windows started counts as the computer starting. */
const BOOT_WINDOW_SEC = 15 * 60;

/** Wires the main-process pieces together: store → engine → notification cards, plus the tray. */
export class SmaranApp {
  readonly store: ConfigStore;
  readonly history: HistoryStore;
  readonly notifications: NotificationCenter;
  readonly engine: Engine;
  readonly automations: AutomationEngine;
  readonly fonts: FontLibrary;
  readonly menu: MenuWindow;
  readonly fileserver: FileServerManager;
  readonly notificationStore: NotificationStore;
  private tray: AppTray | null = null;
  private logoAnimator: LogoAnimator | null = null;
  private logo: LogoConductor | null = null;
  private trayTimer: ReturnType<typeof setInterval> | null = null;
  private lastLoginItem: boolean | null = null;
  private quitting = false;

  constructor(
    dataDir: string,
    private readonly portable: boolean,
    private readonly isLicenseValid?: () => boolean,
  ) {
    this.store = new ConfigStore(dataDir, {
      primaryDisplayId: () => screen.getPrimaryDisplay().id,
    });
    this.history = new HistoryStore(dataDir);
    this.notificationStore = new NotificationStore(dataDir);
    this.fonts = new FontLibrary(join(dataDir, 'fonts'));
    this.notifications = new NotificationCenter(
      () => this.store.get().settings,
      () => this.fonts.customFonts(),
      () => this.fileserver.getSettings(),
    );
    this.menu = new MenuWindow(
      () => this.store.get().settings,
      () => this.fonts.customFonts(),
    );
    this.engine = new Engine({
      store: this.store,
      history: this.history,
      notifier: this.notifications,
      isBusy: windowsIsBusy,
    });
    this.automations = new AutomationEngine({
      store: this.store,
      history: this.history,
      notifier: this.notifications,
      run: runAction,
      idleSeconds: () => powerMonitor.getSystemIdleTime(),
    });
    this.fileserver = new FileServerManager(dataDir, this.isLicenseValid);
    this.fileserver.setSecurityEventListener((event) => this.handleSecurityEvent(event));
  }

  /** Loads data and starts everything. Returns a notice to show the user, if any. */
  start(): { notice: string | null; firstRun: boolean } {
    const { config, notice } = this.store.load();
    this.history.load();

    setWindowBehavior(() => ({
      minimizeToTray: this.store.get().settings.minimizeToTray ?? false,
      closeToTray: this.store.get().settings.closeToTray ?? true,
    }));

    this.fonts.serve();
    this.notifications.registerIpc();
    this.menu.registerIpc();
    this.notifications.handleActions(
      (key, action) => {
        if (key.startsWith(CARD_PREFIX)) {
          this.automations.handleCard(key, action);
          return;
        }
        this.engine.handleAction(key, action);
        if (action.kind === 'done') this.logo?.flash('done');
        else if (action.kind === 'snooze') this.logo?.flash('snoozed');
      },
      () => this.openApp('history'),
    );

    this.tray = new AppTray(
      {
        showNow: () => this.engine.showNow(),
        newReminder: () => this.openApp('reminders'),
        pause: (minutes) => this.pause(minutes),
        resume: () => this.resume(),
        open: () => this.openApp('today'),
        about: () => this.about(),
        quit: () => this.quit(),
      },
      () => this.logo?.flourish(true),
    );
    this.menu.warm();

    // The animated dots in the tray, frame by frame.
    // The taskbar button keeps the app icon (resources/icon.png); only the tray animates.
    this.logoAnimator = new LogoAnimator((trayImage) => this.tray?.setFrame(trayImage));
    this.logoAnimator.registerIpc();
    this.logo = new LogoConductor(this.logoAnimator, (state) => {
      for (const win of BrowserWindow.getAllWindows())
        if (!win.isDestroyed()) win.webContents.send(IPC.logoState, state);
    });
    this.notifications.watchCount((showing) => this.logo?.set({ showing }));
    this.tray.watchTaskbar((light) => this.logo?.setLightTaskbar(light));
    this.logo.start(this.tray.isLightTaskbar, config.settings.logo);

    nativeTheme.themeSource = config.settings.theme;
    this.store.onChange((next) => {
      nativeTheme.themeSource = next.settings.theme;
      this.engine.onConfigChanged();
      this.automations.onConfigChanged();
      this.syncSystem(next);
      this.logo?.configure(next.settings.logo);
      this.notifications.onConfigChanged();
      this.refreshTray();
    });

    // Sleep and lock: handle what came due, once, on the way back.
    powerMonitor.on('resume', () => this.engine.onResume());
    powerMonitor.on('unlock-screen', () => this.engine.onResume());

    // Windows events for automations.
    powerMonitor.on('lock-screen', () => this.automations.onEvent('lock'));
    powerMonitor.on('unlock-screen', () => this.automations.onEvent('unlock'));
    powerMonitor.on('suspend', () => this.automations.onEvent('sleep'));
    powerMonitor.on('resume', () => this.automations.onEvent('wake'));
    powerMonitor.on('on-ac', () => this.automations.onEvent('pluggedIn'));
    powerMonitor.on('on-battery', () => this.automations.onEvent('onBattery'));

    this.engine.start();
    const serverSettings = this.fileserver.getSettings();
    const canStart = !this.isLicenseValid || this.isLicenseValid();
    if (canStart && serverSettings.autoStart === true) {
      void this.fileserver.start();
    }
    const signIn = launchedHidden();
    this.automations.start({ signIn, boot: signIn && uptime() < BOOT_WINDOW_SEC });
    this.syncSystem(config);
    this.refreshTray();
    this.trayTimer = setInterval(() => {
      this.refreshTray();
      void this.tray?.refreshIcon();
    }, TRAY_REFRESH_MS);
    return { notice, firstRun: !config.settings.onboarded };
  }

  quit(): void {
    if (this.quitting) return;
    this.quitting = true;
    this.notifications.closeAll();
    this.engine.stop();
    this.automations.stop();
    this.fileserver.stopSync();
    this.menu.destroy();
    this.logo?.stop();
    this.logoAnimator?.destroy();
    this.history.flush();
    if (this.trayTimer) clearInterval(this.trayTimer);
    this.tray?.destroy();
    this.tray = null;
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.destroy();
    }
    app.exit(0);
  }

  stop(): void {
    if (this.quitting) return;
    this.quit();
  }

  /** What the Smaran dots are showing (for the title bar when it opens). */
  get logoState(): LogoState {
    return this.logo?.current ?? 'idle';
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
      type: 'none',
      icon: nativeImage.createFromPath(iconPath()),
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
    const now = new Date();
    const { quietHours } = config.settings;
    this.logo?.set({
      paused: isPaused(config, now),
      quiet: quietHours.enabled && inWindow(quietHours, now),
      nextAt: next?.at ?? null,
    });
    this.tray?.update({
      pausedUntil: config.settings.pausedUntil,
      next: next ? { name: plainRich(next.reminder.title), at: next.at } : null,
    });
  }

  private handleSecurityEvent(event: FileServerSecurityEvent): void {
    if (this.quitting) return;
    const fsSettings = this.fileserver.getSettings();
    const nowIso = event.timestamp || new Date().toISOString();

    let title = 'Smaran File Server Event';
    let body = event.details || '';
    let category: 'fileserver' | 'security' = 'fileserver';
    let severity: 'info' | 'success' | 'warning' | 'critical' = 'info';
    let shouldNotify = false;

    if (event.type === 'login') {
      title = 'Smaran File Server – New Login';
      body = `User “${event.username}” logged in from ${event.clientIp} (${event.accessType || 'LAN'})`;
      category = 'fileserver';
      severity = 'success';
      shouldNotify = fsSettings.notifyOnLogin ?? true;
    } else if (event.type === 'failedLogin') {
      const rep = (event.repeatCount ?? 1) > 1 ? ` (Attempt #${event.repeatCount})` : '';
      title = 'Smaran Security Alert – Failed Login';
      body = `Rejected login for “${event.username}” from ${event.clientIp}${rep}. Reason: ${event.reason || 'Invalid credentials'}`;
      category = 'security';
      severity = (event.repeatCount ?? 1) >= 3 ? 'critical' : 'warning';
      shouldNotify = fsSettings.notifyOnFailedLogin ?? true;
    } else if (event.type === 'logout') {
      title = 'Smaran File Server – Logout';
      body = `User “${event.username}” disconnected from ${event.clientIp}`;
      category = 'fileserver';
      severity = 'info';
      shouldNotify = false;
    } else if (event.type === 'adminActivity') {
      title = 'Smaran File Server – Configuration Changed';
      body = event.details || 'Administrator modified file server settings';
      category = 'fileserver';
      severity = 'info';
      shouldNotify = fsSettings.notifyOnAdminActivity ?? true;
    }

    // 1. Persistent Notification Center Inbox
    const notifItem: AppNotification = {
      id: event.id || crypto.randomUUID(),
      category,
      title,
      description: body,
      timestamp: nowIso,
      severity,
      read: false,
      source: 'fileserver',
      metadata: {
        username: event.username,
        clientIp: event.clientIp,
        userAgent: event.userAgent,
        accessType: event.accessType,
        repeatCount: event.repeatCount,
      },
    };
    this.notificationStore.add(notifItem);

    // 2. Permanent Audit History
    this.history.add({
      id: crypto.randomUUID(),
      reminderId: 'fileserver',
      title,
      dueAt: nowIso,
      at: nowIso,
      outcome: event.type,
      detail: body,
      category,
      severity,
      metadata: notifItem.metadata,
    });

    // 3. Desktop Notification Card
    if (shouldNotify) {
      this.notifications.show({
        key: `fs-${event.id || crypto.randomUUID()}`,
        reminderId: null,
        title,
        body,
        color: severity === 'critical' ? 'rose' : severity === 'warning' ? 'amber' : 'clay',
        important: severity === 'critical' || severity === 'warning',
        label: category === 'security' ? 'Security Alert' : 'File Server',
        category: category as 'fileserver' | 'security',
        hideAfterSec: 8,
        sound: true,
        details: {
          username: event.username,
          clientIp: event.clientIp,
          userAgent: event.userAgent,
          accessType: event.accessType,
          repeatCount: event.repeatCount,
          reason: event.reason,
        },
      });
    }
  }
}
