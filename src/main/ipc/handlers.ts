import * as fs from 'node:fs';
import { BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
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
import { detectBrowsers } from '../automations/browsers';
import type { SmaranApp } from '../SmaranApp';
import { exportJson, mergeReminders, parseBackupJson } from '../store/backup';
import { setTitleBarTheme } from '../windows/AppWindow';

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

/** Registers IPC handlers. Every input from a renderer is validated here with zod. */
export function registerIpcHandlers(smaran: SmaranApp): void {
  const { store, history, engine, automations } = smaran;

  ipcMain.handle(IPC.configGet, () => store.get());
  ipcMain.handle(IPC.logoGet, () => smaran.logoState);
  // Cut, copy, paste… from the app's right-click menu, run on the field that has focus.
  ipcMain.on(IPC.appEdit, (event, payload: unknown) => {
    const command = EditCommandSchema.safeParse(payload);
    if (command.success) event.sender[command.data]();
  });
  // The engine owns state and the pause; a save from the app never overwrites them.
  ipcMain.handle(IPC.configSave, (_event, next: unknown) => {
    if (typeof next !== 'object' || next === null) throw invalid('save');
    const current = store.get();
    const settings = (next as { settings?: object }).settings;
    return store.save({
      ...next,
      state: current.state,
      settings:
        typeof settings === 'object' && settings !== null
          ? { ...settings, pausedUntil: current.settings.pausedUntil }
          : settings,
    });
  });

  ipcMain.handle(IPC.historyGet, () => history.list());
  ipcMain.handle(IPC.historyClear, () => history.clear());

  ipcMain.handle(IPC.nextTimes, () => engine.nextTimes());
  ipcMain.handle(IPC.showNow, (_event, payload: unknown) => {
    const parsed = ShowNowSchema.safeParse(payload);
    if (!parsed.success) throw invalid('show-now');
    return engine.showNow(parsed.data.reminderId);
  });
  ipcMain.handle(IPC.notifyTest, (_event, payload: unknown) => {
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

  ipcMain.handle(IPC.automationsNext, () => automations.nextTimes());
  ipcMain.handle(IPC.automationsRuns, () => automations.running());
  ipcMain.handle(IPC.automationsRun, (_event, payload: unknown) => {
    const parsed = AutomationIdSchema.safeParse(payload);
    if (!parsed.success) throw invalid('run');
    return automations.runNow(parsed.data.id);
  });
  ipcMain.handle(IPC.automationsCancel, (_event, payload: unknown) => {
    const parsed = AutomationIdSchema.safeParse(payload);
    if (!parsed.success) throw invalid('cancel');
    automations.cancel(parsed.data.id);
  });
  ipcMain.handle(IPC.automationsBrowsers, () => detectBrowsers());
  ipcMain.handle(IPC.automationsPick, async (event, payload: unknown): Promise<string | null> => {
    const parsed = PickSchema.safeParse(payload);
    if (!parsed.success) throw invalid('pick');
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = PICKERS[parsed.data.what];
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC.fontsList, () => smaran.fonts.catalog());
  ipcMain.handle(IPC.fontsAdd, async (event): Promise<FontsAddResult> => {
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

  ipcMain.handle(IPC.appPause, (_event, payload: unknown) => {
    const parsed = PauseSchema.safeParse(payload ?? {});
    if (!parsed.success) throw invalid('pause');
    smaran.pause(parsed.data.minutes);
  });
  ipcMain.handle(IPC.appResume, () => smaran.resume());
  ipcMain.handle(IPC.appInfo, (): AppInfo => smaran.info());
  ipcMain.handle(IPC.appOpenDataFolder, () => shell.openPath(store.dir));
  ipcMain.on(IPC.appTheme, (_event, payload: unknown) => {
    const parsed = ThemeSchema.safeParse(payload);
    if (parsed.success) setTitleBarTheme(parsed.data.dark);
  });

  ipcMain.handle(IPC.backupExport, async (event): Promise<BackupResult> => {
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

  ipcMain.handle(IPC.backupImport, async (event, payload: unknown): Promise<BackupResult> => {
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
      detail: parsed.data.mode === 'replace' ? `Restored ${what}${from}.` : `Added ${what}${from}.`,
    };
  });

  store.onChange((config) => broadcast(IPC.configChanged, config));
  history.onChange((entries) => broadcast(IPC.historyChanged, entries));
  automations.watchRuns((runs) => broadcast(IPC.automationsRunsChanged, runs));
}
