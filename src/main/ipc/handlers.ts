import * as fs from 'node:fs';
import { BrowserWindow, dialog, screen, shell } from 'electron';
import { z } from 'zod';
import {
  AutomationIdSchema,
  BackupImportSchema,
  EditCommandSchema,
  IPC,
  NotifyTestSchema,
  PauseSchema,
  PickSchema,
  ShowNowSchema,
  ThemeSchema,
  type AppInfo,
  type BackupResult,
  type FontsAddResult,
  type PickWhat,
} from '@shared/ipc';
import { ConfigSchema } from '@shared/schema';
import { detectBrowsers } from '../automations/browsers';
import type { SmaranApp } from '../SmaranApp';
import { registerFileServerIpc } from '../fileserver/ipc';
import { exportJson, mergeReminders, parseBackupJson } from '../store/backup';
import { setTitleBarTheme } from '../windows/AppWindow';
import { registerSafeHandle, registerSafeOn } from './security';

const invalid = (what: string) => new Error(`Smaran received an invalid ${what} request.`);

/** File pickers for automation steps. */
const PICKERS: Record<PickWhat, Electron.OpenDialogOptions> = {
  app: {
    title: 'Choose an App',
    properties: ['openFile'],
    filters: [
      { name: 'Apps and shortcuts', extensions: ['exe', 'lnk', 'url', 'appref-ms', 'com'] },
      { name: 'All files', extensions: ['*'] },
    ],
  },
  file: { title: 'Choose a File', properties: ['openFile'] },
  script: {
    title: 'Choose a Script',
    properties: ['openFile'],
    filters: [
      { name: 'Scripts', extensions: ['bat', 'cmd', 'ps1', 'vbs', 'js'] },
      { name: 'All files', extensions: ['*'] },
    ],
  },
  browser: {
    title: 'Choose a Browser',
    properties: ['openFile'],
    filters: [{ name: 'Apps', extensions: ['exe'] }],
  },
};

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

