import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FileServerStore } from '../../src/main/fileserver/FileServerStore';
import { VfsManager } from '../../src/main/fileserver/vfs/VfsManager';
import { streamFolderAsZip, streamSelectionAsZip } from '../../src/main/fileserver/vfs/zipStream';
import {
  BruteForceLimiter,
  ipMatchesPattern,
  isIpAllowed,
} from '../../src/main/fileserver/security';
import { BandwidthManager, ThrottledStream } from '../../src/main/fileserver/throttler';
import { WebDavHandler } from '../../src/main/fileserver/webdav';
import type { VfsNode } from '../../src/shared/fileserver';

describe('Advanced Smaran HFS Features', () => {
  const tmpDir = path.join(os.tmpdir(), `smaran-hfs-adv-test-${Date.now()}`);
  let store: FileServerStore;
  let vfs: VfsManager;

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    store = new FileServerStore(tmpDir);
    // set rootDir inside tmpDir
    const rootDir = path.join(tmpDir, 'root');
    fs.mkdirSync(rootDir, { recursive: true });
    store.updateSettings({ rootDir });
    vfs = new VfsManager(store);

    // Create some sample test files in root
    fs.writeFileSync(path.join(rootDir, 'sample.txt'), 'Hello world from Smaran HFS', 'utf8');
    const subDir = path.join(rootDir, 'subfolder');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'subfile.json'), '{"ok": true}', 'utf8');
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  describe('Virtual File System (VFS)', () => {
    it('resolves default root mounts', () => {
      const res = vfs.resolvePath('/');
      expect(res).not.toBeNull();
      expect(res?.type).toBe('physical_dir');
      expect(res?.permissions.canRead).toBe(true);
      expect(res?.permissions.canUpload).toBe(true);
    });

    it('resolves physical files inside root', () => {
      const res = vfs.resolvePath('/sample.txt');
      expect(res).not.toBeNull();
      expect(res?.type).toBe('physical_file');
      expect(res?.physicalPath).toBe(path.join(store.getSettings().rootDir, 'sample.txt'));
    });

    it('supports custom physical directory VFS mounts', () => {
      const extraDir = path.join(tmpDir, 'extra_photos');
      fs.mkdirSync(extraDir, { recursive: true });
      fs.writeFileSync(path.join(extraDir, 'sunset.jpg'), 'fake-jpg-data', 'utf8');

      const vfsNode: VfsNode = {
        id: 'node-photos',
        name: 'Photos',
        vfsPath: '/photos',
        type: 'physical_dir',
        physicalPath: extraDir,
        readOnly: true,
        hidden: false,
        permissions: {
          canRead: true,
          canSee: true,
          canUpload: false,
          canDelete: false,
          canList: true,
          canArchive: true,
        },
        allowedRoles: [],
        createdAt: new Date().toISOString(),
      };
      store.saveVfsNode(vfsNode);

      const target = vfs.resolvePath('/photos/sunset.jpg');
      expect(target).not.toBeNull();
      expect(target?.type).toBe('physical_file');
      expect(target?.physicalPath).toBe(path.join(extraDir, 'sunset.jpg'));
      expect(target?.permissions.canUpload).toBe(false); // read-only enforced
    });

    it('supports link nodes', () => {
      const linkNode: VfsNode = {
        id: 'node-link',
        name: 'GitHub',
        vfsPath: '/github',
        type: 'link',
        linkUrl: 'https://github.com/SahajIVVIX-1/Smaran-Reminder-App',
        readOnly: false,
        hidden: false,
        permissions: {
          canRead: true,
          canSee: true,
          canUpload: false,
          canDelete: false,
          canList: true,
          canArchive: false,
        },
        allowedRoles: [],
        createdAt: new Date().toISOString(),
      };
      store.saveVfsNode(linkNode);

      const target = vfs.resolvePath('/github');
      expect(target).not.toBeNull();
      expect(target?.type).toBe('link');
      expect(target?.linkUrl).toBe('https://github.com/SahajIVVIX-1/Smaran-Reminder-App');
    });

    it('lists directory with merged virtual and physical items', () => {
      const listing = vfs.listDirectory('/');
      expect(listing).not.toBeNull();
      expect(listing?.items.some((i) => i.name === 'sample.txt')).toBe(true);
      expect(listing?.items.some((i) => i.name === 'subfolder')).toBe(true);
      expect(listing?.items.some((i) => i.name === 'photos')).toBe(true);
      expect(listing?.items.some((i) => i.name === 'github')).toBe(true);
    });
  });

  describe('File Comments (descript.ion)', () => {
    it('writes and reads standard descript.ion comments', () => {
      const rootDir = store.getSettings().rootDir;
      store.setCommentForFile(rootDir, 'sample.txt', 'Important project notes');

      const comments = store.getCommentsForDir(rootDir);
      expect(comments['sample.txt']).toBe('Important project notes');

      // Verify listing includes the comment
      const listing = vfs.listDirectory('/');
      const sample = listing?.items.find((i) => i.name === 'sample.txt');
      expect(sample?.comment).toBe('Important project notes');
    });
  });

  describe('IP Firewall & Anti-Brute Force', () => {
    it('matches exact IP', () => {
      expect(ipMatchesPattern('192.168.1.100', '192.168.1.100')).toBe(true);
      expect(ipMatchesPattern('192.168.1.101', '192.168.1.100')).toBe(false);
    });

    it('matches wildcard IP patterns', () => {
      expect(ipMatchesPattern('192.168.1.50', '192.168.1.*')).toBe(true);
      expect(ipMatchesPattern('10.0.0.5', '192.168.1.*')).toBe(false);
      expect(ipMatchesPattern('127.0.0.1', '*')).toBe(true);
    });

    it('matches CIDR subnets', () => {
      expect(ipMatchesPattern('192.168.1.42', '192.168.1.0/24')).toBe(true);
      expect(ipMatchesPattern('192.168.2.1', '192.168.1.0/24')).toBe(false);
      expect(ipMatchesPattern('10.5.12.8', '10.0.0.0/8')).toBe(true);
    });

    it('evaluates allowlist and blocklist rules properly', () => {
      // When disabled, all allowed
      expect(isIpAllowed('192.168.1.50', false, [], ['192.168.1.*'])).toBe(true);

      // When enabled and in blocklist, denied
      expect(isIpAllowed('192.168.1.50', true, [], ['192.168.1.50'])).toBe(false);

      // When allowlist specified, non-matching denied
      expect(isIpAllowed('10.0.0.1', true, ['192.168.1.*'], [])).toBe(false);

      // When in allowlist, allowed
      expect(isIpAllowed('192.168.1.20', true, ['192.168.1.*'], [])).toBe(true);
    });

    it('locks out IP after 5 consecutive failed logins', () => {
      const limiter = new BruteForceLimiter();
      const ip = '192.168.1.99';

      expect(limiter.isLocked(ip)).toBe(false);

      limiter.recordFailure(ip);
      limiter.recordFailure(ip);
      limiter.recordFailure(ip);
      limiter.recordFailure(ip);
      expect(limiter.isLocked(ip)).toBe(false);

      limiter.recordFailure(ip); // 5th failure
      expect(limiter.isLocked(ip)).toBe(true);

      limiter.recordSuccess(ip);
      expect(limiter.isLocked(ip)).toBe(false);
    });
  });

  describe('Bandwidth Throttling', () => {
    it('throttles stream chunks without dropping data', async () => {
      const throttler = new ThrottledStream(100); // 100 KB/s
      const input = Buffer.from('Testing bandwidth throttler stream payload with multiple bytes');
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve) => {
        throttler.on('data', (c) => chunks.push(c));
        throttler.on('end', () => resolve());
        throttler.write(input);
        throttler.end();
      });

      const output = Buffer.concat(chunks);
      expect(output.toString()).toBe(input.toString());
      expect(throttler.getBytesTransferred()).toBe(input.length);
    });

    it('manages concurrent download limits', () => {
      const manager = new BandwidthManager();
      const clientIp = '192.168.1.10';

      expect(manager.canStartDownload(clientIp, 2)).toBe(true);
      manager.startDownload(clientIp);
      expect(manager.canStartDownload(clientIp, 2)).toBe(true);
      manager.startDownload(clientIp);

      // At limit of 2
      expect(manager.canStartDownload(clientIp, 2)).toBe(false);

      manager.endDownload(clientIp);
      expect(manager.canStartDownload(clientIp, 2)).toBe(true);
    });
  });

  describe('Streaming ZIP Archive', () => {
    it('streams an entire directory as ZIP without error', async () => {
      const rootDir = store.getSettings().rootDir;
      const pass = new PassThrough();
      (pass as unknown as { setHeader: (k: string, v: string) => void }).setHeader = () => {};
      const fakeRes = pass as unknown as ServerResponse;

      const chunks: Buffer[] = [];
      pass.on('data', (c: Buffer) => chunks.push(c));

      await streamFolderAsZip(rootDir, fakeRes);

      const zipBuffer = Buffer.concat(chunks);
      expect(zipBuffer.length).toBeGreaterThan(100);
      // Valid ZIP files start with PK (0x50, 0x4B)
      expect(zipBuffer[0]).toBe(0x50);
      expect(zipBuffer[1]).toBe(0x4b);
    });

    it('streams multiple selected files as single ZIP', async () => {
      const rootDir = store.getSettings().rootDir;
      const items = [
        {
          physicalPath: path.join(rootDir, 'sample.txt'),
          archivePath: 'sample.txt',
        },
      ];

      const pass = new PassThrough();
      (pass as unknown as { setHeader: (k: string, v: string) => void }).setHeader = () => {};
      const fakeRes = pass as unknown as ServerResponse;

      const chunks: Buffer[] = [];
      pass.on('data', (c: Buffer) => chunks.push(c));

      await streamSelectionAsZip(items, fakeRes, 'my-selection.zip');

      const zipBuffer = Buffer.concat(chunks);
      expect(zipBuffer.length).toBeGreaterThan(50);
      expect(zipBuffer[0]).toBe(0x50);
      expect(zipBuffer[1]).toBe(0x4b);
    });
  });

  describe('WebDAV Server Protocol', () => {
    it('identifies WebDAV HTTP methods and Windows client user-agents', () => {
      const webdav = new WebDavHandler(vfs, store.getSettings().rootDir);
      expect(webdav.isWebDavRequest({ method: 'PROPFIND' } as unknown as IncomingMessage)).toBe(true);
      expect(webdav.isWebDavRequest({ method: 'MKCOL' } as unknown as IncomingMessage)).toBe(true);
      expect(webdav.isWebDavRequest({ method: 'MOVE' } as unknown as IncomingMessage)).toBe(true);
      expect(
        webdav.isWebDavRequest({
          method: 'GET',
          headers: { 'user-agent': 'Microsoft-WebDAV-MiniRedir/10.0.19041' },
        } as unknown as IncomingMessage),
      ).toBe(true);
      expect(
        webdav.isWebDavRequest({
          method: 'OPTIONS',
          url: '/DavWWWRoot/',
          headers: {},
        } as unknown as IncomingMessage),
      ).toBe(true);
      expect(
        webdav.isWebDavRequest({
          method: 'GET',
          headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        } as unknown as IncomingMessage),
      ).toBe(false);
    });

    it('handles WebDAV PROPFIND and returns 207 Multi-Status XML', async () => {
      const webdav = new WebDavHandler(vfs, store.getSettings().rootDir);

      let statusCode = 0;
      const headers: Record<string, string> = {};
      let responseBody = '';

      const req = {
        method: 'PROPFIND',
        url: '/',
        headers: { depth: '1' },
      } as unknown as IncomingMessage;

      const res = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
        writeHead: (code: number, hdrs?: Record<string, string>) => {
          statusCode = code;
          if (hdrs) Object.assign(headers, hdrs);
        },
        end: (data: string) => {
          responseBody = data;
        },
      } as unknown as ServerResponse;

      const handled = await webdav.handleRequest(req, res, '127.0.0.1');
      expect(handled).toBe(true);
      expect(statusCode).toBe(207);
      expect(headers['Content-Type']).toContain('application/xml');
      expect(responseBody).toContain('<D:multistatus xmlns:D="DAV:">');
      expect(responseBody).toContain('sample.txt');
    });
  });
});
