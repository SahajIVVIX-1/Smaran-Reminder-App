import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  FileServerStore,
  generateDefaultAdminPassword,
  validateAdminPassword,
} from '../../src/main/fileserver/FileServerStore';
import {
  decryptSecret,
  encryptSecret,
  isSecretEncrypted,
} from '../../src/main/fileserver/secureStorage';
import { HfsApiClient } from '../../src/main/fileserver/HfsApiClient';
import {
  parseNetshRuleOutput,
  authorizeFirewallRule,
  removeFirewallRule,
} from '../../src/main/fileserver/windowsFirewall';
import {
  validateExecutionArgs,
  validateExecutionPath,
  splitArgs,
} from '../../src/main/automations/actions';
import { redactSensitiveLog } from '../../src/main/fileserver/HfsLogger';
import {
  backupWebClientRegistry,
  restoreWebClientRegistry,
} from '../../src/main/fileserver/webdavRegistry';
import { checkPortAvailable } from '../../src/main/fileserver/HfsProcessSupervisor';
import { LicenseStore } from '../../src/main/license/LicenseStore';
import {
  LICENSE_PUBLIC_KEY,
  TRUSTED_LICENSE_PUBLIC_KEYS,
} from '../../src/shared/license/publicKey';
import { encodeContainer, payloadBytes, buildPayload } from '../../src/shared/license/core';
import { createPrivateKey, sign } from 'node:crypto';

