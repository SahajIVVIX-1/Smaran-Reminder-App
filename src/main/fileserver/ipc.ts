import { ipcMain } from 'electron';
import { IPC } from '@shared/channels';
import type { FileServerSettings, VfsNode } from '@shared/fileserver';
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

  ipcMain.handle(IPC.fileserverListDir, (_event, relPath: string) => manager.listDir(relPath || ''));
  ipcMain.handle(IPC.fileserverMkdir, (_event, payload: { path: string; name: string }) =>
    manager.mkdir(payload.path || '', payload.name),
  );
  ipcMain.handle(IPC.fileserverDelete, (_event, relPath: string) => manager.deleteItem(relPath));
  ipcMain.handle(
    IPC.fileserverRename,
    (_event, payload: { path: string; newName: string }) =>
      manager.renameItem(payload.path, payload.newName),
  );
  ipcMain.handle(
    IPC.fileserverMove,
    (_event, payload: { srcPath: string; destFolder: string }) =>
      manager.moveItem(payload.srcPath, payload.destFolder),
  );
  ipcMain.handle(IPC.fileserverOpenFolder, (_event, relPath?: string) =>
    manager.openFolderInExplorer(relPath),
  );

  ipcMain.handle(IPC.fileserverUsersList, () => manager.getUsers());
  ipcMain.handle(
    IPC.fileserverUsersSave,
    (
      _event,
      user: {
        id?: string;
        username: string;
        password?: string;
        role: 'admin' | 'user' | 'guest';
        permissions: { read: boolean; upload: boolean; delete: boolean; rename: boolean; mkdir: boolean };
        allowedFolders?: string[];
      },
    ) => manager.saveUser(user),
  );
  ipcMain.handle(IPC.fileserverUsersDelete, (_event, id: string) => manager.deleteUser(id));

  ipcMain.handle(IPC.fileserverSharesList, () => manager.getShares());
  ipcMain.handle(
    IPC.fileserverSharesCreate,
    (
      _event,
      payload: {
        relativePath: string;
        permission: 'read' | 'upload' | 'download' | 'full';
        password?: string;
        expiresAt?: string | null;
        maxDownloads?: number | null;
      },
    ) => manager.createShare(payload),
  );
  ipcMain.handle(IPC.fileserverSharesRevoke, (_event, id: string) => manager.revokeShare(id));

  ipcMain.handle(IPC.fileserverTransfersActive, () => manager.getActiveTransfers());
  ipcMain.handle(IPC.fileserverTransfersCancel, (_event, id: string) => manager.cancelTransfer(id));
  ipcMain.handle(IPC.fileserverTransfersHistory, () => manager.getHistory());
  ipcMain.handle(IPC.fileserverTransfersClearHistory, () => manager.clearHistory());

  ipcMain.handle(IPC.fileserverLogsGet, () => manager.getLogs());
  ipcMain.handle(IPC.fileserverLogsClear, () => manager.clearLogs());

  ipcMain.handle(IPC.fileserverQrGenerate, (_event, url: string) => manager.generateQr(url));

  // VFS & HFS 3.4.1 handlers
  ipcMain.handle(IPC.fileserverVfsList, () => manager.getVfsNodes());
  ipcMain.handle(IPC.fileserverVfsSave, (_event, node: VfsNode) => manager.saveVfsNode(node));
  ipcMain.handle(IPC.fileserverVfsDelete, (_event, id: string) => manager.deleteVfsNode(id));
  ipcMain.handle(IPC.fileserverVfsPickPath, (_event, isDir?: boolean) =>
    manager.pickVfsPhysicalPath(undefined, isDir ?? true),
  );
  ipcMain.handle(IPC.fileserverKillConnection, (_event, id: string) => manager.killConnection(id));
  ipcMain.handle(IPC.fileserverSetComment, (_event, payload: { path: string; comment: string }) =>
    manager.setFileComment(payload.path, payload.comment),
  );
}
