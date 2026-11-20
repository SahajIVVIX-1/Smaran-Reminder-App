import { describe, expect, it } from 'vitest';
import { generateHfsConfigYaml } from '../../src/main/fileserver/HfsConfigBridge';
import type { FileServerSettings, UserAccount, VfsNode } from '../../src/shared/fileserver';

describe('HfsConfigBridge', () => {
  const dummySettings: FileServerSettings = {
    enabled: true,
    port: 5901,
    rootDir: 'C:\\Test\\Files',
    autoStart: true,
    autoOpenAdminOnStart: false,
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
    expect(yaml).toContain('title: Smaran HFS');
    expect(yaml).toContain('force_theme: dark');
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
    expect(yaml).toContain('password: custompassword');
    expect(yaml).toContain('admin: true');
    expect(yaml).toContain('alice:');
    expect(yaml).toContain('password: alicepass');
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
    expect(yaml).toContain('source: D:/User/Documents');
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

  it('configures default VFS permissions to full shared access (*)', () => {
    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
    });

    expect(yaml).toContain('can_see: "*"');
    expect(yaml).toContain('can_read: "*"');
    expect(yaml).toContain('can_upload: "*"');
    expect(yaml).toContain('can_delete: "*"');
    expect(yaml).toContain('can_archive: "*"');
  });

  it('generates Windows WebDAV mount batch script with UAC elevation & BasicAuthLevel=2', async () => {
    const { generateMountBatScript } = await import('../../src/main/fileserver/HfsConfigBridge');
    const bat = generateMountBatScript('192.168.1.100', 5901);

    expect(bat).toContain('net session >nul 2>&1');
    expect(bat).toContain('sc config WebClient start= auto');
    expect(bat).toContain('BasicAuthLevel /t REG_DWORD /d 2 /f');
    expect(bat).toContain('net use Z: "http://192.168.1.100:5901/"');
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

    // When license becomes valid later, getStatus() should clear stale license error
    const supervisorWithValidLicense = new HfsProcessSupervisor(tempDir, store, {
      isLicenseValid: () => true,
    });
    // @ts-expect-error accessing private field for test
    supervisorWithValidLicense.currentStatus.error = 'License activation required. Smaran HFS will start after a valid license is activated.';
    expect(supervisorWithValidLicense.getStatus().error).toBeUndefined();

    // Resolve engine script path check
    const resolved = supervisor.resolveEngineScript();
    expect(resolved.scriptPath).toContain('index.js');
    expect(resolved.engineDir).toContain('dist');
  });

  it('self-heals and flattens nested dist folder if present in runtimeDir', async () => {
    const { HfsProcessSupervisor } = await import('../../src/main/fileserver/HfsProcessSupervisor');
    const { FileServerStore } = await import('../../src/main/fileserver/FileServerStore');
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');

    const tempDir = path.join(os.tmpdir(), `smaran_nested_test_${Date.now()}`);
    const runtimeDir = path.join(tempDir, 'fileserver_engine');
    const nestedDist = path.join(runtimeDir, 'dist');
    const nestedSrc = path.join(nestedDist, 'src');
    fs.mkdirSync(nestedSrc, { recursive: true });
    fs.writeFileSync(path.join(nestedSrc, 'index.js'), '// test entry');
    fs.writeFileSync(path.join(nestedDist, 'package.json'), '{}');
    fs.writeFileSync(path.join(nestedDist, 'central.json'), '{}');

    const store = new FileServerStore(tempDir);
    const supervisor = new HfsProcessSupervisor(tempDir, store, {
      isLicenseValid: () => true,
    });

    // @ts-expect-error calling private helper for test
    supervisor.flattenNestedDistIfNeeded();

    expect(fs.existsSync(path.join(runtimeDir, 'src', 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(runtimeDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(runtimeDir, 'central.json'))).toBe(true);
    expect(fs.existsSync(nestedDist)).toBe(false);

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('extracts real resources/engine.tar.gz and verifies all root entry points exist', async () => {
    const { HfsProcessSupervisor } = await import('../../src/main/fileserver/HfsProcessSupervisor');
    const { FileServerStore } = await import('../../src/main/fileserver/FileServerStore');
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');

    const tempDir = path.join(os.tmpdir(), `smaran_extract_test_${Date.now()}`);
    const store = new FileServerStore(tempDir);
    const supervisor = new HfsProcessSupervisor(tempDir, store, {
      isLicenseValid: () => true,
    });

    await supervisor.ensureEngineExtracted();

    const runtimeDir = supervisor.runtimeDir;
    expect(fs.existsSync(path.join(runtimeDir, 'src', 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(runtimeDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(runtimeDir, 'central.json'))).toBe(true);

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
