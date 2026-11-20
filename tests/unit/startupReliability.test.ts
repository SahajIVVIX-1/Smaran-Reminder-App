import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseNetshRuleOutput,
  isPortableExecutable,
} from '../../src/main/fileserver/windowsFirewall';
import {
  checkPortAvailable,
  HfsProcessSupervisor,
} from '../../src/main/fileserver/HfsProcessSupervisor';
import { FileServerStore } from '../../src/main/fileserver/FileServerStore';
import { HfsApiClient } from '../../src/main/fileserver/HfsApiClient';

describe('Smaran 3.4.6 — File Server Startup & Windows Firewall Reliability', () => {
  let tempDir: string;
  let store: FileServerStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-startup-test-'));
    store = new FileServerStore(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('1. Windows Defender Firewall Rule Parser & Path Classification', () => {
    it('accurately parses netsh output when no rules match', () => {
      const output = 'No rules match the specified criteria.\n';
      const parsed = parseNetshRuleOutput(output);
      expect(parsed.hasRule).toBe(false);
    });

    it('accurately parses netsh output for approved inbound allow rule', () => {
      const output = `
Rule Name:                            Smaran File Server
----------------------------------------------------------------------
Enabled:                              Yes
Direction:                            In
Profiles:                             Private,Public
Grouping:                             
LocalIP:                              Any
RemoteIP:                             Any
Protocol:                             TCP
LocalPort:                            Any
RemotePort:                           Any
Edge traversal:                       No
Action:                               Allow
Ok.
`;
      const parsed = parseNetshRuleOutput(output);
      expect(parsed.hasRule).toBe(true);
      expect(parsed.ruleName).toBe('Smaran File Server');
      expect(parsed.action).toBe('allow');
      expect(parsed.enabled).toBe(true);
      expect(parsed.profiles).toEqual(['Private', 'Public']);
    });

    it('accurately parses netsh output for denied/blocked inbound rule', () => {
      const output = `
Rule Name:                            Smaran File Server
----------------------------------------------------------------------
Enabled:                              Yes
Direction:                            In
Profiles:                             Public
Grouping:                             
LocalIP:                              Any
RemoteIP:                             Any
Protocol:                             TCP
LocalPort:                            Any
RemotePort:                           Any
Edge traversal:                       No
Action:                               Block
Ok.
`;
      const parsed = parseNetshRuleOutput(output);
      expect(parsed.hasRule).toBe(true);
      expect(parsed.action).toBe('block');
      expect(parsed.enabled).toBe(true);
    });

    it('identifies portable build executables running in Temp folders', () => {
      expect(
        isPortableExecutable('C:\\Users\\alice\\AppData\\Local\\Temp\\3mo8olm\\smaran.exe'),
      ).toBe(true);
      expect(isPortableExecutable('D:\\Temp\\Smaran-Portable.exe')).toBe(true);
      expect(
        isPortableExecutable('C:\\Users\\alice\\AppData\\Local\\Programs\\smaran\\Smaran.exe'),
      ).toBe(false);
      expect(isPortableExecutable('D:\\03_Projects\\Smaran\\dist\\Smaran.exe')).toBe(false);
    });
  });

  describe('2. Localhost Independence from LAN Firewall Rules', () => {
    it('verifies localhost HTTP health check responds independently of external network rules', async () => {
      // Create a mock local HTTP server listening only on 127.0.0.1
      const testServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Smaran HFS Ready');
      });

      const port = await new Promise<number>((resolve) => {
        testServer.listen(0, '127.0.0.1', () => {
          const addr = testServer.address() as net.AddressInfo;
          resolve(addr.port);
        });
      });

      try {
        const client = new HfsApiClient(port, 'test-token');
        const health = await client.checkDetailedHealth(2000);

        expect(health.ok).toBe(true);
        expect(health.statusCode).toBe(200);
        expect(health.durationMs).toBeGreaterThanOrEqual(0);

        const simpleHealth = await client.checkHttpHealth();
        expect(simpleHealth).toBe(true);
      } finally {
        await new Promise<void>((resolve) => testServer.close(() => resolve()));
      }
    });

    it('reports failure accurately when localhost server is not listening', async () => {
      const client = new HfsApiClient(59998, 'test-token');
      const health = await client.checkDetailedHealth(500);

      expect(health.ok).toBe(false);
      expect(health.error).toBeDefined();
    });
  });

  describe('3. Process Lifecycle, Error Detection & Startup Deadline', () => {
    it('detects EADDRINUSE port binding conflicts accurately', async () => {
      const blocker = net.createServer();
      const testPort = 59123;

      await new Promise<void>((resolve) => {
        blocker.listen({ port: testPort, host: '127.0.0.1' }, () => resolve());
      });

      try {
        const check = await checkPortAvailable(testPort);
        expect(check.available).toBe(false);
        expect(check.error).toContain('already in use');
      } finally {
        await new Promise<void>((resolve) => blocker.close(() => resolve()));
      }
    });

    it('aborts waitForHealthy immediately on child process premature exit without waiting 30s', async () => {
      const supervisor = new HfsProcessSupervisor(tempDir, store, {
        isLicenseValid: () => true,
      });

      // Set 30s deadline
      supervisor.startupTimeoutMs = 30000;

      // Simulate a child process that exited immediately with code 1 and error log
      // @ts-expect-error accessing private field for unit test
      supervisor.isStarting = true;
      // @ts-expect-error accessing private field for unit test
      supervisor.startupErrorLogs = ['listen EADDRINUSE: address already in use :::5901'];
      // @ts-expect-error accessing private field for unit test
      supervisor.lastExitInfo = { code: 1, signal: null, timestamp: Date.now() };

      const start = Date.now();
      await expect(
        // @ts-expect-error accessing private method for unit test
        supervisor.waitForHealthy(5901, 30000),
      ).rejects.toThrow(/terminated (during startup|prematurely).*EADDRINUSE/);

      const elapsed = Date.now() - start;
      // Must abort immediately (< 1000ms), NOT wait for 30s!
      expect(elapsed).toBeLessThan(1000);
    });

    it('aborts waitForHealthy immediately on child process spawn error', async () => {
      const supervisor = new HfsProcessSupervisor(tempDir, store, {
        isLicenseValid: () => true,
      });

      // @ts-expect-error accessing private field for unit test
      supervisor.isStarting = true;
      // @ts-expect-error accessing private field for unit test
      supervisor.startupSpawnError = new Error('spawn ENOENT - executable not found');

      const start = Date.now();
      await expect(
        // @ts-expect-error accessing private method for unit test
        supervisor.waitForHealthy(5901, 30000),
      ).rejects.toThrow(/Failed to spawn HFS engine process.*ENOENT/);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it('prevents multiple simultaneous start calls via concurrency promise mutex', async () => {
      const supervisor = new HfsProcessSupervisor(tempDir, store, {
        isLicenseValid: () => false, // will fail at license check
      });

      const p1 = supervisor.start();
      const p2 = supervisor.start();

      expect(p1).toBe(p2); // Exact same promise returned
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(r1.error).toContain('License activation required');
    });

    it('allows clean restart after a failed launch without hanging state', async () => {
      let licenseValid = false;
      const supervisor = new HfsProcessSupervisor(tempDir, store, {
        isLicenseValid: () => licenseValid,
      });

      // 1. Initial attempt fails
      const res1 = await supervisor.start();
      expect(res1.ok).toBe(false);
      expect(supervisor.getStatus().state).toBe('error');

      // 2. License granted, supervisor can start cleanly
      licenseValid = true;
      vi.spyOn(supervisor, 'resolveEngineScript').mockImplementation(() => {
        throw new Error('Test resolve stop');
      });
      vi.spyOn(supervisor, 'ensureEngineExtracted').mockResolvedValue();

      const res2 = await supervisor.start();
      expect(res2.ok).toBe(false);
      expect(res2.error).toContain('Test resolve stop');
      expect(supervisor.getStatus().state).toBe('error');
    });
  });

  describe('4. Structured Startup Diagnostics & Redacted Export', () => {
    it('generates structured diagnostic export without sensitive credentials', () => {
      const supervisor = new HfsProcessSupervisor(tempDir, store, {
        isLicenseValid: () => true,
      });

      // Simulate a completed startup diagnostic record
      // @ts-expect-error accessing private field for unit test
      supervisor.lastStartupDiagnostic = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        isPackaged: false,
        isPortable: false,
        execPath: process.execPath,
        args: ['index.js', '--port', '5901', '--password', '••••••••', '--token', '••••••••'],
        port: 5901,
        pid: 12345,
        startupDurationMs: 1420,
        extractionDurationMs: 350,
        healthCheckResults: [
          {
            timestamp: new Date().toISOString(),
            durationMs: 45,
            status: 'ok',
            statusCode: 200,
          },
        ],
        firewallStatus: {
          hasRule: true,
          action: 'allow',
          enabled: true,
          details: 'Windows Firewall rule active',
        },
        processErrors: [],
        exitInfo: undefined,
      };

      const exportText = supervisor.exportDiagnostics();
      expect(exportText).toContain('SMARAN FILE SERVER STARTUP DIAGNOSTICS');
      expect(exportText).toContain('12345');
      expect(exportText).toContain('1420ms');
      expect(exportText).toContain('350ms');
      expect(exportText).toContain('Windows Firewall');
      expect(exportText).toContain('••••••••');
      expect(exportText).not.toContain('secretpassword');
      expect(exportText).not.toContain('adminPassword');
    });

    it('detects specific process errors including EADDRINUSE and EACCES', () => {
      const supervisor = new HfsProcessSupervisor(tempDir, store, {
        isLicenseValid: () => true,
      });

      // @ts-expect-error accessing private field for unit test
      supervisor.startupErrorLogs = ['Error: listen EADDRINUSE: address already in use :::5901'];
      // @ts-expect-error calling private helper for unit test
      const err = supervisor.detectSpecificStartupError();
      expect(err).toContain('EADDRINUSE');
      expect(err).toContain('already in use');

      // @ts-expect-error accessing private field for unit test
      supervisor.startupErrorLogs = ['Error: bind EACCES: permission denied 0.0.0.0:80'];
      // @ts-expect-error calling private helper for unit test
      const errAccess = supervisor.detectSpecificStartupError();
      expect(errAccess).toContain('EACCES');
      expect(errAccess).toContain('Access denied');
    });
  });
});
