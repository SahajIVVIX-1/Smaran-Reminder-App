import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import type {
  FileServerSettings,
  ServerLogEntry,
  ShareLink,
  TransferHistoryEntry,
  UserAccount,
  VirtualFolder,
} from '@shared/fileserver';

const FILE_SERVER_STORE_NAME = 'fileserver.json';
const MAX_LOGS = 1000;
const MAX_HISTORY = 500;

export interface FileServerData {
  settings: FileServerSettings;
  users: UserAccount[];
  shares: ShareLink[];
  virtualFolders: VirtualFolder[];
  history: TransferHistoryEntry[];
}

export class FileServerStore {
  private readonly filePath: string;
  private data: FileServerData;
  private logs: ServerLogEntry[] = [];

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, FILE_SERVER_STORE_NAME);
    this.data = this.loadInitialData();
    this.ensureRootDir();
  }

  private getDefaultRootDir(): string {
    try {
      const docs = app.getPath('documents');
      return path.join(docs, 'Smaran Files');
    } catch {
      return path.join(process.cwd(), 'Smaran Files');
    }
  }

  private loadInitialData(): FileServerData {
    const defaultSettings: FileServerSettings = {
      enabled: true,
      serverName: 'Smaran File Server',
      port: 5900,
      bindAddress: '0.0.0.0',
      rootDir: this.getDefaultRootDir(),
      maxConnections: 50,
      uploadLimitMb: 4096,
      rateLimitPerMin: 600,
      authEnabled: false,
      guestAccess: true,
      allowPublicUploads: false,
      enableRangeRequests: true,
      httpsEnabled: false,
      httpsCertPath: '',
      httpsKeyPath: '',
    };

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        return {
          settings: { ...defaultSettings, ...(raw.settings || {}) },
          users: Array.isArray(raw.users) ? raw.users : [],
          shares: Array.isArray(raw.shares) ? raw.shares : [],
          virtualFolders: Array.isArray(raw.virtualFolders) ? raw.virtualFolders : [],
          history: Array.isArray(raw.history) ? raw.history : [],
        };
      } catch {
        // Fallback to defaults
      }
    }

    return {
      settings: defaultSettings,
      users: [],
      shares: [],
      virtualFolders: [],
      history: [],
    };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save fileserver data:', err);
    }
  }

  ensureRootDir(): string {
    const dir = this.data.settings.rootDir;
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        const readme = path.join(dir, 'Welcome to Smaran HFS.txt');
        if (!fs.existsSync(readme)) {
          fs.writeFileSync(
            readme,
            'Welcome to Smaran HFS (HTTP File Server)!\n\n' +
              'This is your default root storage directory.\n' +
              'Any files and folders you drop here will be accessible to other devices on your Wi-Fi/LAN.\n' +
              'You can manage uploads, downloads, sharing links, and user access directly inside Smaran.\n',
            'utf8',
          );
        }
      } catch (err) {
        console.error('Failed to create root directory:', err);
      }
    }
    return dir;
  }

  getSettings(): FileServerSettings {
    return { ...this.data.settings };
  }

  updateSettings(patch: Partial<FileServerSettings>): FileServerSettings {
    this.data.settings = { ...this.data.settings, ...patch };
    this.ensureRootDir();
    this.save();
    return this.getSettings();
  }

  getUsers(): UserAccount[] {
    return [...this.data.users];
  }

  saveUser(user: UserAccount): void {
    const idx = this.data.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      this.data.users[idx] = user;
    } else {
      this.data.users.push(user);
    }
    this.save();
  }

  deleteUser(id: string): void {
    this.data.users = this.data.users.filter((u) => u.id !== id);
    this.save();
  }

  findUserByUsername(username: string): UserAccount | undefined {
    return this.data.users.find(
      (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase(),
    );
  }

  getShares(): ShareLink[] {
    return [...this.data.shares];
  }

  saveShare(share: ShareLink): void {
    const idx = this.data.shares.findIndex((s) => s.id === share.id);
    if (idx >= 0) {
      this.data.shares[idx] = share;
    } else {
      this.data.shares.push(share);
    }
    this.save();
  }

  revokeShare(id: string): void {
    this.data.shares = this.data.shares.filter((s) => s.id !== id);
    this.save();
  }

  findShareByToken(token: string): ShareLink | undefined {
    return this.data.shares.find((s) => s.token === token);
  }

  recordShareDownload(id: string): void {
    const s = this.data.shares.find((x) => x.id === id);
    if (s) {
      s.downloadCount++;
      this.save();
    }
  }

  getHistory(): TransferHistoryEntry[] {
    return [...this.data.history];
  }

  addHistory(entry: TransferHistoryEntry): void {
    this.data.history.unshift(entry);
    if (this.data.history.length > MAX_HISTORY) {
      this.data.history = this.data.history.slice(0, MAX_HISTORY);
    }
    this.save();
  }

  clearHistory(): void {
    this.data.history = [];
    this.save();
  }

  getLogs(): ServerLogEntry[] {
    return [...this.logs];
  }

  addLog(log: ServerLogEntry): void {
    this.logs.unshift(log);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }
  }

  clearLogs(): void {
    this.logs = [];
  }
}
