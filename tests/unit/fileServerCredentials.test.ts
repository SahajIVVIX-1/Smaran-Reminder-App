import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FileServerStore,
  generateDefaultAdminPassword,
  generateSecurePassword,
  validateAdminPassword,
} from '../../src/main/fileserver/FileServerStore';

describe('FileServerStore - Credentials & Password Cryptography', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-fs-creds-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on windows locks
    }
  });

  describe('Password Generation', () => {
    it('generates cryptographically unguessable passwords with sufficient entropy', () => {
      const p1 = generateSecurePassword();
      const p2 = generateSecurePassword();
      expect(p1).not.toBe(p2);
      expect(p1.length).toBeGreaterThanOrEqual(16);
      // Valid base64url characters
      expect(p1).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates distinct 128-bit default administrator passwords', () => {
      const set = new Set<string>();
      for (let i = 0; i < 50; i++) {
        set.add(generateDefaultAdminPassword());
      }
      expect(set.size).toBe(50);
    });
  });

  describe('Password Validation Rules', () => {
    it('rejects empty or whitespace-only passwords', () => {
      expect(validateAdminPassword('').ok).toBe(false);
      expect(validateAdminPassword('   ').ok).toBe(false);
    });

    it('rejects short passwords (< 8 characters)', () => {
      expect(validateAdminPassword('1234567').ok).toBe(false);
      expect(validateAdminPassword('short').ok).toBe(false);
    });

    it('rejects common weak or default passwords', () => {
      const banned = ['smaran', 'admin', 'password', '12345678', '123456789', 'administrator'];
      for (const pwd of banned) {
        expect(validateAdminPassword(pwd).ok).toBe(false);
        expect(validateAdminPassword(pwd.toUpperCase()).ok).toBe(false);
      }
    });

    it('accepts strong passwords meeting security requirements', () => {
      expect(validateAdminPassword('CorrectHorseBatteryStaple!9').ok).toBe(true);
      expect(validateAdminPassword('SahajSecure#2026').ok).toBe(true);
    });
  });

  describe('FileServerStore Admin Flow', () => {
    it('initializes with a cryptographically generated admin password and mustChangePassword = true', () => {
      const store = new FileServerStore(tempDir);
      const safeCreds = store.getSafeAdminCredentials();
      expect(safeCreds.username).toBe('smaran');
      expect(safeCreds.hasPassword).toBe(true);
      expect(safeCreds.isConfigured).toBe(true);
      expect(safeCreds.mustChangePassword).toBe(true);

      const generated = store.getAdminPassword();
      expect(generated.length).toBeGreaterThanOrEqual(16);
    });

    it('never persists plaintext admin password in fileserver.json', () => {
      const store = new FileServerStore(tempDir);
      const filePath = path.join(tempDir, 'fileserver.json');
      const rawJson = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(rawJson);

      expect(parsed.settings.adminPassword).toBe('');
      expect(parsed.settings.encryptedAdminPassword).toBeDefined();
      expect(parsed.settings.encryptedAdminPassword.length).toBeGreaterThan(0);
      expect(rawJson).not.toContain(store.getAdminPassword());
    });

    it('getSafeSettings strips passwords before sending across IPC to renderer', () => {
      const store = new FileServerStore(tempDir);
      const safe = store.getSafeSettings();
      expect(safe.adminPassword).toBe('');
      expect(safe.encryptedAdminPassword).toBe('');
    });

    it('updates admin password securely and enforces validation', () => {
      const store = new FileServerStore(tempDir);
      const newPassword = 'NewRobustPassword@9921';

      store.setAdminPassword(newPassword, false);
      expect(store.getAdminPassword()).toBe(newPassword);
      expect(store.getSafeAdminCredentials().mustChangePassword).toBe(false);

      // Throws on weak password
      expect(() => store.setAdminPassword('weak', false)).toThrow();
    });

    it('manages user accounts with password encryption and redaction in getSafeUsers', () => {
      const store = new FileServerStore(tempDir);
      store.saveUser({
        id: 'user-guest',
        username: 'guest',
        password: 'GuestSecretPassword123!',
        role: 'user',
        isSystem: false,
      });

      const users = store.getUsers();
      const guest = users.find((u) => u.username === 'guest');
      expect(guest).toBeDefined();
      expect(guest?.password).toBe('GuestSecretPassword123!');

      // Safe users must redact passwords completely
      const safeUsers = store.getSafeUsers();
      const safeGuest = safeUsers.find((u) => u.username === 'guest');
      expect(safeGuest?.password).toBe('');
      expect(safeGuest?.encryptedPassword).toBe('');
    });

    it('persists encrypted password across store restarts', () => {
      const store1 = new FileServerStore(tempDir);
      const adminPwd = store1.getAdminPassword();

      // Create new store instance pointing to same directory
      const store2 = new FileServerStore(tempDir);
      expect(store2.getAdminPassword()).toBe(adminPwd);
    });
  });
});
