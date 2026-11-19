import { describe, expect, it } from 'vitest';
import { generateHfsConfigYaml } from '../../src/main/fileserver/HfsConfigBridge';
import type { FileServerSettings, UserAccount, VfsNode } from '../../src/shared/fileserver';

describe('HfsConfigBridge', () => {
  const dummySettings: FileServerSettings = {
    enabled: true,
    port: 8080,
    rootDir: 'C:\\Test\\Files',
    autoStart: true,
    adminUsername: 'admin',
    adminPassword: 'secretpassword123',
  };

  it('generates zero-trust config.yaml enforcing localhost_admin: false', () => {
    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
      internalToken: 'test-token-1234',
    });

    expect(yaml).toContain('localhost_admin: false');
    expect(yaml).toContain('port: 8080');
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
});
