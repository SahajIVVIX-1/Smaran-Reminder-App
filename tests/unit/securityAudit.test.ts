import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import {
  validateDriveLetter,
  validateCredentialInput,
} from '../../src/main/fileserver/FileServerManager';
import { FileServerStore } from '../../src/main/fileserver/FileServerStore';
import {
  getSenderRole,
  assertAuthorizedSender,
  IpcSecurityError,
} from '../../src/main/ipc/security';
import {
  isSafeExternalUrl,
  isInternalAppUrl,
} from '../../src/main/security/navigationSecurity';
import {
  HfsOperationalLogger,
  redactSensitiveLog,
} from '../../src/main/fileserver/HfsLogger';
import { ConfigStore } from '../../src/main/store/ConfigStore';
import {
  backupWebClientRegistry,
  restoreWebClientRegistry,
} from '../../src/main/fileserver/webdavRegistry';

describe('Smaran 3.4.5 Backend Security Audit Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-security-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('1. WebDAV Command Injection & Input Sanitization', () => {
    it('accepts valid single-letter drive formats', () => {
      expect(validateDriveLetter('Z:')).toBe('Z:');
      expect(validateDriveLetter('z')).toBe('Z:');
      expect(validateDriveLetter('X')).toBe('X:');
      expect(validateDriveLetter()).toBe('Z:');
    });

    it('strictly rejects malicious command-injected drive strings', () => {
      expect(() => validateDriveLetter('Z: & calc.exe &')).toThrow(/Invalid drive letter/);
      expect(() => validateDriveLetter('C; rm -rf /')).toThrow(/Invalid drive letter/);
      expect(() => validateDriveLetter('XYZ:')).toThrow(/Invalid drive letter/);
      expect(() => validateDriveLetter('1:')).toThrow(/Invalid drive letter/);
      expect(() => validateDriveLetter('$$$')).toThrow(/Invalid drive letter/);
    });

    it('validates credential strings and rejects control characters and newlines', () => {
      expect(validateCredentialInput('smaranAdmin123', 'Username')).toBe('smaranAdmin123');
      expect(validateCredentialInput('Complex!P@ssw0rd$#', 'Password')).toBe('Complex!P@ssw0rd$#');

      expect(() => validateCredentialInput('admin\r\ncalc.exe', 'Username')).toThrow(
        /contains invalid control characters/,
      );
      expect(() => validateCredentialInput('pass\x00word', 'Password')).toThrow(
        /contains invalid control characters/,
      );
      expect(() => validateCredentialInput('pass\x1b[31m', 'Password')).toThrow(
        /contains invalid control characters/,
      );
    });
  });

  describe('2. Centralized IPC Sender Validation', () => {
    it('correctly identifies window roles from verified renderer URLs', () => {
      const mockEvent = (url: string) =>
        ({
          senderFrame: { url },
          sender: { isDestroyed: () => false, getURL: () => url },
        }) as unknown as IpcMainInvokeEvent;

      expect(getSenderRole(mockEvent('http://localhost:5173/app/index.html'))).toBe('app');
      expect(getSenderRole(mockEvent('http://127.0.0.1:5173/notification/index.html'))).toBe(
        'notification',
      );
      expect(getSenderRole(mockEvent('http://localhost:5173/menu/index.html'))).toBe('menu');
      expect(getSenderRole(mockEvent('http://localhost:5173/license/index.html'))).toBe('license');
      expect(getSenderRole(mockEvent('http://localhost:5173/setup/index.html'))).toBe('setup');
      expect(getSenderRole(mockEvent('http://localhost:5173/screenborder/index.html'))).toBe(
        'screenborder',
      );
      expect(getSenderRole(mockEvent('http://localhost:5173/trayart/index.html'))).toBe('trayart');
    });

    it('rejects unauthorized domains and unverified remote origins', () => {
      const mockEvent = (url: string) =>
        ({
          senderFrame: { url },
          sender: { isDestroyed: () => false, getURL: () => url },
        }) as unknown as IpcMainInvokeEvent;

      expect(getSenderRole(mockEvent('https://malicious-site.com/app/index.html'))).toBeNull();
      expect(getSenderRole(mockEvent('http://192.168.1.50:5173/app/index.html'))).toBeNull();
      expect(getSenderRole(mockEvent('javascript:alert(1)'))).toBeNull();
    });

    it('enforces authorized role permissions matrix and throws IpcSecurityError on unauthorized senders', () => {
      const notifEvent = {
        senderFrame: { url: 'http://localhost:5173/notification/index.html' },
        sender: { isDestroyed: () => false, getURL: () => 'http://localhost:5173/notification/index.html' },
      } as unknown as IpcMainInvokeEvent;

      // Notification card should NOT be allowed to save config or start file server
      expect(() => assertAuthorizedSender(notifEvent, ['app'], 'fileserver:start')).toThrow(
        IpcSecurityError,
      );

      // Notification card IS allowed to cancel automation countdown
      expect(assertAuthorizedSender(notifEvent, ['app', 'notification'], 'automations:cancel')).toBe(
        'notification',
      );
    });
  });

  describe('3. Administrator Credential Protection', () => {
    it('never exposes administrator plaintext password in safe settings', () => {
      const store = new FileServerStore(tempDir);
      const secretPass = 'SuperSecret123!';
      store.updateSettings({ adminUsername: 'admin_test', adminPassword: secretPass });

      const safe = store.getSafeSettings();
      expect(safe.adminUsername).toBe('admin_test');
      expect(safe.adminPassword).toBe(''); // Sanitized!

      const safeCreds = store.getSafeAdminCredentials();
      expect(safeCreds.username).toBe('admin_test');
      expect(safeCreds.hasPassword).toBe(true);
      expect(safeCreds.isConfigured).toBe(true);
      expect((safeCreds as Record<string, unknown>).password).toBeUndefined();
    });
  });

  describe('4. FileServerStore Persistence & Corruption Resilience', () => {
    it('recovers from backup file when configuration JSON is damaged', () => {
      const store = new FileServerStore(tempDir);
      store.updateSettings({ port: 6123, adminUsername: 'validUser' });
      store.save();

      const mainFile = store.filePath;
      const bakFile = `${mainFile}.bak`;
      expect(fs.existsSync(bakFile)).toBe(true);

      // Corrupt the main file with invalid JSON
      fs.writeFileSync(mainFile, '<<< INVALID TRUNCATED JSON >>>', 'utf8');

      // Reload store - should recover from .bak and preserve corrupt file
      const recoveredStore = new FileServerStore(tempDir);
      expect(recoveredStore.getSettings().port).toBe(6123);
      expect(recoveredStore.getSettings().adminUsername).toBe('validUser');

      // Verify damaged file was preserved for forensics
      const files = fs.readdirSync(tempDir);
      const corruptPreserved = files.some((f) => f.includes('fileserver.json.corrupt.'));
      expect(corruptPreserved).toBe(true);
    });
  });

  describe('5. External URL Safety & Navigation Guard', () => {
    it('permits safe HTTP and HTTPS URLs and blocks dangerous schemes', () => {
      expect(isSafeExternalUrl('https://google.com')).toBe(true);
      expect(isSafeExternalUrl('http://127.0.0.1:5901/')).toBe(true);
      expect(isSafeExternalUrl('mailto:support@smaran.app')).toBe(true);

      expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeExternalUrl('file:///C:/Windows/System32/cmd.exe')).toBe(false);
      expect(isSafeExternalUrl('vbscript:msgbox')).toBe(false);
      expect(isSafeExternalUrl('')).toBe(false);
    });

    it('identifies internal application pages', () => {
      expect(isInternalAppUrl('http://localhost:5173/app/index.html')).toBe(true);
      expect(isInternalAppUrl('http://127.0.0.1:5173/notification/index.html')).toBe(true);
      expect(isInternalAppUrl('https://evil.com/app/index.html')).toBe(false);
    });
  });

  describe('6. WebDAV Registry Backup & Restoration', () => {
    it('creates persistent backup file for WebDAV registry configuration', async () => {
      const backup = await backupWebClientRegistry(tempDir);
      expect(backup.reason).toContain('Smaran HFS');
      const backupPath = path.join(tempDir, 'webdav-registry-backup.json');
      expect(fs.existsSync(backupPath)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      expect(saved.modifiedAt).toBeDefined();
    });

    it('reports failure cleanly if no backup exists during restoration', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-reg-'));
      try {
        const res = await restoreWebClientRegistry(emptyDir);
        expect(res.ok).toBe(false);
        expect(res.error).toContain('No previous WebDAV registry backup found');
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe('7. Persistent Operational Logger & Redaction', () => {
    it('redacts passwords, tokens, auth headers and cookies from operational logs', () => {
      const sensitive =
        'Client sent Authorization: Basic c21hcmFuOlNlY3JldFBhc3MxMjM= with password="MySuperSecretPassword" and token=abc12345xyz and Cookie: session_id=987654321';
      const redacted = redactSensitiveLog(sensitive);

      expect(redacted).not.toContain('c21hcmFuOlNlY3JldFBhc3MxMjM=');
      expect(redacted).not.toContain('MySuperSecretPassword');
      expect(redacted).not.toContain('abc12345xyz');
      expect(redacted).not.toContain('987654321');
      expect(redacted).toContain('Authorization: Basic [REDACTED]');
      expect(redacted).toContain('password="[REDACTED]"');
      expect(redacted).toContain('token=[REDACTED]');
    });

    it('rotates log files when maximum size threshold is reached', () => {
      const logger = new HfsOperationalLogger(tempDir, { maxSizeBytes: 300, maxFiles: 3 });
      for (let i = 0; i < 20; i++) {
        logger.log('info', `Log line number ${i} with padding text to trigger size rotation threshold`);
      }

      const logDir = path.join(tempDir, 'logs');
      expect(fs.existsSync(path.join(logDir, 'hfs.log'))).toBe(true);
      expect(fs.existsSync(path.join(logDir, 'hfs.1.log'))).toBe(true);
    });
  });

  describe('8. ConfigStore Listener Isolation', () => {
    it('isolates subscriber errors so one throwing listener does not affect others or fail save', () => {
      const store = new ConfigStore(tempDir);
      store.load();

      const healthyListener1 = vi.fn();
      const faultyListener = vi.fn().mockImplementation(() => {
        throw new Error('Subscriber crash simulation!');
      });
      const healthyListener2 = vi.fn();

      store.onChange(healthyListener1);
      store.onChange(faultyListener);
      store.onChange(healthyListener2);

      const res = store.update((curr) => ({
        ...curr,
        settings: { ...curr.settings, onboarded: true },
      }));

      // The save operation MUST return ok: true despite faulty listener
      expect(res.ok).toBe(true);
      expect(healthyListener1).toHaveBeenCalledTimes(1);
      expect(faultyListener).toHaveBeenCalledTimes(1);
      expect(healthyListener2).toHaveBeenCalledTimes(1);
    });
  });
});
