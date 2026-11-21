import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_REMOTE_HUB_SETTINGS } from '../../src/shared/remotehub';
import { RemoteHubConfigStore } from '../../src/main/remotehub/RemoteHubConfigStore';
import { RemoteHubDeviceManager } from '../../src/main/remotehub/RemoteHubDeviceManager';
import { RemoteHubInputControl } from '../../src/main/remotehub/RemoteHubInputControl';
import { RemoteHubLogger, redactSecrets } from '../../src/main/remotehub/RemoteHubLogger';
import { RemoteHubSrtManager } from '../../src/main/remotehub/RemoteHubSrtManager';
import { RemoteHubUserStore } from '../../src/main/remotehub/RemoteHubUserStore';

describe('Smaran Remote Hub — Comprehensive Architecture & Security Suite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-remotehub-test-'));
  });

  describe('1. RemoteHubConfigStore & Port Validation', () => {
    it('initializes with default port 5902 and valid settings', () => {
      const store = new RemoteHubConfigStore(tmpDir);
      const settings = store.get();

      expect(settings).toEqual(DEFAULT_REMOTE_HUB_SETTINGS);
      expect(settings.port).toBe(5902);
      expect(settings.bindAddress).toBe('0.0.0.0');
      expect(settings.allowLan).toBe(true);
      expect(settings.autoStart).toBe(false);
      expect(settings.srtBasePort).toBe(6000);
      expect(settings.srtDefaultLatencyMs).toBe(120);
    });

    it('updates settings atomically and persists changes to disk', () => {
      const store = new RemoteHubConfigStore(tmpDir);
      store.update({ port: 5910, allowLan: false, defaultFps: 60 });

      const updated = store.get();
      expect(updated.port).toBe(5910);
      expect(updated.allowLan).toBe(false);
      expect(updated.defaultFps).toBe(60);

      // Verify file persistence
      const freshStore = new RemoteHubConfigStore(tmpDir);
      expect(freshStore.get().port).toBe(5910);
    });

    it('rejects invalid or privileged ports (< 1024 or > 65535)', () => {
      const store = new RemoteHubConfigStore(tmpDir);
      expect(() => store.update({ port: 80 })).toThrow();
      expect(() => store.update({ port: 70000 })).toThrow();
    });

    it('recovers from corrupt remotehub.json via backup or fallback', () => {
      const store = new RemoteHubConfigStore(tmpDir);
      store.update({ port: 5905 });

      const filePath = path.join(tmpDir, 'remotehub.json');
      const backupPath = `${filePath}.bak`;
      fs.copyFileSync(filePath, backupPath);

      // Corrupt main file
      fs.writeFileSync(filePath, '{ damaged_json: ');

      const recoveringStore = new RemoteHubConfigStore(tmpDir);
      expect(recoveringStore.get().port).toBe(5905); // Recovered from backup!

      // When both main and backup are corrupted, recovers safely via default fallback
      fs.writeFileSync(filePath, '{ damaged again: ');
      fs.writeFileSync(backupPath, '{ also damaged: ');
      const fallbackStore = new RemoteHubConfigStore(tmpDir);
      expect(fallbackStore.get().port).toBe(5902);
    });
  });

  describe('2. RemoteHubUserStore & Authentication Security', () => {
    it('creates primary Owner / Administrator account with salted scrypt hash', () => {
      const userStore = new RemoteHubUserStore(tmpDir);
      expect(userStore.hasOwner()).toBe(false);

      const admin = userStore.createOwner('admin', 'SuperSecurePass123!', 'Lead Admin');
      expect(admin.username).toBe('admin');
      expect(admin.role).toBe('owner');
      expect(userStore.hasOwner()).toBe(true);

      // Verify password is NOT stored in plaintext anywhere in the file
      const rawJson = fs.readFileSync(path.join(tmpDir, 'remotehub-users.json'), 'utf8');
      expect(rawJson).not.toContain('SuperSecurePass123!');
      expect(rawJson).toContain('salt');
      expect(rawJson).toContain('hash');
    });

    it('prevents multiple owner creations during first-run initialization', () => {
      const userStore = new RemoteHubUserStore(tmpDir);
      userStore.createOwner('admin', 'SuperSecurePass123!', 'Lead Admin');

      expect(() =>
        userStore.createOwner('imposter', 'AnotherPass123!', 'Second Admin'),
      ).toThrowError(/already been initialized/);
    });

    it('authenticates valid credentials, issues session token, and updates login count', () => {
      const userStore = new RemoteHubUserStore(tmpDir);
      userStore.createOwner('admin', 'SuperSecurePass123!', 'Lead Admin');

      const authRes = userStore.authenticate('admin', 'SuperSecurePass123!', '192.168.1.50');
      expect(authRes.ok).toBe(true);
      expect(authRes.user?.username).toBe('admin');
      expect(authRes.sessionToken).toBeTruthy();

      const validation = userStore.validateSession(authRes.sessionToken!);
      expect(validation.valid).toBe(true);
      expect(validation.user?.username).toBe('admin');

      const refreshedAdmin = userStore.getUser(authRes.user!.id);
      expect(refreshedAdmin?.loginCount).toBe(1);
    });

    it('rejects invalid password and rate limits after repeated failures', () => {
      const userStore = new RemoteHubUserStore(tmpDir);
      userStore.createOwner('admin', 'SuperSecurePass123!', 'Lead Admin');

      for (let i = 0; i < 4; i++) {
        const fail = userStore.authenticate('admin', 'WrongPassword!', '192.168.1.50');
        expect(fail.ok).toBe(false);
      }

      // 5th failed attempt triggers rate limit lockout
      const fifth = userStore.authenticate('admin', 'WrongPassword!', '192.168.1.50');
      expect(fifth.ok).toBe(false);

      // 6th attempt should return temporary lockout message
      const locked = userStore.authenticate('admin', 'SuperSecurePass123!', '192.168.1.50');
      expect(locked.ok).toBe(false);
      expect(locked.error).toMatch(/temporarily locked/i);
    });

    it('manages Operator and Viewer roles with role deletion guard', () => {
      const userStore = new RemoteHubUserStore(tmpDir);
      const owner = userStore.createOwner('admin', 'SuperSecurePass123!', 'Lead Admin');

      const op = userStore.createUser('operator1', 'OperatorPass123!', 'Switcher', 'operator');
      const view = userStore.createUser('viewer1', 'ViewerPass123!', 'Guest', 'viewer');

      expect(op.role).toBe('operator');
      expect(view.role).toBe('viewer');

      // Operator can be deleted
      expect(userStore.deleteUser(op.id)).toBe(true);

      // Owner cannot be deleted when it is the sole active owner
      expect(() => userStore.deleteUser(owner.id)).toThrowError(/Cannot delete the last Owner/);
    });
  });

  describe('3. RemoteHubDeviceManager & Strict Remote Desktop Eligibility', () => {
    it('registers local host PC as online and eligible for remote control', () => {
      const devManager = new RemoteHubDeviceManager(tmpDir);
      const devices = devManager.listDevices();

      const host = devices.find((d) => d.id === 'host-local');
      expect(host).toBeDefined();
      expect(host?.isSmaranInstalled).toBe(true);
      expect(host?.canRemoteControl).toBe(true);
      expect(host?.status).toBe('online');
    });

    it('generates 6-digit one-time pairing code expiring in 5 minutes', () => {
      const devManager = new RemoteHubDeviceManager(tmpDir);
      const pair = devManager.generatePairingCode();

      expect(pair.code).toMatch(/^\d{6}$/);
      expect(pair.expiresAt).toBeGreaterThan(Date.now() + 4 * 60_000);
      expect(devManager.getActivePairingCode()?.code).toBe(pair.code);
    });

    it('CRITICAL SECURITY: Participant PCs with Sharing Agent NEVER receive remote control permissions', () => {
      const devManager = new RemoteHubDeviceManager(tmpDir);
      const pair = devManager.generatePairingCode();

      const pairResult = devManager.pairDevice(pair.code, {
        name: 'Conference Room PC',
        hostname: 'CONF-ROOM-PC',
        ip: '192.168.1.105',
        os: 'Windows 11',
        isSmaranInstalled: false, // Lightweight Sharing Agent!
        agentVersion: '1.0.0',
      });

      expect(pairResult.ok).toBe(true);
      expect(pairResult.device?.isSmaranInstalled).toBe(false);
      // HARD ENFORCEMENT: canRemoteControl MUST be FALSE
      expect(pairResult.device?.canRemoteControl).toBe(false);

      // Verify single-use pairing code is now consumed
      expect(devManager.getActivePairingCode()).toBeNull();
    });

    it('detects inactive devices and marks them offline', () => {
      const devManager = new RemoteHubDeviceManager(tmpDir);
      const pair = devManager.generatePairingCode();
      const dev = devManager.pairDevice(pair.code, {
        name: 'Test Device',
        hostname: 'TEST-DEV',
        ip: '192.168.1.110',
        os: 'Windows',
        isSmaranInstalled: false,
      });

      // Set last seen to 2 minutes ago
      const stored = devManager['devices'].find((d) => d.id === dev.device!.id)!;
      stored.lastSeenAt = new Date(Date.now() - 120_000).toISOString();

      devManager.checkDeviceHealth();
      expect(devManager.getDevice(dev.device!.id)?.status).toBe('offline');

      // Heartbeat revives status to online
      devManager.recordHeartbeat(dev.deviceToken!);
      expect(devManager.getDevice(dev.device!.id)?.status).toBe('online');
    });
  });

  describe('4. RemoteHubSrtManager & OBS/vMix Compatibility', () => {
    it('allocates distinct ports starting at base port without collision', async () => {
      const srtManager = new RemoteHubSrtManager(6000, 120, '192.168.1.10');

      const srt1 = await srtManager.createOrUpdateSrt({
        streamId: 'stream-01',
        name: 'Main Display',
        mode: 'listener',
      });

      const srt2 = await srtManager.createOrUpdateSrt({
        streamId: 'stream-02',
        name: 'Chrome Window',
        mode: 'listener',
      });

      expect(srt1.port).toBe(6000);
      expect(srt2.port).toBe(6002); // Independent non-conflicting port!
      expect(srt1.port).not.toBe(srt2.port);

      // Verify connection string generation
      expect(srt1.obsSourceString).toBe('srt://192.168.1.10:6000?mode=caller&latency=120');
      expect(srt2.obsSourceString).toBe('srt://192.168.1.10:6002?mode=caller&latency=120');

      srtManager.stopAll();
    });

    it('formats Caller and Listener modes with encryption passphrase', async () => {
      const srtManager = new RemoteHubSrtManager(6000, 200, '192.168.1.10');

      const srt = await srtManager.createOrUpdateSrt({
        streamId: 'stream-secure',
        name: 'Secure Feed',
        mode: 'caller',
        latencyMs: 250,
        passphrase: 'SecretPassphrase@123',
      });

      expect(srt.mode).toBe('caller');
      expect(srt.latencyMs).toBe(250);
      expect(srt.obsSourceString).toContain('mode=listener');
      expect(srt.obsSourceString).toContain('latency=250');
      expect(srt.obsSourceString).toContain('passphrase=SecretPassphrase%40123');

      srtManager.stopAll();
    });
  });

  describe('5. RemoteHubInputControl & Remote Desktop Security', () => {
    it('rejects remote control requests from Viewers', () => {
      const logger = new RemoteHubLogger();
      const control = new RemoteHubInputControl(logger, true);

      const res = control.requestControl({
        userId: 'user-viewer',
        username: 'guest',
        userRole: 'viewer',
        targetDeviceId: 'host-local',
        isTargetSmaranInstalled: true,
      });

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Viewers do not have permission/i);
    });

    it('rejects remote control requests targeting non-Smaran participant devices', () => {
      const logger = new RemoteHubLogger();
      const control = new RemoteHubInputControl(logger, true);

      const res = control.requestControl({
        userId: 'user-op',
        username: 'operator',
        userRole: 'operator',
        targetDeviceId: 'dev-participant-1',
        isTargetSmaranInstalled: false, // Participant PC!
      });

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/strictly limited to authorized Smaran-installed host PCs/i);
    });

    it('handles interactive host approval and emergency host revocation', () => {
      const logger = new RemoteHubLogger();
      const control = new RemoteHubInputControl(logger, true);

      const req = control.requestControl({
        userId: 'user-op',
        username: 'operator',
        userRole: 'operator',
        targetDeviceId: 'host-local',
        isTargetSmaranInstalled: true,
      });

      expect(req.ok).toBe(true);
      expect(req.session?.status).toBe('requested');
      expect(control.isControlPermitted(req.session!.id)).toBe(false);

      // Host approves control
      expect(control.approveControl(req.session!.id)).toBe(true);
      expect(control.isControlPermitted(req.session!.id)).toBe(true);

      // Emergency host revocation
      expect(control.revokeControl()).toBe(true);
      expect(control.isControlPermitted(req.session!.id)).toBe(false);
      expect(control.getActiveSession()).toBeNull();
    });
  });

  describe('6. RemoteHubLogger & Secret Redaction', () => {
    it('redacts passwords, tokens, passphrases and secrets from log entries', () => {
      const input =
        'User login failed password="SuperSecretPassword!" with token="my-auth-token-123"';
      const redacted = redactSecrets(input);

      expect(redacted).not.toContain('SuperSecretPassword!');
      expect(redacted).not.toContain('my-auth-token-123');
      expect(redacted).toContain('***REDACTED***');
    });

    it('maintains circular buffer of up to 500 entries', () => {
      const logger = new RemoteHubLogger();
      for (let i = 0; i < 550; i++) {
        logger.info('server', `Log event #${i}`);
      }

      const logs = logger.getLogs();
      expect(logs.length).toBe(500);
      expect(logs[0]?.message).toBe('Log event #549');
    });
  });
});
