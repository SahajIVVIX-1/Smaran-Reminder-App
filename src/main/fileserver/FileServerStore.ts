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
import { decryptSecret, encryptSecret } from './secureStorage';

const FILE_SERVER_STORE_NAME = 'fileserver.json';

export function generateSecurePassword(): string {
  // 16-character cryptographically secure URL-safe password (96 bits entropy)
  return crypto.randomBytes(12).toString('base64url');
}

/**
 * Generates an unguessable, cryptographically strong initial administrator password
 * using Node.js crypto.randomBytes().
 * Never uses timestamps, usernames, machine names or predictable values.
 */
export function generateDefaultAdminPassword(): string {
  return crypto.randomBytes(16).toString('base64url');
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
  private activeAdminPassword = '';

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
      mustChangePassword: false,
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

      // 1. Recover admin password from encrypted storage or legacy plaintext
      if (settings.encryptedAdminPassword) {
        this.activeAdminPassword = decryptSecret(settings.encryptedAdminPassword);
      } else if (settings.adminPassword) {
        this.activeAdminPassword = settings.adminPassword;
        shouldSave = true; // Migrate to encryptedAdminPassword
      }

      // Ensure file server does not auto-start unless explicitly configured by the user
      if (settings.autoStart && !loaded.settings?.autoStartConfigured) {
        settings.autoStart = false;
        shouldSave = true;
      }

      // Upgrade insecure or empty legacy default passwords to cryptographically random password
      if (
        !this.activeAdminPassword ||
        this.activeAdminPassword === 'smaran' ||
        this.activeAdminPassword === 'admin'
      ) {
        this.activeAdminPassword = generateDefaultAdminPassword();
        settings.adminUsername = settings.adminUsername || 'smaran';
        settings.mustChangePassword = true;
        shouldSave = true;
      }

      // Migrate existing user accounts to secure encrypted passwords
      users = users.map((u) => {
        if (u.password && !u.encryptedPassword) {
          shouldSave = true;
          return {
            ...u,
            encryptedPassword: encryptSecret(u.password),
            password: '',
          };
        }
        return u;
      });

      // Keep admin account in users synchronized
      const adminIdx = users.findIndex((u) => u.username === settings.adminUsername || u.id === 'admin');
      const existingAdmin = adminIdx >= 0 ? users[adminIdx] : undefined;
      if (adminIdx >= 0 && existingAdmin) {
        users[adminIdx] = {
          ...existingAdmin,
          id: existingAdmin.id || 'admin',
          username: settings.adminUsername,
          encryptedPassword: encryptSecret(this.activeAdminPassword),
          password: '',
          role: 'admin',
          isSystem: true,
        };
      } else {
        users.unshift({
          id: 'admin',
          username: settings.adminUsername,
          encryptedPassword: encryptSecret(this.activeAdminPassword),
          password: '',
          role: 'admin',
          isSystem: true,
        });
        shouldSave = true;
      }

      this.data = { settings, users };
      if (shouldSave) {
        this.save();
      }

      return this.data;
    }

    // First initialization: generate unguessable random password with mandatory change flag
    const initialPassword = generateDefaultAdminPassword();
    this.activeAdminPassword = initialPassword;

    const initialSettings: FileServerSettings = {
      ...defaultSettings,
      adminUsername: 'smaran',
      adminPassword: '',
      encryptedAdminPassword: encryptSecret(initialPassword),
      mustChangePassword: true,
    };

    const initialUsers: UserAccount[] = [
      {
        id: 'admin',
        username: 'smaran',
        encryptedPassword: encryptSecret(initialPassword),
        password: '',
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
      // Ensure plaintext passwords are never saved to disk in fileserver.json
      if (this.activeAdminPassword) {
        this.data.settings.encryptedAdminPassword = encryptSecret(this.activeAdminPassword);
      }
      this.data.settings.adminPassword = '';

      if (this.data.users) {
        this.data.users = this.data.users.map((u) => ({
          ...u,
          encryptedPassword: u.encryptedPassword || (u.password ? encryptSecret(u.password) : undefined),
          password: '',
        }));
      }

      writeAtomicFile(this.filePath, JSON.stringify(this.data, null, 2), { backup: true });
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[FileServerStore] Failed to save configuration:', msg);
      throw new Error(`Failed to save file server configuration: ${msg}`);
    }
  }

  getSettings(): FileServerSettings {
    return {
      ...this.data.settings,
      adminPassword: this.activeAdminPassword,
    };
  }

  getSafeSettings(): FileServerSettings {
    return {
      ...this.data.settings,
      adminPassword: '', // Secrets are never exposed to renderer
      encryptedAdminPassword: '',
    };
  }

  getSafeAdminCredentials(): SafeAdminCredentials {
    return {
      username: this.data.settings.adminUsername || 'smaran',
      hasPassword: Boolean(this.activeAdminPassword),
      isConfigured: Boolean(this.activeAdminPassword),
      mustChangePassword: Boolean(this.data.settings.mustChangePassword),
    };
  }

  getAdminPassword(): string {
    return this.activeAdminPassword;
  }

  setAdminPassword(newPassword: string, mustChangePassword = false): void {
    const val = validateAdminPassword(newPassword);
    if (!val.ok) {
      throw new Error(val.error);
    }
    this.activeAdminPassword = newPassword;
    this.data.settings.mustChangePassword = mustChangePassword;
    this.save();
  }

  updateSettings(patch: Partial<FileServerSettings>): FileServerSettings {
    if (patch.adminPassword !== undefined) {
      this.activeAdminPassword = patch.adminPassword;
      // Do not store plaintext in settings object
      patch.adminPassword = '';
    }
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
    return this.getSettings();
  }

  getUsers(): UserAccount[] {
    return this.data.users
      ? this.data.users.map((u) => ({
          ...u,
          password: u.encryptedPassword ? decryptSecret(u.encryptedPassword) : u.password,
        }))
      : [];
  }

  getSafeUsers(): UserAccount[] {
    return this.data.users
      ? this.data.users.map((u) => ({
          ...u,
          password: '',
          encryptedPassword: '',
        }))
      : [];
  }

  saveUser(user: UserAccount): UserAccount {
    if (!this.data.users) this.data.users = [];
    const plainPwd = user.password;
    const userToSave: UserAccount = {
      ...user,
      encryptedPassword: plainPwd ? encryptSecret(plainPwd) : user.encryptedPassword,
      password: '',
    };

    const idx = this.data.users.findIndex((u) => u.id === user.id || u.username === user.username);
    const existing = idx >= 0 ? this.data.users[idx] : undefined;
    if (idx >= 0 && existing) {
      this.data.users[idx] = { ...existing, ...userToSave };
    } else {
      this.data.users.push(userToSave);
    }
    this.save();
    return { ...userToSave, password: plainPwd };
  }

  deleteUser(id: string): void {
    if (!this.data.users) return;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    this.save();
  }
}
