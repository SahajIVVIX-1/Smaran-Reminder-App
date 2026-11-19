import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FileServerStore } from '../../src/main/fileserver/FileServerStore';
import { HttpServer } from '../../src/main/fileserver/HttpServer';
import { hashPassword } from '../../src/main/fileserver/security';

describe('FileServer Security & Authentication Regression', () => {
  const tmpDir = path.join(os.tmpdir(), `smaran-sec-regression-${Date.now()}`);
  let store: FileServerStore;
  let server: HttpServer;
  const testPort = 5988;
  const baseUrl = `http://127.0.0.1:${testPort}`;

  beforeAll(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    store = new FileServerStore(tmpDir);

    // Create root directory and sample confidential file
    const rootDir = path.join(tmpDir, 'root');
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'secret.txt'), 'SUPER_SECRET_PAYLOAD', 'utf8');

    // Configure server: auth enabled, guest access DISABLED
    store.updateSettings({
      port: testPort,
      rootDir,
      authEnabled: true,
      guestAccess: false,
    });

    server = new HttpServer(store);
    const res = await server.start();
    expect(res.ok).toBe(true);
  });

  afterAll(async () => {
    await server.stop();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  describe('1. Direct Unauthenticated Access', () => {
    it('rejects /api/files without credentials (401)', async () => {
      const res = await fetch(`${baseUrl}/api/files`);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects /download/secret.txt without credentials (401)', async () => {
      const res = await fetch(`${baseUrl}/download/secret.txt`);
      expect(res.status).toBe(401);
    });

    it('rejects /raw/secret.txt without credentials (401)', async () => {
      const res = await fetch(`${baseUrl}/raw/secret.txt`);
      expect(res.status).toBe(401);
    });

    it('rejects /preview/secret.txt without credentials (401)', async () => {
      const res = await fetch(`${baseUrl}/preview/secret.txt`);
      expect(res.status).toBe(401);
    });

    it('sanitizes /api/status without leaking internal paths when unauthenticated', async () => {
      const res = await fetch(`${baseUrl}/api/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.running).toBe(true);
      expect(data.authenticated).toBe(false);
      expect(data.rootDir).toBeUndefined();
      expect(data.liveConnections).toBeUndefined();
      expect(data.activeTransfers).toBeUndefined();
    });

    it('rejects /api/mount-bat without credentials (401)', async () => {
      const res = await fetch(`${baseUrl}/api/mount-bat`);
      expect(res.status).toBe(401);
    });

    it('rejects /api/admin/settings without credentials (401)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/settings`);
      expect(res.status).toBe(401);
    });
  });

  describe('2. Credential Verification & Failed Logins', () => {
    it('rejects incorrect password with correct username (401)', async () => {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'smaran', password: 'WrongPassword123' }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain('Invalid');
    });

    it('rejects unknown username with correct password (401)', async () => {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'unknown_hacker', password: 'smaran@123' }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });

    it('rejects both credentials incorrect (401)', async () => {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'fake', password: 'fake' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects empty credentials (401)', async () => {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '', password: '' }),
      });
      expect(res.status).toBe(401);
    });

    it('authenticates with correct credentials and returns session token and cookie (200)', async () => {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'smaran', password: 'smaran@123' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.sessionId).toBeDefined();
      expect(data.token).toBe(data.sessionId);
      expect(data.user.username).toBe('smaran');

      // Check Set-Cookie
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('smaran_session=');
    });
  });

  describe('3. Session Token & Cookie Validation', () => {
    let validToken = '';

    beforeAll(async () => {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'smaran', password: 'smaran@123' }),
      });
      const data = await res.json();
      validToken = data.sessionId;
    });

    it('allows access with valid X-Session-Id header', async () => {
      const res = await fetch(`${baseUrl}/api/files`, {
        headers: { 'X-Session-Id': validToken },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.some((i: { name: string }) => i.name === 'secret.txt')).toBe(true);
    });

    it('allows access with valid Authorization Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/files`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      expect(res.status).toBe(200);
    });

    it('allows access with valid smaran_session Cookie', async () => {
      const res = await fetch(`${baseUrl}/api/files`, {
        headers: { Cookie: `smaran_session=${validToken}` },
      });
      expect(res.status).toBe(200);
    });

    it('allows access with valid ?token= query parameter in preview route', async () => {
      const res = await fetch(`${baseUrl}/preview/secret.txt?token=${validToken}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('secret.txt');
      expect(html).toContain('SUPER_SECRET_PAYLOAD');
    });

    it('rejects tampered / forged session token in header (401)', async () => {
      const res = await fetch(`${baseUrl}/api/files`, {
        headers: { 'X-Session-Id': 'forged-fake-session-token' },
      });
      expect(res.status).toBe(401);
    });

    it('rejects tampered cookie (401)', async () => {
      const res = await fetch(`${baseUrl}/api/files`, {
        headers: { Cookie: 'smaran_session=tampered-cookie-value' },
      });
      expect(res.status).toBe(401);
    });

    it('rejects revoked / logged out session (401)', async () => {
      // 1. Create a fresh session
      const loginRes = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'smaran', password: 'smaran@123' }),
      });
      const loginData = await loginRes.json();
      const tempToken = loginData.sessionId;

      // 2. Verify it works
      const test1 = await fetch(`${baseUrl}/api/files`, {
        headers: { 'X-Session-Id': tempToken },
      });
      expect(test1.status).toBe(200);

      // 3. Logout
      const logoutRes = await fetch(`${baseUrl}/api/logout`, {
        method: 'POST',
        headers: { 'X-Session-Id': tempToken },
      });
      expect(logoutRes.status).toBe(200);

      // 4. Verify the revoked token now receives 401
      const test2 = await fetch(`${baseUrl}/api/files`, {
        headers: { 'X-Session-Id': tempToken },
      });
      expect(test2.status).toBe(401);
    });
  });

  describe('4. Guest Access Boundaries (Critical Security Rule)', () => {
    beforeAll(() => {
      // Enable guest access for this suite
      store.updateSettings({ guestAccess: true });
    });

    afterAll(() => {
      store.updateSettings({ guestAccess: false });
    });

    it('allows anonymous GET when guestAccess is enabled', async () => {
      const res = await fetch(`${baseUrl}/api/files`);
      expect(res.status).toBe(200);
    });

    it('NEVER allows request with INVALID credentials to fall back to guest (401)', async () => {
      // Basic Auth with wrong password
      const badBasic = Buffer.from('smaran:WrongPassword').toString('base64');
      const res1 = await fetch(`${baseUrl}/api/files`, {
        headers: { Authorization: `Basic ${badBasic}` },
      });
      expect(res1.status).toBe(401);

      // Invalid token header
      const res2 = await fetch(`${baseUrl}/api/files`, {
        headers: { 'X-Session-Id': 'fake-invalid-token' },
      });
      expect(res2.status).toBe(401);

      // Tampered cookie
      const res3 = await fetch(`${baseUrl}/api/files`, {
        headers: { Cookie: 'smaran_session=tampered' },
      });
      expect(res3.status).toBe(401);
    });

    it('rejects state-changing operations by guest (401 or 403)', async () => {
      // Guest attempting mkdir
      const res1 = await fetch(`${baseUrl}/api/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '', name: 'HackedFolder' }),
      });
      expect([401, 403]).toContain(res1.status);

      // Guest attempting delete
      const res2 = await fetch(`${baseUrl}/api/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'secret.txt' }),
      });
      expect([401, 403]).toContain(res2.status);
    });
  });

  describe('5. Role-Based Permissions & Admin Isolation', () => {
    let regularUserToken = '';

    beforeAll(async () => {
      // Create a restricted user: read only, no delete, no mkdir, not admin
      const restrictedUser = {
        id: 'user_restricted_test',
        username: 'bob',
        passwordHash: hashPassword('bobpass123'),
        role: 'user' as const,
        permissions: {
          read: true,
          upload: false,
          delete: false,
          rename: false,
          mkdir: false,
          comment: false,
          vfs: false,
          zip: true,
        },
        allowedFolders: [],
        mustChangePassword: false,
        isSystem: false,
        createdAt: new Date().toISOString(),
      };
      store.saveUser(restrictedUser);

      const loginRes = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bob', password: 'bobpass123' }),
      });
      const data = await loginRes.json();
      regularUserToken = data.sessionId;
    });

    it('regular user cannot access /api/admin/settings (403)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        headers: { 'X-Session-Id': regularUserToken },
      });
      expect(res.status).toBe(403);
    });

    it('regular user without mkdir permission cannot create folder (403)', async () => {
      const res = await fetch(`${baseUrl}/api/mkdir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': regularUserToken,
        },
        body: JSON.stringify({ path: '', name: 'BobNewFolder' }),
      });
      expect(res.status).toBe(403);
    });

    it('regular user without delete permission cannot delete file (403)', async () => {
      const res = await fetch(`${baseUrl}/api/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': regularUserToken,
        },
        body: JSON.stringify({ path: 'secret.txt' }),
      });
      expect(res.status).toBe(403);
    });
  });
});
