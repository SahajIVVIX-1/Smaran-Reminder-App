import { app, dialog, powerMonitor, screen } from 'electron';
import { PAUSED_FOREVER } from '@shared/defaults';
import type { AppInfo, PopupTestRequest } from '@shared/ipc';
import { DEFAULT_STYLE_FIELDS } from '@shared/defaults';
import type { Config } from '@shared/schema';
import { BurstRunner } from './scheduler/BurstRunner';
import { isPaused, SchedulerService } from './scheduler/SchedulerService';
import { ConfigStore } from './store/ConfigStore';
import { windowsIsBusy } from './system/focusAssist';
import { applyLoginItem } from './system/loginItem';
import { AppTray } from './tray/Tray';
import { PopupManager, requestForMessage } from './windows/PopupManager';
import {
  getSettingsWindow,
  showMessageInSettings,
  showSettingsWindow,
} from './windows/SettingsWindow';

const TRAY_REFRESH_MS = 30_000;

/** Wires the main-process services together: store → scheduler → burst runner → popups, plus tray. */
export class SmaranApp {
  readonly store: ConfigStore;
  readonly popups: PopupManager;
  readonly runner: BurstRunner;
  readonly scheduler: SchedulerService;
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
    this.popups = new PopupManager(this.store);
    this.runner = new BurstRunner({
      show: (messageId, signal) => {
        const request = requestForMessage(this.store.get(), messageId, true);
        return request ? this.popups.show(request, signal) : Promise.resolve();
      },
      shouldSuppress: () => this.shouldSuppress(),
    });
    this.scheduler = new SchedulerService({
      store: this.store,
      enqueue: (job, overlap) => this.runner.enqueue(job, overlap),
    });
  }

  /** Loads config and starts everything. Returns a notice to show the user, if any. */
  start(): { notice: string | null; firstRun: boolean } {
    const { config, notice } = this.store.load();
    const firstRun = !config.app.onboarded;

    this.popups.registerIpc();
    this.popups.onAction((action) => {
      switch (action.kind) {
        case 'snooze':
          this.runner.snoozeActive(action.minutes);
          break;
        case 'dismissBurst':
          this.runner.cancelActive();
          break;
        case 'editMessage':
          showMessageInSettings(action.messageId);
          break;
        case 'openSettings':
          showSettingsWindow();
          break;
      }
    });

    this.tray = new AppTray({
      showNow: () => this.showNow(),
      pause: (minutes) => this.pause(minutes),
      resume: () => this.resume(),
      openSettings: () => showSettingsWindow(),
      about: () => this.about(),
      quit: () => app.quit(),
    });

    this.store.onChange((next) => {
      this.scheduler.onConfigChanged();
      this.syncSystem(next);
      this.refreshTray();
    });

    // Sleep and lock: catch up once on the way back.
    powerMonitor.on('resume', () => this.scheduler.onResume());
    powerMonitor.on('unlock-screen', () => this.scheduler.onResume());

    this.scheduler.start();
    this.syncSystem(config);
    this.refreshTray();
    this.trayTimer = setInterval(() => this.refreshTray(), TRAY_REFRESH_MS);

    if (config.app.showOnStartup) this.showNow();
    return { notice, firstRun };
  }

  stop(): void {
    this.scheduler.stop();
    this.runner.cancelAll();
    this.popups.closeAll();
    if (this.trayTimer) clearInterval(this.trayTimer);
    this.tray?.destroy();
    this.tray = null;
  }

  /** Tray "Show now": runs the next reminder immediately. */
  showNow(): void {
    const next = this.scheduler.nextSummary();
    if (next) {
      this.scheduler.runNow(next.schedule.id);
      return;
    }
    const config = this.store.get();
    const first = config.schedules.find((s) => s.enabled) ?? config.schedules[0];
    if (first && this.scheduler.runNow(first.id)) return;
    const message = config.messages.find((m) => m.enabled);
    if (message) {
      this.runner.enqueue(
        { scheduleId: 'manual', messageId: message.id, count: 1, gapMs: 0, manual: true },
        'replace',
      );
    }
  }

  pause(minutes?: number): void {
    const until = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : PAUSED_FOREVER;
    this.store.update((c) => ({ ...c, app: { ...c.app, pausedUntil: until } }), { backup: false });
    this.runner.cancelAll();
    this.popups.closeAll();
  }

  resume(): void {
    this.store.update((c) => ({ ...c, app: { ...c.app, pausedUntil: null } }), { backup: false });
  }

  /** Test popups bypass the runner, so they show even while paused. */
  async testPopup(request: PopupTestRequest): Promise<void> {
    const config = this.store.get();
    if ('messageId' in request) {
      const show = requestForMessage(config, request.messageId, false);
      if (show) await this.popups.show(show);
      return;
    }
    await this.popups.show({
      messageId: null,
      text: request.text,
      style: request.style,
      fallback: DEFAULT_STYLE_FIELDS.position,
      inBurst: false,
    });
  }

  info(): AppInfo {
    return {
      version: app.getVersion(),
      dataFolder: this.store.dir,
      portable: this.portable,
      electron: process.versions.electron,
    };
  }

  about(): void {
    const info = this.info();
    const options: Electron.MessageBoxOptions = {
      type: 'info',
      title: 'About Smaran',
      message: `Smaran ${info.version}`,
      detail:
        `Styled reminder popups on your schedule.\n\n` +
        `${info.portable ? 'Portable edition. ' : ''}Settings are stored in:\n${info.dataFolder}\n\n` +
        `Electron ${info.electron}\n© 2026 SahajS`,
      buttons: ['OK'],
    };
    const win = getSettingsWindow();
    void (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options));
  }

  // ---------- internals ----------

  private async shouldSuppress(): Promise<boolean> {
    const config = this.store.get();
    if (isPaused(config, new Date())) return true;
    return config.app.respectFocusAssist && (await windowsIsBusy());
  }

  /**
   * Applies start-at-login once per launch and on every change (so a moved portable exe is
   * re-registered at its new path). Nothing is written until the user has seen the welcome.
   */
  private syncSystem(config: Config): void {
    if (!config.app.onboarded) return;
    if (this.lastLoginItem !== config.app.startAtLogin) {
      this.lastLoginItem = config.app.startAtLogin;
      applyLoginItem(config.app.startAtLogin);
    }
  }

  private refreshTray(): void {
    const config = this.store.get();
    // A timed pause that has run out is cleared so the menu shows "Pause" again.
    if (config.app.pausedUntil && !isPaused(config, new Date())) {
      this.resume();
      return;
    }
    const next = this.scheduler.nextSummary();
    this.tray?.update({
      pausedUntil: config.app.pausedUntil,
      next: next ? { name: next.schedule.name, at: next.at } : null,
    });
  }
}
