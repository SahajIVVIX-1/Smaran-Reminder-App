import { BrowserWindow, dialog, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as QRCode from 'qrcode';
import { IPC } from '@shared/channels';
import type {
  ActiveTransfer,
  DirectoryListing,
  FileServerSettings,
  Permissions,
  ServerLogEntry,
  ServerStatus,
  ShareLink,
  TransferHistoryEntry,
  UserAccount,
  VfsNode,
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
    return this.http.vfs.listDirectory(relPath);
  }

  mkdir(parentRel: string, name: string): { ok: boolean; error?: string } {
    const parentTarget = this.http.vfs.resolvePath(parentRel);
    const base = parentTarget?.physicalPath || this.store.getSettings().rootDir;
    const target = resolveSafePath(base, name);
    if (!target) return { ok: false, error: 'Invalid path' };

    try {
      fs.mkdirSync(target, { recursive: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  deleteItem(relPath: string): { ok: boolean; error?: string } {
    const target = this.http.vfs.resolvePath(relPath);
    if (!target?.physicalPath || !fs.existsSync(target.physicalPath)) {
      return { ok: false, error: 'File or folder does not exist' };
    }
    if (target.physicalPath === path.resolve(this.store.getSettings().rootDir)) {
      return { ok: false, error: 'Cannot delete root folder' };
    }

    try {
      fs.rmSync(target.physicalPath, { recursive: true, force: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  renameItem(relPath: string, newName: string): { ok: boolean; error?: string } {
    const target = this.http.vfs.resolvePath(relPath);
    if (!target?.physicalPath || !fs.existsSync(target.physicalPath)) {
      return { ok: false, error: 'Source not found' };
    }

    const parent = path.dirname(target.physicalPath);
    const dest = path.join(parent, newName);

    try {
      fs.renameSync(target.physicalPath, dest);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  moveItem(srcRel: string, destFolderRel: string): { ok: boolean; error?: string } {
    const srcTarget = this.http.vfs.resolvePath(srcRel);
    const destTarget = this.http.vfs.resolvePath(destFolderRel);
    if (!srcTarget?.physicalPath || !destTarget?.physicalPath) {
      return { ok: false, error: 'Invalid path' };
    }

    const fileName = path.basename(srcTarget.physicalPath);
    const dest = path.join(destTarget.physicalPath, fileName);

    try {
      fs.renameSync(srcTarget.physicalPath, dest);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  setFileComment(relPath: string, comment: string): { ok: boolean; error?: string } {
    const target = this.http.vfs.resolvePath(relPath);
    if (!target?.physicalPath || !fs.existsSync(target.physicalPath)) {
      return { ok: false, error: 'File not found' };
    }

    try {
      const dir = path.dirname(target.physicalPath);
      const name = path.basename(target.physicalPath);
      this.store.setCommentForFile(dir, name, comment);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  killConnection(id: string): boolean {
    const res = this.http.killConnection(id);
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    return res;
  }

  // VFS Node Management
  getVfsNodes(): VfsNode[] {
    return this.store.getVfsNodes();
  }

  saveVfsNode(node: VfsNode): VfsNode {
    this.store.saveVfsNode(node);
    return node;
  }

  deleteVfsNode(id: string): void {
    this.store.deleteVfsNode(id);
  }

  async pickVfsPhysicalPath(parentWindow?: BrowserWindow, isDirectory = true): Promise<string | null> {
    const win = parentWindow || BrowserWindow.getFocusedWindow();
    const res = await (win
      ? dialog.showOpenDialog(win, {
          title: isDirectory ? 'Select Directory to Map into VFS' : 'Select File to Map into VFS',
          properties: isDirectory ? ['openDirectory'] : ['openFile'],
        })
      : dialog.showOpenDialog({
          title: isDirectory ? 'Select Directory to Map into VFS' : 'Select File to Map into VFS',
          properties: isDirectory ? ['openDirectory'] : ['openFile'],
        }));

    if (!res.canceled && res.filePaths[0]) {
      return res.filePaths[0];
    }
    return null;
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
    permissions: Partial<Permissions>;
    allowedFolders?: string[];
  }): UserAccount {
    const id = input.id || crypto.randomUUID();
    const existing = this.store.getUsers().find((u) => u.id === id);
    const passwordHash = input.password ? hashPassword(input.password) : existing?.passwordHash || '';

    const defaultPerms: Permissions = {
      read: true,
      upload: true,
      delete: true,
      rename: true,
      mkdir: true,
      comment: true,
      vfs: false,
      zip: true,
    };

    const user: UserAccount = {
      id,
      username: input.username.trim(),
      passwordHash,
      role: input.role,
      permissions: { ...defaultPerms, ...input.permissions },
      allowedFolders: input.allowedFolders || [],
      mustChangePassword: existing?.mustChangePassword ?? false,
      isSystem: existing?.isSystem ?? false,
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

  // Drive Mounting (WebDAV Network Drive)
  async mountLocalDrive(options?: {
    driveLetter?: string;
    username?: string;
    password?: string;
  }): Promise<{ ok: boolean; driveLetter?: string; error?: string }> {
    if (process.platform !== 'win32') {
      return { ok: false, error: 'Local drive mapping is currently supported on Windows' };
    }
    const settings = this.store.getSettings();
    if (!this.http.isRunning) {
      return { ok: false, error: 'Smaran File Server is not running. Please start the server first.' };
    }
    const port = settings.port;
    const drive = (options?.driveLetter || 'Z:').toUpperCase().replace(/[^A-Z:]/g, '');
    const driveLetter = drive.endsWith(':') ? drive : `${drive}:`;
    const user = options?.username || (settings.authEnabled ? 'smaran' : '');
    const pass = options?.password || (settings.authEnabled ? 'smaran@123' : '');

    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);

      // Best effort start WebClient service
      try {
        await execAsync('net start WebClient');
      } catch {
        void 0;
      }

      // Delete existing drive mapping on that letter if any
      try {
        await execAsync(`net use ${driveLetter} /delete /y`);
      } catch {
        void 0;
      }

      // Map drive using HTTP WebDAV
      let cmd = `net use ${driveLetter} http://127.0.0.1:${port}/ /persistent:no`;
      if (settings.authEnabled && user && pass) {
        cmd = `net use ${driveLetter} http://127.0.0.1:${port}/ /user:${user} "${pass}" /persistent:no`;
      }

      await execAsync(cmd);

      // Open in Explorer
      shell.openPath(`${driveLetter}\\`);

      return { ok: true, driveLetter };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  async unmountLocalDrive(driveLetter: string = 'Z:'): Promise<{ ok: boolean; error?: string }> {
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      const dl = driveLetter.toUpperCase().endsWith(':') ? driveLetter : `${driveLetter}:`;
      await execAsync(`net use ${dl} /delete /y`);
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    }
  }
}