/** Registers IPC handlers with strict trusted-renderer sender role validation. */
export function registerIpcHandlers(smaran: SmaranApp): void {
  const { store, history, engine, automations } = smaran;
  registerFileServerIpc(smaran.fileserver);

  registerSafeHandle(IPC.configGet, ['app', 'menu', 'setup'], () => store.get());
  registerSafeHandle(IPC.logoGet, ['app', 'menu', 'trayart'], () => smaran.logoState);

  // Cut, copy, paste… from the app's right-click menu, run on the field that has focus.
  registerSafeOn(IPC.appEdit, ['app', 'setup', 'license'], (event, payload: unknown) => {
    const command = EditCommandSchema.safeParse(payload);
    if (command.success) event.sender[command.data]();
  });

  // The engine owns state and the pause; a save from the app never overwrites them.
  registerSafeHandle(IPC.configSave, ['app'], (_event, next: unknown) => {
    if (typeof next !== 'object' || next === null) throw invalid('save');
    const parsed = ConfigSchema.safeParse(next);
    if (!parsed.success) throw invalid(`save: ${z.prettifyError(parsed.error)}`);
    const current = store.get();
    const settings = parsed.data.settings;
    return store.save({
      ...parsed.data,
      state: current.state,
      settings: { ...settings, pausedUntil: current.settings.pausedUntil },
    });
  });

  registerSafeHandle(IPC.historyGet, ['app', 'menu'], () => history.list());
  registerSafeHandle(IPC.historyClear, ['app'], () => history.clear());

  registerSafeHandle(IPC.notificationsGet, ['app', 'menu'], () => smaran.notificationStore.list());
  registerSafeHandle(
    IPC.notificationsMarkRead,
    ['app', 'notification'],
    (_event, payload: unknown) => {
      const safe = z.object({ id: z.string().min(1) }).parse(payload);
      return smaran.notificationStore.markRead(safe.id);
    },
  );
  registerSafeHandle(IPC.notificationsMarkAllRead, ['app'], () =>
    smaran.notificationStore.markAllRead(),
  );
  registerSafeHandle(IPC.notificationsDelete, ['app'], (_event, payload: unknown) => {
    const safe = z.object({ id: z.string().min(1) }).parse(payload);
    return smaran.notificationStore.delete(safe.id);
  });
  registerSafeHandle(IPC.notificationsClear, ['app'], () => smaran.notificationStore.clear());
  smaran.notificationStore.onChange((notifs) => broadcast(IPC.notificationsChanged, notifs));

  registerSafeHandle(IPC.nextTimes, ['app', 'menu'], () => engine.nextTimes());
  registerSafeHandle(IPC.showNow, ['app', 'menu'], (_event, payload: unknown) => {
    const parsed = ShowNowSchema.safeParse(payload);
    if (!parsed.success) throw invalid('show-now');
    return engine.showNow(parsed.data.reminderId);
  });
  registerSafeHandle(IPC.notifyTest, ['app'], (_event, payload: unknown) => {
    const parsed = NotifyTestSchema.safeParse(payload);
    if (!parsed.success) throw invalid('test');
    const settings = store.get().settings.notification;
    engine.test({
      reminderId: null,
      ...parsed.data,
      label: 'Preview',
      preview: true,
      hideAfterSec: parsed.data.important ? null : settings.hideAfterSec,
      sound: settings.sound,
    });
  });
  registerSafeHandle(IPC.screenBorderPreview, ['app'], () => {
    smaran.notifications.previewBorderLight();
  });

  registerSafeHandle(IPC.automationsNext, ['app'], () => automations.nextTimes());
  registerSafeHandle(IPC.automationsRuns, ['app'], () => automations.running());
  registerSafeHandle(IPC.automationsRun, ['app'], (_event, payload: unknown) => {
    const parsed = AutomationIdSchema.safeParse(payload);
    if (!parsed.success) throw invalid('run');
    return automations.runNow(parsed.data.id);
  });
  registerSafeHandle(IPC.automationsCancel, ['app', 'notification'], (_event, payload: unknown) => {
    const parsed = AutomationIdSchema.safeParse(payload);
    if (!parsed.success) throw invalid('cancel');
    automations.cancel(parsed.data.id);
  });
  registerSafeHandle(IPC.automationsBrowsers, ['app'], () => detectBrowsers());
  registerSafeHandle(
    IPC.automationsPick,
    ['app'],
    async (event, payload: unknown): Promise<string | null> => {
      const parsed = PickSchema.safeParse(payload);
      if (!parsed.success) throw invalid('pick');
      const win = BrowserWindow.fromWebContents(event.sender);
      const options = PICKERS[parsed.data.what];
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  );

  registerSafeHandle(IPC.fontsList, ['app'], () => smaran.fonts.catalog());
  registerSafeHandle(IPC.fontsAdd, ['app'], async (event): Promise<FontsAddResult> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: 'Add Font Files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0)
      return { ok: true, added: [], skipped: [] };
    try {
      return { ok: true, ...smaran.fonts.add(result.filePaths) };
    } catch (error) {
      return { ok: false, error: `Could not add the fonts: ${(error as Error).message}` };
    }
  });

  registerSafeHandle(IPC.appPause, ['app', 'menu'], (_event, payload: unknown) => {
    const parsed = PauseSchema.safeParse(payload ?? {});
    if (!parsed.success) throw invalid('pause');
    smaran.pause(parsed.data.minutes);
  });
  registerSafeHandle(IPC.appResume, ['app', 'menu'], () => smaran.resume());
  registerSafeHandle(IPC.appInfo, ['app'], (): AppInfo => smaran.info());
  registerSafeHandle(IPC.appOpenDataFolder, ['app'], () => shell.openPath(store.dir));
  registerSafeOn(IPC.appTheme, ['app'], (_event, payload: unknown) => {
    const parsed = ThemeSchema.safeParse(payload);
    if (parsed.success) setTitleBarTheme(parsed.data.dark);
  });

  registerSafeHandle(IPC.backupExport, ['app'], async (event): Promise<BackupResult> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.SaveDialogOptions = {
      title: 'Back Up Your Reminders',
      defaultPath: `smaran-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'Smaran backup', extensions: ['json'] }],
    };
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { ok: true };
    try {
      fs.writeFileSync(result.filePath, exportJson(store.get()), 'utf8');
    } catch (error) {
      return { ok: false, error: `Could not save the file: ${(error as Error).message}` };
    }
    return { ok: true, path: result.filePath, detail: `Saved to ${result.filePath}` };
  });

  registerSafeHandle(
    IPC.backupImport,
    ['app'],
    async (event, payload: unknown): Promise<BackupResult> => {
      const parsed = BackupImportSchema.safeParse(payload);
      if (!parsed.success) throw invalid('import');
      const win = BrowserWindow.fromWebContents(event.sender);
      const options: Electron.OpenDialogOptions = {
        title: parsed.data.mode === 'replace' ? 'Restore a backup' : 'Add reminders from a file',
        properties: ['openFile'],
        filters: [{ name: 'Smaran backup or settings', extensions: ['json'] }],
      };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      const path = result.filePaths[0];
      if (result.canceled || !path) return { ok: true };

      let text: string;
      try {
        text = fs.readFileSync(path, 'utf8');
      } catch (error) {
        return { ok: false, error: `Could not read the file: ${(error as Error).message}` };
      }
      const newId = () => crypto.randomUUID();
      const backup = parseBackupJson(text, {
        newId,
        now: new Date(),
        primaryDisplayId: screen.getPrimaryDisplay().id,
      });
      if (!backup.ok) return { ok: false, error: backup.error };

      const current = store.get();
      const next =
        parsed.data.mode === 'replace'
          ? { ...backup.config, settings: { ...backup.config.settings, onboarded: true } }
          : mergeReminders(current, backup.config, newId);
      const saved = store.save(next);
      if (!saved.ok) return { ok: false, error: saved.error };
      const count = backup.config.reminders.length;
      const autos = backup.config.automations.length;
      const what =
        `${count} reminder${count === 1 ? '' : 's'}` +
        (autos > 0 ? ` and ${autos} automation${autos === 1 ? '' : 's'}` : '');
      const from = backup.from ? ` (converted from ${backup.from})` : '';
      return {
        ok: true,
        path,
        detail:
          parsed.data.mode === 'replace' ? `Restored ${what}${from}.` : `Added ${what}${from}.`,
      };
    },
  );

  store.onChange((config) => broadcast(IPC.configChanged, config));
  history.onChange((entries) => broadcast(IPC.historyChanged, entries));
  automations.watchRuns((runs) => broadcast(IPC.automationsRunsChanged, runs));
}
