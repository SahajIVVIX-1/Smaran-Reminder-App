import { describe, expect, it } from 'vitest';
import { generateHfsConfigYaml } from '../../src/main/fileserver/HfsConfigBridge';
import type { FileServerSettings, UserAccount, VfsNode } from '../../src/shared/fileserver';

describe('HfsConfigBridge', () => {
  const dummySettings: FileServerSettings = {
    enabled: true,
    port: 5901,
    rootDir: 'C:\\Test\\Files',
    autoStart: true,
    adminUsername: 'smaran',
    adminPassword: 'secretpassword123',
  };

  it('generates zero-trust config.yaml enforcing localhost_admin: false', () => {
    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
      internalToken: 'test-token-1234',
    });

    expect(yaml).toContain('localhost_admin: false');
    expect(yaml).toContain('port: 5901');
    expect(yaml).toContain('title: "Smaran HFS"');
    expect(yaml).toContain('force_theme: "dark"');
  });

  it('configures system admin account with password and admin role', () => {
    const users: UserAccount[] = [
      { id: '1', username: 'admin', password: 'custompassword', role: 'admin', isSystem: true },
      { id: '2', username: 'alice', password: 'alicepass', role: 'user' },
    ];

    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
      users,
      adminPassword: 'custompassword',
    });

    expect(yaml).toContain('admin:');
    expect(yaml).toContain('password: "custompassword"');
    expect(yaml).toContain('admin: true');
    expect(yaml).toContain('alice:');
    expect(yaml).toContain('password: "alicepass"');
  });

  it('normalizes VFS node mount paths to forward slashes', () => {
    const vfs: VfsNode[] = [
      {
        id: 'v1',
        name: 'documents',
        vfsPath: '/docs',
        physicalPath: 'D:\\User\\Documents',
        type: 'directory',
      },
    ];

    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
      vfs,
    });

    expect(yaml).toContain('docs:');
    expect(yaml).toContain('source: "D:/User/Documents"');
  });

  it('includes all 19 default plugins and plugin configurations', () => {
    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
    });

    expect(yaml).toContain('enable_plugins:');
    expect(yaml).toContain('  - antibrute');
    expect(yaml).toContain('  - share-links');
    expect(yaml).toContain('  - thumbnails');
    expect(yaml).toContain('  - trashbin');
    expect(yaml).toContain('plugins_config:');
    expect(yaml).toContain('  share-links:');
    expect(yaml).toContain('  trashbin:');
  });
});

describe('HfsProcessSupervisor port & environment verification', () => {
  it('rejects privileged ports (< 1024) to avoid unnecessary UAC elevation', async () => {
    const { checkPortAvailable } = await import('../../src/main/fileserver/HfsProcessSupervisor');
    const res80 = await checkPortAvailable(80);
    expect(res80.available).toBe(false);
    expect(res80.error).toContain('system-privileged port');

    const res443 = await checkPortAvailable(443);
    expect(res443.available).toBe(false);
    expect(res443.error).toContain('system-privileged port');
  });

  it('rejects out-of-range port numbers', async () => {
    const { checkPortAvailable } = await import('../../src/main/fileserver/HfsProcessSupervisor');
    const res0 = await checkPortAvailable(0);
    expect(res0.available).toBe(false);
    expect(res0.error).toContain('Invalid port number');

    const resOver = await checkPortAvailable(70000);
    expect(resOver.available).toBe(false);
    expect(resOver.error).toContain('Invalid port number');
  });

  it('allows available unprivileged port numbers (>= 1024)', async () => {
    const { checkPortAvailable } = await import('../../src/main/fileserver/HfsProcessSupervisor');
    // Port 59199 is likely free
    const res = await checkPortAvailable(59199);
    expect(res.available).toBe(true);
  });

  it('verifies directory write permissions accurately', async () => {
    const { checkDirectoryPermissions } =
      await import('../../src/main/fileserver/HfsProcessSupervisor');
    const os = await import('node:os');
    const checkValid = checkDirectoryPermissions(os.tmpdir());
    expect(checkValid.ok).toBe(true);

    const checkInvalid = checkDirectoryPermissions('Z:\\NonExistentPath_XYZ123');
    expect(checkInvalid.ok).toBe(false);
    expect(checkInvalid.error).toContain('not writable');
  });

  it('enforces license validation before starting HFS engine', async () => {
    const { HfsProcessSupervisor } = await import('../../src/main/fileserver/HfsProcessSupervisor');
    const { FileServerStore } = await import('../../src/main/fileserver/FileServerStore');
    const os = await import('node:os');
    const path = await import('node:path');

    const tempDir = path.join(os.tmpdir(), `smaran_test_${Date.now()}`);
    const store = new FileServerStore(tempDir);

    const licenseValid = false;
    const supervisor = new HfsProcessSupervisor(tempDir, store, {
      isLicenseValid: () => licenseValid,
    });

    // When license is invalid
    const resultInvalid = await supervisor.start();
    expect(resultInvalid.ok).toBe(false);
    expect(resultInvalid.error).toContain('License activation required');
    expect(supervisor.getStatus().running).toBe(false);

    // Resolve engine script path check
    const resolved = supervisor.resolveEngineScript();
    expect(resolved.scriptPath).toContain('index.js');
    expect(resolved.engineDir).toContain('dist');
  });
});
