import { ipcMain, shell } from 'electron';
import { IPC } from '@shared/channels';
import type { FileServerSettings } from '@shared/fileserver';
import type { FileServerManager } from './FileServerManager';

export function registerFileServerIpc(manager: FileServerManager): void {
  ipcMain.handle(IPC.fileserverStatus, () => manager.getStatus());
  ipcMain.handle(IPC.fileserverStart, () => manager.start());
  ipcMain.handle(IPC.fileserverStop, () => manager.stop());
  ipcMain.handle(IPC.fileserverRestart, () => manager.restart());

  ipcMain.handle(IPC.fileserverSettingsGet, () => manager.getSettings());
  ipcMain.handle(IPC.fileserverSettingsSave, (_event, patch: Partial<FileServerSettings>) =>
    manager.updateSettings(patch),
  );
  ipcMain.handle(IPC.fileserverPickRootDir, () => manager.pickRootDir());
  ipcMain.handle(IPC.fileserverOpenFolder, (_event, folderPath?: string) =>
    manager.openFolder(folderPath),
  );

  ipcMain.handle(IPC.fileserverLogsGet, () => manager.getLogs());
  ipcMain.handle(IPC.fileserverLogsClear, () => manager.clearLogs());
  ipcMain.handle(IPC.fileserverQrGenerate, (_event, url: string) => manager.generateQr(url));

  ipcMain.handle(
    IPC.fileserverMountDrive,
    (_event, payload?: { driveLetter?: string; username?: string; password?: string }) =>
      manager.mountLocalDrive(payload),
  );
  ipcMain.handle(IPC.fileserverUnmountDrive, (_event, driveLetter?: string) =>
    manager.unmountLocalDrive(driveLetter),
  );

  ipcMain.handle(IPC.fileserverAdminGet, () => manager.getAdminCredentials());
  ipcMain.handle(IPC.fileserverAdminSet, (_event, creds: { username: string; password: string }) =>
    manager.setAdminCredentials(creds),
  );
  ipcMain.handle(IPC.fileserverResetDefaults, () => manager.resetDefaults());
  ipcMain.handle(IPC.fileserverOpenUrl, (_event, url: string) => shell.openExternal(url));
}
