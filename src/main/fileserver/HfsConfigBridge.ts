import * as path from 'node:path';
import type { FileServerSettings, UserAccount, VfsNode } from '@shared/fileserver';

function escapeYamlString(val: string): string {
  // Use JSON stringification to ensure Windows backslashes and special characters are safely escaped
  return JSON.stringify(val);
}

export function generateHfsConfigYaml(params: {
  settings: FileServerSettings;
  users: UserAccount[];
  vfsNodes: VfsNode[];
  existingSrpMap?: Record<string, string>;
  adminPassword?: string;
}): string {
    const { settings, users, vfsNodes, existingSrpMap = {}, adminPassword } = params;
    const lines: string[] = [];

    lines.push(`# Smaran HFS Auto-Generated Configuration`);
    lines.push(`port: ${settings.port}`);
    lines.push(`localhost_admin: false`);
    lines.push(`title: "Smaran HFS"`);
    lines.push(`open_browser_at_start: false`);

    if (settings.maxConnections) {
      lines.push(`max_connections: ${settings.maxConnections}`);
    }
    if (settings.rateLimitPerMin) {
      // HFS rate limits in kbps
      // lines.push(`max_kbps: ...`);
    }

    // Accounts section
    lines.push(`accounts:`);
    for (const u of users) {
      lines.push(`  ${escapeYamlString(u.username)}:`);
      if (u.role === 'admin') {
        lines.push(`    admin: true`);
      }
      const existingSrp = existingSrpMap[u.username];
      if (existingSrp) {
        lines.push(`    srp: ${escapeYamlString(existingSrp)}`);
      } else if (u.role === 'admin' && !existingSrp) {
        const pass = adminPassword || settings.adminPassword || 'smaran@123';
        lines.push(`    password: ${escapeYamlString(pass)}`);
      }

      if (u.mustChangePassword) {
        lines.push(`    require_password_change: true`);
      }
      if (u.isSystem) {
        // System admin can change password, but username cannot be deleted
        lines.push(`    disable_password_change: false`);
      }
    }

    // Root VFS
    lines.push(`vfs:`);
    const resolvedRoot = path.resolve(settings.rootDir);
    lines.push(`  source: ${escapeYamlString(resolvedRoot)}`);

    // Authentication and permissions
    if (settings.authEnabled && !settings.guestAccess) {
      lines.push(`  can_see: "*"`);
      lines.push(`  can_read: "*"`);
      lines.push(`  can_list: "*"`);
    } else {
      lines.push(`  can_see: true`);
      lines.push(`  can_read: true`);
      lines.push(`  can_list: true`);
    }

    // Upload permissions
    if (settings.allowPublicUploads) {
      lines.push(`  can_upload: true`);
    } else {
      lines.push(`  can_upload:`);
      lines.push(`    - admins`);
      for (const u of users) {
        if (u.permissions.upload) {
          lines.push(`    - ${escapeYamlString(u.username)}`);
        }
      }
    }

    // Delete permissions
    lines.push(`  can_delete:`);
    lines.push(`    - admins`);
    for (const u of users) {
      if (u.permissions.delete) {
        lines.push(`    - ${escapeYamlString(u.username)}`);
      }
    }

    // Children VFS nodes (custom mappings)
    if (vfsNodes && vfsNodes.length > 0) {
      lines.push(`  children:`);
      for (const node of vfsNodes) {
        lines.push(`    - name: ${escapeYamlString(node.name)}`);
        if (node.type === 'link' && node.linkUrl) {
          lines.push(`      url: ${escapeYamlString(node.linkUrl)}`);
        } else if (node.physicalPath) {
          lines.push(`      source: ${escapeYamlString(path.resolve(node.physicalPath))}`);
        }
        if (node.permissions) {
          lines.push(`      can_read: ${node.permissions.canRead ? 'true' : 'false'}`);
          lines.push(`      can_see: ${node.permissions.canSee ? 'true' : 'false'}`);
          lines.push(`      can_list: ${node.permissions.canList ? 'true' : 'false'}`);
          lines.push(`      can_upload: ${node.permissions.canUpload ? 'true' : 'false'}`);
          lines.push(`      can_delete: ${node.permissions.canDelete ? 'true' : 'false'}`);
          lines.push(`      can_archive: ${node.permissions.canArchive ? 'true' : 'false'}`);
        }
      }
    }

    return lines.join('\n') + '\n';
  }