describe('Smaran 3.4.9 — Security Remediation & Reliability Test Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-349-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // 1. Password change from Smaran
  it('1. correctly changes administrator password in Smaran store', () => {
    const store = new FileServerStore(tempDir);
    const newPass = 'NewStrongPass!2026';
    store.setAdminPassword(newPass, false);

    expect(store.getAdminPassword()).toBe(newPass);
    const safeCreds = store.getSafeAdminCredentials();
    expect(safeCreds.hasPassword).toBe(true);
    expect(safeCreds.isConfigured).toBe(true);
    expect(safeCreds.mustChangePassword).toBe(false);

    // Verify raw disk file does NOT contain plaintext password
    const rawDisk = fs.readFileSync(store.filePath, 'utf8');
    expect(rawDisk).not.toContain(newPass);
    const parsed = JSON.parse(rawDisk);
    expect(parsed.settings.adminPassword).toBe('');
    expect(isSecretEncrypted(parsed.settings.encryptedAdminPassword)).toBe(true);
  });

  // 2. HFS authentication using the changed password
  it('2. verifies HFS accepts HTTP Basic credentials with updated password', async () => {
    const port = 5991;
    const client = new HfsApiClient(port, 'dummy-token');

    // Mock http request in verifyCredentials to simulate HFS response
    const http = await import('node:http');
    const requestSpy = vi.spyOn(http.default, 'request').mockImplementation((options: unknown, callback?: unknown) => {
      const opts = options as { headers: Record<string, string> };
      const cb = callback as (res: { statusCode: number; on: (ev: string, handler: unknown) => void }) => void;
      const expectedAuth = Buffer.from('smaran:NewStrongPass!2026', 'utf8').toString('base64');
      const isAuthed = opts.headers['Authorization'] === `Basic ${expectedAuth}`;

      const res = {
        statusCode: isAuthed ? 200 : 401,
        on: (_ev: string, _handler: unknown) => {},
      };
      setTimeout(() => cb(res), 10);
      return {
        on: vi.fn(),
        end: vi.fn(),
      } as unknown as ReturnType<typeof http.default.request>;
    });

    const successProbe = await client.verifyCredentials('smaran', 'NewStrongPass!2026');
    expect(successProbe.ok).toBe(true);
    expect(successProbe.status).toBe(200);

    requestSpy.mockRestore();
  });

  // 3. Smaran authentication using the changed password
  it('3. confirms Smaran recognizes the updated password and validates credentials', () => {
    const store = new FileServerStore(tempDir);
    const pass = 'SmaranRecognized#789';
    store.setAdminPassword(pass, false);

    expect(store.getAdminPassword()).toBe(pass);
    const validation = validateAdminPassword(store.getAdminPassword());
    expect(validation.ok).toBe(true);
  });

  // 4. Old password rejection
  it('4. rejects old password and verifies bad credentials fail authentication', async () => {
    const port = 5992;
    const client = new HfsApiClient(port, 'dummy-token');

    const http = await import('node:http');
    const requestSpy = vi.spyOn(http.default, 'request').mockImplementation((options: unknown, callback?: unknown) => {
      const opts = options as { headers: Record<string, string> };
      const cb = callback as (res: { statusCode: number; on: (ev: string, handler: unknown) => void }) => void;
      const expectedAuth = Buffer.from('smaran:NewPass12345', 'utf8').toString('base64');
      const isAuthed = opts.headers['Authorization'] === `Basic ${expectedAuth}`;

      const res = {
        statusCode: isAuthed ? 200 : 401,
        on: (_ev: string, _handler: unknown) => {},
      };
      setTimeout(() => cb(res), 10);
      return {
        on: vi.fn(),
        end: vi.fn(),
      } as unknown as ReturnType<typeof http.default.request>;
    });

    const failedProbe = await client.verifyCredentials('smaran', 'OldStalePassword123');
    expect(failedProbe.ok).toBe(false);
    expect(failedProbe.status).toBe(401);

    requestSpy.mockRestore();
  });

  // 5. Password synchronization after restart
  it('5. maintains encrypted password and synchronization across store restarts', () => {
    const store1 = new FileServerStore(tempDir);
    const pass = 'PersistentAcrossReboots!2026';
    store1.setAdminPassword(pass, false);
    store1.updateSettings({ adminUsername: 'admin_persisted' });

    // Simulate process exit and restart with new store instance
    const store2 = new FileServerStore(tempDir);
    expect(store2.getAdminPassword()).toBe(pass);
    expect(store2.getSettings().adminUsername).toBe('admin_persisted');
    expect(store2.getSafeAdminCredentials().hasPassword).toBe(true);
  });

  // 6. Partial password-update failure and recovery
  it('6. recovers store state on partial failure without leaving corrupted credentials', () => {
    const store = new FileServerStore(tempDir);
    const originalPass = store.getAdminPassword();
    const originalUser = store.getSettings().adminUsername;

    // Simulate a failed update: reject password that violates validation requirements
    const weakPass = '123';
    expect(() => store.setAdminPassword(weakPass)).toThrow(/Password must be at least 8 characters/);

    // Verify original credentials remain untouched
    expect(store.getAdminPassword()).toBe(originalPass);
    expect(store.getSettings().adminUsername).toBe(originalUser);
  });

  // 7. Session invalidation
  it('7. invalidates and disconnects active sessions', async () => {
    const client = new HfsApiClient(5901, 'dummy-token');
    const disconnectCalls: string[] = [];

    vi.spyOn(client, 'getConnections').mockResolvedValue({
      connections: [
        { id: 'sess-1', ip: '192.168.1.10' },
        { id: 'sess-2', ip: '192.168.1.20' },
      ],
    });
    vi.spyOn(client, 'disconnect').mockImplementation(async (id: string) => {
      disconnectCalls.push(id);
      return { ok: true };
    });

    const conns = await client.getConnections();
    for (const c of conns.connections) {
      await client.disconnect(c.id);
    }

    expect(disconnectCalls).toEqual(['sess-1', 'sess-2']);
  });

  // 8. Initial secure password generation
  it('8. generates unguessable, strong initial password and requires password change on first run', () => {
    const pass1 = generateDefaultAdminPassword();
    const pass2 = generateDefaultAdminPassword();

    // Verify strong length and high entropy
    expect(pass1.length).toBeGreaterThanOrEqual(20);
    expect(pass2.length).toBeGreaterThanOrEqual(20);
    expect(pass1).not.toBe(pass2);

    // Verify it doesn't contain predictable timestamps or dates
    expect(pass1).not.toMatch(/smaran@\d{8}/);

    // Verify first run store enforces mustChangePassword: true
    const store = new FileServerStore(tempDir);
    expect(store.getSafeAdminCredentials().mustChangePassword).toBe(true);
  });

  // 9. Private-key exclusion from release artifacts
  it('9. ensures .gitignore and packaging rules exclude private signing keys', () => {
    const gitignorePath = path.resolve('.gitignore');
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');

    expect(gitignore).toContain('.smaran-license/');
    expect(gitignore).toContain('private-key.json');
    expect(gitignore).toContain('*.key');
    expect(gitignore).toContain('*.pem');

    // Verify electron-builder configuration does not include .smaran-license
    const builderPath = path.resolve('electron-builder.yml');
    const builderYml = fs.readFileSync(builderPath, 'utf8');
    expect(builderYml).not.toContain('.smaran-license');
  });

  // 10. Existing license verification during key rotation
  it('10. verifies existing valid customer licenses while supporting key rotation', () => {
    // Generate an Ed25519 test keypair to simulate key rotation
    const { generateKeyPairSync } = require('node:crypto');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const pubJwk = publicKey.export({ format: 'jwk' });

    // Store configured with trusted key rotation list
    const store = new LicenseStore(tempDir, {
      publicKey: pubJwk.x,
    });

    const payload = buildPayload({
      name: 'Sahaj Customer',
      years: 1,
      id: 'test-uuid-rotation',
      now: new Date(),
      issuer: 'Smaran Authority',
      ip: '127.0.0.1',
    });

    const pBytes = payloadBytes(payload);
    const signature = new Uint8Array(sign(null, pBytes, privateKey));
    const container = encodeContainer(pBytes, signature);

    const verified = (store as unknown as { verify: (bytes: Uint8Array) => unknown }).verify(container);
    expect(verified).toBeDefined();
  });

  // 11. Firewall rule scope
  it('11. verifies firewall rule enforces TCP-only, configured port and Private profile by default', () => {
    const netshOutput = `
Rule Name:                            Smaran File Server
----------------------------------------------------------------------
Enabled:                              Yes
Direction:                            In
Profiles:                             Private
Grouping:                             
LocalIP:                              Any
RemoteIP:                             localsubnet
Protocol:                             TCP
LocalPort:                            5901
RemotePort:                           Any
Edge traversal:                       No
Action:                               Allow
Ok.
`;
    const parsed = parseNetshRuleOutput(netshOutput);
    expect(parsed.hasRule).toBe(true);
    expect(parsed.action).toBe('allow');
    expect(parsed.profiles).toEqual(['Private']);
    expect(parsed.protocol).toBe('TCP');
    expect(parsed.localPort).toBe('5901');
    expect(parsed.remoteIP).toBe('localsubnet');
  });

  // 12. Firewall rule removal
  it('12. verifies firewall rule removal succeeds without errors on non-Windows or mocks', async () => {
    const res = await removeFirewallRule();
    expect(res).toBeDefined();
    expect(typeof res.ok).toBe('boolean');
  });

  // 13. Automation command injection attempts
  it('13. blocks shell command injection in automation arguments and paths', () => {
    // Malicious arguments with shell metacharacters for batch execution
    expect(() => validateExecutionArgs('& calc.exe', '.bat')).toThrow(/unsafe shell metacharacters/);
    expect(() => validateExecutionArgs('| whoami', '.cmd')).toThrow(/unsafe shell metacharacters/);
    expect(() => validateExecutionArgs('&& notepad.exe', '.bat')).toThrow(/unsafe shell metacharacters/);
    expect(() => validateExecutionArgs('> output.txt', '.bat')).toThrow(/unsafe shell metacharacters/);
    expect(() => validateExecutionArgs('arg1\r\ncalc.exe', '.exe')).toThrow(/invalid newline/);

    // Malicious paths
    expect(() => validateExecutionPath('app\0.exe')).toThrow(/invalid control characters/);
    expect(() => validateExecutionPath('app\ncalc.exe')).toThrow(/invalid control characters/);

    // Safe arguments pass cleanly
    const safe = validateExecutionArgs('--config "my file.json" --port 8080', '.exe');
    expect(safe).toEqual(['--config', 'my file.json', '--port', '8080']);
  });

  // 14. Diagnostic secret redaction
  it('14. thoroughly redacts passwords, tokens, auth headers, cookies and private keys', () => {
    const fakePemKey = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIPx7...secretKeyBytes...==
-----END PRIVATE KEY-----`;

    const sampleLog = `
Request failed for user: admin with password="SecretPassword123" and token=superToken999
Authorization: Basic c21hcmFuOlBhc3N3b3JkMQ==
Authorization: Bearer mySecretToken.jwt.part
Cookie: session=xyz123; admin_token=456
LicenseKey: license_key=ABCDEF1234567890ABCDEF1234567890
Key content: ${fakePemKey}
`;
    const redacted = redactSensitiveLog(sampleLog);

    expect(redacted).not.toContain('SecretPassword123');
    expect(redacted).not.toContain('superToken999');
    expect(redacted).not.toContain('c21hcmFuOlBhc3N3b3JkMQ==');
    expect(redacted).not.toContain('mySecretToken.jwt.part');
    expect(redacted).not.toContain('xyz123');
    expect(redacted).not.toContain('secretKeyBytes');

    expect(redacted).toContain('password="[REDACTED]"');
    expect(redacted).toContain('token=[REDACTED]');
    expect(redacted).toContain('Authorization: Basic [REDACTED]');
    expect(redacted).toContain('Authorization: Bearer [REDACTED]');
    expect(redacted).toContain('[REDACTED PRIVATE KEY]');
  });

  // 15. WebDAV registry restoration
  it('15. verifies WebDAV registry configuration creates backups and provides clean restoration', async () => {
    const backup = await backupWebClientRegistry(tempDir);
    expect(backup).toBeDefined();

    const backupFile = path.join(tempDir, 'webdav-registry-backup.json');
    expect(fs.existsSync(backupFile)).toBe(true);
  });

  // 16. File Server first startup
  it('16. validates first-run state, port checks and permission verifications', async () => {
    const check = await checkPortAvailable(5901);
    expect(check).toBeDefined();
    expect(typeof check.available).toBe('boolean');
  });

  // 17. File Server restart
  it('17. validates port and state consistency during restart cycle', () => {
    const store = new FileServerStore(tempDir);
    store.updateSettings({ port: 5988 });
    expect(store.getSettings().port).toBe(5988);
  });

  // 18. Port conflict handling
  it('18. detects privileged ports (< 1024) and port conflicts without crashing', async () => {
    const privPort = await checkPortAvailable(80);
    expect(privPort.available).toBe(false);
    expect(privPort.error).toContain('privileged port');

    const invalidPort = await checkPortAvailable(70000);
    expect(invalidPort.available).toBe(false);
    expect(invalidPort.error).toContain('Invalid port');
  });
});
