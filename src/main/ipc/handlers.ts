import * as fs from 'node:fs';
import { BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { csvToMessages, messagesToCsv } from '@shared/csv';
import { resolveStyle } from '@shared/effectiveStyle';
import {
  BackupFormatSchema,
  BackupImportSchema,
  DirtySchema,
  IPC,
  PauseSchema,
  PopupTestSchema,
  ScheduleRunNowSchema,
  type AppInfo,
  type BackupResult,
} from '@shared/ipc';
import type { Config } from '@shared/schema';
import type { SmaranApp } from '../SmaranApp';
import { exportJson, mergeConfigs, parseBackupJson } from '../store/backup';
import { setSettingsDirty } from '../windows/SettingsWindow';
import { listFonts } from '../system/fonts';

const invalid = (what: string) => new Error(`Smaran received an invalid ${what} request.`);

/** Registers IPC handlers. Every input from a renderer is validated here with zod. */
export function registerIpcHandlers(smaran: SmaranApp): void {
  const { store } = smaran;

  ipcMain.handle(IPC.configGet, () => store.get());
  // The scheduler owns runtime; a settings save never overwrites it.
  ipcMain.handle(IPC.configSave, (_event, next: unknown) =>
    store.save(
      typeof next === 'object' && next !== null ? { ...next, runtime: store.get().runtime } : next,
    ),
  );

  ipcMain.handle(IPC.popupTest, async (_event, payload: unknown) => {
    const parsed = PopupTestSchema.safeParse(payload);
    if (!parsed.success) throw invalid('test popup');
    await smaran.testPopup(parsed.data);
  });

  ipcMain.handle(IPC.scheduleRunNow, (_event, payload: unknown) => {
    const parsed = ScheduleRunNowSchema.safeParse(payload);
    if (!parsed.success) throw invalid('run-now');
    return smaran.scheduler.runNow(parsed.data.scheduleId);
  });
  ipcMain.handle(IPC.scheduleNext, () => smaran.scheduler.nextTimes());

  ipcMain.handle(IPC.appPause, (_event, payload: unknown) => {
    const parsed = PauseSchema.safeParse(payload ?? {});
    if (!parsed.success) throw invalid('pause');
    smaran.pause(parsed.data.minutes);
  });
  ipcMain.handle(IPC.appResume, () => smaran.resume());
  ipcMain.handle(IPC.appInfo, (): AppInfo => smaran.info());
  ipcMain.handle(IPC.appOpenDataFolder, () => shell.openPath(store.dir));
  ipcMain.handle(IPC.fontsList, () => listFonts());

  ipcMain.on(IPC.settingsDirty, (_event, payload: unknown) => {
    const parsed = DirtySchema.safeParse(payload);
    if (parsed.success) setSettingsDirty(parsed.data);
  });

  ipcMain.handle(IPC.backupExport, async (event, payload: unknown): Promise<BackupResult> => {
    const parsed = BackupFormatSchema.safeParse(payload);
    if (!parsed.success) throw invalid('export');
    const { format } = parsed.data;
    const win = BrowserWindow.fromWebContents(event.sender);
    const stamp = new Date().toISOString().slice(0, 10);
    const options = {
      title: format === 'json' ? 'Export full backup' : 'Export messages',
      defaultPath:
        format === 'json' ? `smaran-backup-${stamp}.json` : `smaran-messages-${stamp}.csv`,
      filters: [
        format === 'json'
          ? { name: 'Smaran backup', extensions: ['json'] }
          : { name: 'CSV', extensions: ['csv'] },
      ],
    };
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { ok: true };
    const config = store.get();
    const content =
      format === 'json' ? exportJson(config) : `\uFEFF${messagesToCsv(config.messages)}`;
    try {
      fs.writeFileSync(result.filePath, content, 'utf8');
    } catch (error) {
      return { ok: false, error: `Could not save the file: ${(error as Error).message}` };
    }
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle(IPC.backupImport, async (event, payload: unknown): Promise<BackupResult> => {
    const parsed = BackupImportSchema.safeParse(payload);
    if (!parsed.success) throw invalid('import');
    const { format } = parsed.data;
    const win = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title:
        format === 'json'
          ? 'Restore a full backup'
          : format === 'csv'
            ? 'Import messages from CSV'
            : 'Import Smaran v1 settings',
      properties: ['openFile'],
      filters: [
        format === 'csv'
          ? { name: 'CSV', extensions: ['csv', 'txt'] }
          : { name: 'JSON', extensions: ['json'] },
      ],
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
    const current = store.get();
    let next: Config;
    let detail: string;

    if (format === 'csv') {
      const defaultStyle = resolveStyle('', current.styles);
      const { messages, skipped } = csvToMessages(text, {
        styleId: defaultStyle.id,
        newId,
        now: new Date(),
      });
      next = { ...current, messages: [...current.messages, ...messages] };
      detail = `Added ${messages.length} message${messages.length === 1 ? '' : 's'}${
        skipped ? ` (skipped ${skipped} empty row${skipped === 1 ? '' : 's'})` : ''
      }.`;
    } else {
      const backup = parseBackupJson(text, {
        newId,
        now: new Date(),
        primaryDisplayId: screen.getPrimaryDisplay().id,
      });
      if (!backup.ok) return { ok: false, error: backup.error };
      if (format === 'json') {
        next = backup.config;
        detail = 'Your settings were restored from the backup.';
      } else {
        next = mergeConfigs(current, backup.config, newId);
        detail = `Added ${backup.config.messages.length} messages, ${backup.config.styles.length} styles and ${backup.config.schedules.length} schedule from v1.`;
      }
    }

    const saved = store.save(next);
    return saved.ok ? { ok: true, path, detail } : { ok: false, error: saved.error };
  });

  // Every write, from any source, reaches every open window.
  store.onChange((config) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.configChanged, config);
    }
  });
}
