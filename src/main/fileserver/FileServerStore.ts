import fs from 'node:fs';
import path from 'node:path';
import type { FileServerSettings, UserAccount } from '@shared/fileserver';

const FILE_SERVER_STORE_NAME = 'fileserver.json';

export interface FileServerData {
  settings: FileServerSettings;
  users?: UserAccount[];
}

export class FileServerStore {
  private filePath: string;
  private data: FileServerData;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, FILE_SERVER_STORE_NAME);
    this.data = this.loadInitialData();
  }

  private loadInitialData(): FileServerData {
    const defaultSettings: FileServerSettings = {
      enabled: false,
      port: 5901,
      rootDir: '',
      autoStart: true,
      autoOpenAdminOnStart: false,
      adminUsername: 'smaran',
      adminPassword: 'smaran',
    };

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          settings: { ...defaultSettings, ...(parsed.settings || {}) },
          users: parsed.users || [],
        };
      } catch (err) {
        console.error('Failed to parse fileserver.json:', err);
      }
    }

    return {
      settings: defaultSettings,
      users: [
        {
          id: 'smaran',
          username: 'smaran',
          password: 'smaran',
          role: 'admin',
          isSystem: true,
        },
      ],
    };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save fileserver data:', err);
    }
  }

  getSettings(): FileServerSettings {
    return { ...this.data.settings };
  }

  updateSettings(patch: Partial<FileServerSettings>): FileServerSettings {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
    return this.getSettings();
  }

  getUsers(): UserAccount[] {
    return this.data.users ? [...this.data.users] : [];
  }

  saveUser(user: UserAccount): UserAccount {
    if (!this.data.users) this.data.users = [];
    const idx = this.data.users.findIndex((u) => u.id === user.id || u.username === user.username);
    if (idx >= 0) {
      this.data.users[idx] = { ...this.data.users[idx], ...user };
    } else {
      this.data.users.push(user);
    }
    this.save();
    return user;
  }

  deleteUser(id: string): void {
    if (!this.data.users) return;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    this.save();
  }
}
