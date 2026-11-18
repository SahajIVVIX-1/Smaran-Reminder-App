import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lookupMime } from '../../src/main/fileserver/mime';
import { buildServerUrls, getLanIps } from '../../src/main/fileserver/network';
import {
  generateToken,
  hashPassword,
  resolveSafePath,
  verifyPassword,
} from '../../src/main/fileserver/security';
import { FileServerStore } from '../../src/main/fileserver/FileServerStore';
import { HttpServer } from '../../src/main/fileserver/HttpServer';

describe('FileServer Security', () => {
  const tmpBase = path.join(os.tmpdir(), 'smaran-fs-test-security');

  beforeAll(() => {
    fs.mkdirSync(tmpBase, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  it('allows safe relative paths inside baseDir', () => {
    const p1 = resolveSafePath(tmpBase, 'hello.txt');
    expect(p1).toBe(path.resolve(tmpBase, 'hello.txt'));

    const p2 = resolveSafePath(tmpBase, 'nested/folder/document.pdf');
    expect(p2).toBe(path.resolve(tmpBase, 'nested/folder/document.pdf'));

    const p3 = resolveSafePath(tmpBase, '');
    expect(p3).toBe(path.resolve(tmpBase));
  });

  it('blocks directory traversal attacks', () => {
    expect(resolveSafePath(tmpBase, '../outside.txt')).toBeNull();
    expect(resolveSafePath(tmpBase, '../../../../windows/system32/cmd.exe')).toBeNull();
    expect(resolveSafePath(tmpBase, 'sub/../../outside.txt')).toBeNull();
    expect(resolveSafePath(tmpBase, '%2e%2e/outside.txt')).toBeNull();
    expect(resolveSafePath(tmpBase, '..\\..\\windows')).toBeNull();
  });

  it('hashes and verifies passwords securely', () => {
    const pwd = 'CorrectHorseBatteryStaple123!';
    const hash = hashPassword(pwd);

    expect(hash).toContain(':');
    expect(verifyPassword(pwd, hash)).toBe(true);
    expect(verifyPassword('WrongPassword', hash)).toBe(false);
    expect(verifyPassword('', hash)).toBe(false);
    expect(verifyPassword(pwd, 'invalid-hash')).toBe(false);
  });

  it('generates random tokens of specified length', () => {
    const t1 = generateToken(16);
    const t2 = generateToken(16);
    expect(t1).toHaveLength(16);
    expect(t2).toHaveLength(16);
    expect(t1).not.toBe(t2);
  });
});

describe('FileServer Network & MIME', () => {
  it('detects network interfaces or returns empty array gracefully', () => {
    const ips = getLanIps();
    expect(Array.isArray(ips)).toBe(true);
    ips.forEach((ip) => {
      expect(ip).not.toBe('127.0.0.1');
      expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    });
  });

  it('builds server URLs properly', () => {
    const { localUrl, lanUrls } = buildServerUrls(5900, ['192.168.1.50'], false);
    expect(localUrl).toBe('http://localhost:5900');
    expect(lanUrls).toEqual(['http://192.168.1.50:5900']);

    const httpsRes = buildServerUrls(443, ['10.0.0.5'], true);
    expect(httpsRes.localUrl).toBe('https://localhost');
    expect(httpsRes.lanUrls).toEqual(['https://10.0.0.5']);
  });

  it('resolves common file MIME types', () => {
    expect(lookupMime('photo.jpg')).toBe('image/jpeg');
    expect(lookupMime('photo.png')).toBe('image/png');
    expect(lookupMime('video.mp4')).toBe('video/mp4');
    expect(lookupMime('audio.mp3')).toBe('audio/mpeg');
    expect(lookupMime('doc.pdf')).toBe('application/pdf');
    expect(lookupMime('data.json')).toBe('application/json');
    expect(lookupMime('archive.zip')).toBe('application/zip');
    expect(lookupMime('unknown.xyz123')).toBe('application/octet-stream');
  });
});

describe('FileServerStore', () => {
  const tmpStoreDir = path.join(os.tmpdir(), `smaran-store-test-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(tmpStoreDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpStoreDir, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  it('loads default settings and creates root directory', () => {
    const store = new FileServerStore(tmpStoreDir);
    const settings = store.getSettings();

    expect(settings.enabled).toBe(true);
    expect(settings.port).toBe(5900);
    expect(settings.serverName).toBe('Smaran File Server');
    expect(fs.existsSync(settings.rootDir)).toBe(true);
  });

  it('saves and updates settings', () => {
    const store = new FileServerStore(tmpStoreDir);
    store.updateSettings({ port: 8080, serverName: 'Custom NAS' });

    const updated = store.getSettings();
    expect(updated.port).toBe(8080);
    expect(updated.serverName).toBe('Custom NAS');
  });

  it('handles user accounts CRUD', () => {
    const store = new FileServerStore(tmpStoreDir);
    // Initial users contain default system admin 'smaran'
    expect(store.getUsers()).toHaveLength(1);
    expect(store.findUserByUsername('smaran')).toBeDefined();

    const user = {
      id: 'u1',
      username: 'alice',
      passwordHash: hashPassword('secret'),
      role: 'admin' as const,
      permissions: { read: true, upload: true, delete: true, rename: true, mkdir: true, comment: true, vfs: true, zip: true },
      allowedFolders: [],
      mustChangePassword: false,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };

    store.saveUser(user);
    expect(store.getUsers()).toHaveLength(2);
    expect(store.findUserByUsername('alice')).toBeDefined();
    expect(store.findUserByUsername('ALICE')).toBeDefined(); // Case-insensitive lookup

    store.deleteUser('u1');
    expect(store.getUsers()).toHaveLength(1);
    expect(store.findUserByUsername('smaran')).toBeDefined();

    // Verify system admin 'smaran' cannot be deleted
    const smaranUser = store.findUserByUsername('smaran')!;
    expect(() => store.deleteUser(smaranUser.id)).toThrow();
  });

  it('handles shares, transfers, and logs', () => {
    const store = new FileServerStore(tmpStoreDir);
    const share = {
      id: 's1',
      token: 'tok-123',
      name: 'file.txt',
      relativePath: 'file.txt',
      isFolder: false,
      permission: 'download' as const,
      passwordProtected: false,
      downloadCount: 0,
      createdAt: new Date().toISOString(),
    };

    store.saveShare(share);
    expect(store.getShares()).toHaveLength(1);
    expect(store.findShareByToken('tok-123')).toBeDefined();

    store.recordShareDownload('s1');
    expect(store.findShareByToken('tok-123')?.downloadCount).toBe(1);

    store.revokeShare('s1');
    expect(store.getShares()).toHaveLength(0);

    store.addLog({
      id: 'l1',
      timestamp: new Date().toISOString(),
      level: 'info',
      clientIp: '127.0.0.1',
      message: 'Test log',
    });
    expect(store.getLogs()).toHaveLength(1);
    store.clearLogs();
    expect(store.getLogs()).toHaveLength(0);
  });
});

describe('HttpServer Lifecycle & Endpoints', () => {
  const tmpServerDir = path.join(os.tmpdir(), `smaran-http-test-${Date.now()}`);
  let store: FileServerStore;
  let server: HttpServer;

  beforeAll(async () => {
    fs.mkdirSync(tmpServerDir, { recursive: true });
    store = new FileServerStore(tmpServerDir);
    store.updateSettings({
      port: 5919, // Distinct test port
      rootDir: tmpServerDir,
      authEnabled: false,
      guestAccess: true,
    });
    // Create a sample test file
    fs.writeFileSync(path.join(tmpServerDir, 'test.txt'), 'Hello from Smaran HFS!', 'utf8');

    server = new HttpServer(store);
    const res = await server.start();
    expect(res.ok).toBe(true);
  });

  afterAll(async () => {
    await server.stop();
    try {
      fs.rmSync(tmpServerDir, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  it('serves Web Manager HTML at root', async () => {
    const res = await fetch('http://localhost:5919/');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Smaran HFS');
    expect(text).toContain('LAN File Server');
  });

  it('returns valid status from /api/status', async () => {
    const res = await fetch('http://localhost:5919/api/status');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.running).toBe(true);
    expect(data.port).toBe(5919);
    expect(data.serverName).toBe(store.getSettings().serverName);
  });

  it('lists directory files via /api/files', async () => {
    const res = await fetch('http://localhost:5919/api/files');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toBeDefined();
    expect(data.items.some((i: { name: string }) => i.name === 'test.txt')).toBe(true);
  });

  it('serves files with HTTP Range requests', async () => {
    const res = await fetch('http://localhost:5919/download/test.txt', {
      headers: { Range: 'bytes=0-4' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toContain('bytes 0-4/');
    const text = await res.text();
    expect(text).toBe('Hello');
  });
});
