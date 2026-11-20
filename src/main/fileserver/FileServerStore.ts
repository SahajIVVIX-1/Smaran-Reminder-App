import crypto from 'node:crypto';
import path from 'node:path';
import {
  FileServerDataSchema,
  type FileServerData,
  type FileServerSettings,
  type SafeAdminCredentials,
  type UserAccount,
} from '@shared/fileserver';
import { cleanupStaleTempFiles, readValidatedJson, writeAtomicFile } from '../store/atomicFile';

const FILE_SERVER_STORE_NAME = 'fileserver.json';

export function generateSecurePassword(): string {
  // 16-character cryptographically secure URL-safe password
  return crypto.randomBytes(12).toString('base64url');
}

/**
 * Auto-generated password pattern for the default administrator user ("smaran"):
 * smaran@DDMMYYYY-Exacttime-Day(in short) with sec
 * E.g. smaran@20112026-025530-Fri
 */
export function generateDefaultAdminPassword(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayShort = days[date.getDay()];
  return `smaran@${dd}${mm}${yyyy}-${hours}${mins}${secs}-${dayShort}`;
}

export function validateAdminPassword(password: string): { ok: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { ok: false, error: 'Password cannot be empty.' };
  }
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters long.' };
  }
  const banned = ['smaran', 'admin', 'password', '12345678', '123456789', 'administrator'];
  if (banned.includes(trimmed.toLowerCase())) {
    return {
      ok: false,
      error: 'Password cannot be a common default or weak password (e.g. smaran, admin, password).',
    };
  }
  return { ok: true };
}

export class FileServerStore {
  readonly filePath: string;
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
      autoStart: false,
      autoOpenAdminOnStart: false,
      adminUsername: 'smaran',
      adminPassword: '',
      notifyOnLogin: true,
      notifyOnFailedLogin: true,
      notifyOnAdminActivity: true,
    };

    cleanupStaleTempFiles(path.dirname(this.filePath), FILE_SERVER_STORE_NAME);

    const res = readValidatedJson<FileServerData | null>(
      this.filePath,
      FileServerDataSchema,
      null,
      {
        onRecovered: (msg) => console.warn(`[FileServerStore] ${msg}`),
      },
    );
    const loaded = res.data;

    if (loaded) {
      let settings: FileServerSettings = { ...defaultSettings, ...loaded.settings };
      let users: UserAccount[] = loaded.users || [];
      let shouldSave = false;

      // Ensure file server does not auto-start unless explicitly configured by the user
      if (settings.autoStart && !loaded.settings?.autoStartConfigured) {
        settings.autoStart = false;
        shouldSave = true;
      }

      // Upgrade insecure or empty legacy default passwords to the pattern password
      if (
        !settings.adminPassword ||
        settings.adminPassword === 'smaran' ||
        settings.adminPassword === 'admin'
      ) {
        const defaultAdminPass = generateDefaultAdminPassword();
        settings = {
          ...settings,
          adminUsername: settings.adminUsername || 'smaran',
          adminPassword: defaultAdminPass,
        };
        users = [
          {
            id: 'admin',
            username: settings.adminUsername || 'smaran',
            password: defaultAdminPass,
            role: 'admin',
            isSystem: true,
          },
          ...users.filter((u) => u.username !== 'smaran' && u.username !== 'admin'),
        ];
        shouldSave = true;
      }

      if (shouldSave) {
        this.data = { settings, users };
        this.save();
      } else {
        this.data = { settings, users };
      }

      return this.data;
    }

    // First initialization: generate credentials matching default pattern
    const initialPassword = generateDefaultAdminPassword();
    const initialSettings: FileServerSettings = {
      ...defaultSettings,
      adminUsername: 'smaran',
      adminPassword: initialPassword,
    };
    const initialUsers: UserAccount[] = [
      {
        id: 'admin',
        username: 'smaran',
        password: initialPassword,
        role: 'admin',
        isSystem: true,
      },
    ];

    const initialData: FileServerData = {
      settings: initialSettings,
      users: initialUsers,
    };

    this.data = initialData;
    this.save();
    return initialData;
  }

  save(): { ok: boolean; error?: string } {
    try {
      writeAtomicFile(this.filePath, JSON.stringify(this.data, null, 2), { backup: true });
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[FileServerStore] Failed to save configuration:', msg);
      throw new Error(`Failed to save file server configuration: ${msg}`);
    }
  }

  getSettings(): FileServerSettings {
    return { ...this.data.settings };
  }

  getSafeSettings(): FileServerSettings {
    return {
      ...this.data.settings,
      adminPassword: '', // Secrets are never exposed to renderer
    };
  }

  getSafeAdminCredentials(): SafeAdminCredentials {
    return {
      username: this.data.settings.adminUsername || 'smaran',
      hasPassword: Boolean(this.data.settings.adminPassword),
      isConfigured: Boolean(this.data.settings.adminPassword),
    };
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
