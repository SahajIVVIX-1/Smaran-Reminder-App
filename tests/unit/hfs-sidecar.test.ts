import { describe, expect, it } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateHfsConfigYaml } from '../../src/main/fileserver/HfsConfigBridge';
import type { FileServerSettings, UserAccount, VfsNode } from '../../src/shared/fileserver';

describe('HfsConfigBridge', () => {
  const dummySettings: FileServerSettings = {
    enabled: true,
    serverName: 'Smaran File Server',
    port: 5900,
    bindAddress: '0.0.0.0',
    rootDir: path.join(os.tmpdir(), 'smaran_files_test'),
    maxConnections: 1024,
    uploadLimitMb: 2048,
    rateLimitPerMin: 300,
    authEnabled: true,
    guestAccess: false,
    allowPublicUploads: false,
    enableRangeRequests: true,
    httpsEnabled: false,
    httpsCertPath: '',
    httpsKeyPath: '',
    maxKbpsDown: 0,
    maxKbpsUp: 0,
    maxKbpsPerIp: 0,
    maxDownloads: 0,
    upnpEnabled: false,
    ddnsUrl: '',
    ddnsIntervalMinutes: 60,
    webdavEnabled: true,
    ipFilterEnabled: false,
    ipAllowlist: [],
    ipBlocklist: [],
    bruteForceProtection: true,
  };

  const dummyUsers: UserAccount[] = [
    {
      id: 'admin-1',
      username: 'smaran',
      passwordHash: 'hash123',
      role: 'admin',
      permissions: {
        read: true,
        upload: true,
        delete: true,
        rename: true,
        mkdir: true,
        comment: true,
        vfs: true,
        zip: true,
      },
      allowedFolders: [],
      mustChangePassword: true,
      isSystem: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-2',
      username: 'alice',
      passwordHash: 'hash456',
      role: 'user',
      permissions: {
        read: true,
        upload: false,
        delete: false,
        rename: false,
        mkdir: false,
        comment: true,
        vfs: false,
        zip: false,
      },
      allowedFolders: [],
      mustChangePassword: false,
      isSystem: false,
      createdAt: new Date().toISOString(),
    },
  ];

  const dummyVfsNodes: VfsNode[] = [
    {
      id: 'vfs-1',
      name: 'SharedDocs',
      vfsPath: '/SharedDocs',
      type: 'physical_dir',
      physicalPath: path.join(os.tmpdir(), 'shared_docs'),
      permissions: {
        canRead: true,
        canSee: true,
        canUpload: true,
        canDelete: false,
        canList: true,
        canArchive: true,
      },
      allowedRoles: ['admin', 'user'],
      readOnly: false,
      hidden: false,
      createdAt: new Date().toISOString(),
    },
  ];

  it('generates valid YAML with security and branding constraints', () => {
    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
      users: dummyUsers,
      vfsNodes: dummyVfsNodes,
    });

    // Mandatory security constraints
    expect(yaml).toContain('port: 5900');
    expect(yaml).toContain('localhost_admin: false');
    expect(yaml).toContain('title: "Smaran HFS"');

    // Authentication enforcement
    expect(yaml).toContain('can_see: "*"');
    expect(yaml).toContain('can_read: "*"');
    expect(yaml).toContain('can_list: "*"');

    // Admin account constraints
    expect(yaml).toContain('"smaran":');
    expect(yaml).toContain('admin: true');
    expect(yaml).toContain('password: "smaran@123"');
    expect(yaml).toContain('require_password_change: true');
    expect(yaml).toContain('disable_password_change: false');

    // User permissions
    expect(yaml).toContain('"alice":');

    // VFS Children mappings
    expect(yaml).toContain('"SharedDocs"');
  });

  it('preserves existing SRP verifiers without overriding with plain password', () => {
    const existingSrp = '1234567890|9876543210';
    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
      users: dummyUsers,
      vfsNodes: [],
      existingSrpMap: { smaran: existingSrp },
    });

    expect(yaml).toContain(`srp: "${existingSrp}"`);
    expect(yaml).not.toContain('password: "smaran@123"');
  });

  it('supports custom admin password and credentials', () => {
    const yaml = generateHfsConfigYaml({
      settings: dummySettings,
      users: dummyUsers,
      vfsNodes: [],
      adminPassword: 'CustomAdminPassword!42',
    });

    expect(yaml).toContain('password: "CustomAdminPassword!42"');
  });
});
