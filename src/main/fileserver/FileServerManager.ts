import { BrowserWindow, dialog, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as QRCode from 'qrcode';
import { IPC } from '@shared/channels';
import type {
  ActiveTransfer,
  DirectoryListing,
  FileServerSettings,
  ServerLogEntry,
  ServerStatus,
  ShareLink,
  TransferHistoryEntry,
  UserAccount,
} from '@shared/fileserver';
import { FileServerStore } from './FileServerStore';
import { HttpServer } from './HttpServer';
import { generateToken, hashPassword, resolveSafePath } from './security';

export class FileServerManager {
  readonly store: FileServerStore;
  readonly http: HttpServer;

  constructor(dataDir: string) {
    this.store = new FileServerStore(dataDir);
    this.http = new HttpServer(this.store, {
      onStatusChanged: (status) => this.broadcast(IPC.fileserverStatusChanged, status),
      onTransfersUpdated: (transfers) => this.broadcast(IPC.fileserverTransfersUpdated, transfers),
      onLogAdded: (log) => this.broadcast(IPC.fileserverLogAdded, log),
    });
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    const settings = this.store.getSettings();
    if (settings.enabled) {
      return this.http.start();
    }
    return { ok: true };
  }

  async stop(): Promise<void> {
    await this.http.stop();
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    return this.http.restart();
  }

  getStatus(): ServerStatus {
    return this.http.getStatus();
  }

  getSettings(): FileServerSettings {
    return this.store.getSettings();
  }

  async updateSettings(patch: Partial<FileServerSettings>): Promise<FileServerSettings> {
    const updated = this.store.updateSettings(patch);
    // If port, bind, root, or HTTPS changed and server is running, restart
    if (this.http.isRunning) {
      if (
        patch.port !== undefined ||
        patch.bindAddress !== undefined ||
        patch.rootDir !== undefined ||
        patch.httpsEnabled !== undefined
      ) {
        await this.http.restart();
      }
    }
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    return updated;
  }

  async pickRootDir(parentWindow?: BrowserWindow): Promise<string | null> {
    const win = parentWindow || BrowserWindow.getFocusedWindow();
    const res = await (win
      ? dialog.showOpenDialog(win, {
          title: 'Select Root Storage Directory for Smaran HFS',
          properties: ['openDirectory', 'createDirectory'],
          defaultPath: this.store.getSettings().rootDir,
        })
      : dialog.showOpenDialog({
          title: 'Select Root Storage Directory for Smaran HFS',
          properties: ['openDirectory', 'createDirectory'],
          defaultPath: this.store.getSettings().rootDir,
        }));

    if (!res.canceled && res.filePaths[0]) {
      const chosen = res.filePaths[0];
      await this.updateSettings({ rootDir: chosen });
      return chosen;
    }
    return null;
  }

  listDir(relPath: string): DirectoryListing | null {
    return this.http.listDirectory(relPath);
  }

  mkdir(parentRel: string, name: string): { ok: boolean; error?: string } {
    const settings = this.store.getSettings();
    const target = resolveSafePath(settings.rootDir, path.join(parentRel, name));
    if (!target) return { ok: false, error: 'Invalid path' };

    try {
      fs.mkdirSync(target, { recursive: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  deleteItem(relPath: string): { ok: boolean; error?: string } {
    const settings = this.store.getSettings();
    const target = resolveSafePath(settings.rootDir, relPath);
    if (!target || target === path.resolve(settings.rootDir)) {
      return { ok: false, error: 'Cannot delete root folder' };
    }

    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
        return { ok: true };
      }
      return { ok: false, error: 'File or folder does not exist' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  renameItem(relPath: string, newName: string): { ok: boolean; error?: string } {
    const settings = this.store.getSettings();
    const source = resolveSafePath(settings.rootDir, relPath);
    if (!source) return { ok: false, error: 'Source not found' };

    const parent = path.dirname(source);
    const dest = resolveSafePath(settings.rootDir, path.relative(settings.rootDir, path.join(parent, newName)));
    if (!dest) return { ok: false, error: 'Invalid destination' };

    try {
      fs.renameSync(source, dest);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  moveItem(srcRel: string, destFolderRel: string): { ok: boolean; error?: string } {
    const settings = this.store.getSettings();
    const source = resolveSafePath(settings.rootDir, srcRel);
    const destFolder = resolveSafePath(settings.rootDir, destFolderRel);
    if (!source || !destFolder) return { ok: false, error: 'Invalid path' };

    const fileName = path.basename(source);
    const dest = path.join(destFolder, fileName);

    try {
      fs.renameSync(source, dest);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  openFolderInExplorer(relPath = ''): void {
    const settings = this.store.getSettings();
    const safeTarget = resolveSafePath(settings.rootDir, relPath) || settings.rootDir;
    shell.openPath(safeTarget);
  }

  // Users
  getUsers(): UserAccount[] {
    return this.store.getUsers();
  }

  saveUser(input: {
    id?: string;
    username: string;
    password?: string;
    role: 'admin' | 'user' | 'guest';
    permissions: { read: boolean; upload: boolean; delete: boolean; rename: boolean; mkdir: boolean };
    allowedFolders?: string[];
  }): UserAccount {
    const id = input.id || crypto.randomUUID();
    const existing = this.store.getUsers().find((u) => u.id === id);
    const passwordHash = input.password ? hashPassword(input.password) : existing?.passwordHash || '';

    const user: UserAccount = {
      id,
      username: input.username.trim(),
      passwordHash,
      role: input.role,
      permissions: input.permissions,
      allowedFolders: input.allowedFolders || [],
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    this.store.saveUser(user);
    return user;
  }

  deleteUser(id: string): void {
    this.store.deleteUser(id);
  }

  // Shares
  getShares(): ShareLink[] {
    return this.store.getShares();
  }

  createShare(input: {
    relativePath: string;
    permission: 'read' | 'upload' | 'download' | 'full';
    password?: string;
    expiresAt?: string | null;
    maxDownloads?: number | null;
  }): ShareLink {
    const settings = this.store.getSettings();
    const safeTarget = resolveSafePath(settings.rootDir, input.relativePath);
    const isFolder = safeTarget ? fs.statSync(safeTarget).isDirectory() : false;
    const name = path.basename(input.relativePath) || 'Root';

    const token = generateToken(16);
    const share: ShareLink = {
      id: crypto.randomUUID(),
      token,
      name,
      relativePath: input.relativePath,
      isFolder,
      permission: input.permission,
      passwordProtected: Boolean(input.password),
      passwordHash: input.password ? hashPassword(input.password) : null,
      expiresAt: input.expiresAt || null,
      maxDownloads: input.maxDownloads || null,
      downloadCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.store.saveShare(share);
    return share;
  }

  revokeShare(id: string): void {
    this.store.revokeShare(id);
  }

  // Transfers
  getActiveTransfers(): ActiveTransfer[] {
    return Array.from(this.getStatus().activeTransfers);
  }

  cancelTransfer(id: string): boolean {
    return this.http.cancelTransfer(id);
  }

  getHistory(): TransferHistoryEntry[] {
    return this.store.getHistory();
  }

  clearHistory(): void {
    this.store.clearHistory();
  }

  // Logs
  getLogs(): ServerLogEntry[] {
    return this.store.getLogs();
  }

  clearLogs(): void {
    this.store.clearLogs();
  }

  // QR Code
  async generateQr(url: string): Promise<string> {
    return QRCode.toDataURL(url, {
      margin: 1.5,
      color: {
        dark: '#1b1b1e',
        light: '#f9f9f9',
      },
      width: 256,
    });
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    }
  }
}
