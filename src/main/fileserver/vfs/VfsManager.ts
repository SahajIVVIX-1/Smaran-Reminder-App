import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  DirectoryListing,
  FileItem,
  UserAccount,
  VfsNode,
  VfsPermissions,
} from '@shared/fileserver';
import type { FileServerStore } from '../FileServerStore';
import { lookupMime } from '../mime';
import { resolveSafePath } from '../security';

export interface VfsResolvedTarget {
  type: 'physical_dir' | 'physical_file' | 'virtual_dir' | 'link';
  physicalPath?: string;
  linkUrl?: string;
  node?: VfsNode;
  relativeSubPath: string;
  permissions: VfsPermissions;
}

export class VfsManager {
  constructor(private readonly store: FileServerStore) {}

  /**
   * Normalizes a VFS path: always starts with '/', uses '/', no trailing slash except root
   */
  normalizeVfsPath(p: string): string {
    let clean = p.replace(/\\/g, '/').trim();
    if (!clean.startsWith('/')) clean = '/' + clean;
    // Remove duplicate slashes
    clean = clean.replace(/\/+/g, '/');
    if (clean.length > 1 && clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  }

  /**
   * Resolves a VFS path to its underlying physical target, virtual directory, or link
   */
  resolvePath(vfsPath: string, user?: UserAccount | null): VfsResolvedTarget | null {
    const normalized = this.normalizeVfsPath(vfsPath);
    const nodes = this.store.getVfsNodes();
    const settings = this.store.getSettings();

    // 1. Check for exact or longest-prefix match among custom VFS nodes
    let bestMatch: VfsNode | null = null;
    let bestPrefix = '';

    for (const node of nodes) {
      const nodePath = this.normalizeVfsPath(node.vfsPath);
      if (normalized === nodePath) {
        bestMatch = node;
        bestPrefix = nodePath;
        break;
      }
      if (normalized.startsWith(nodePath + '/')) {
        if (nodePath.length > bestPrefix.length) {
          bestMatch = node;
          bestPrefix = nodePath;
        }
      }
    }

    if (bestMatch) {
      // Check role permissions if restricted
      if (bestMatch.allowedRoles && bestMatch.allowedRoles.length > 0) {
        if (!user || !bestMatch.allowedRoles.includes(user.role)) {
          return null; // Access restricted
        }
      }

      const permissions: VfsPermissions = {
        canRead: bestMatch.permissions?.canRead ?? !bestMatch.readOnly,
        canSee: bestMatch.permissions?.canSee ?? !bestMatch.hidden,
        canUpload: bestMatch.permissions?.canUpload ?? !bestMatch.readOnly,
        canDelete: bestMatch.permissions?.canDelete ?? !bestMatch.readOnly,
        canList: bestMatch.permissions?.canList ?? true,
        canArchive: bestMatch.permissions?.canArchive ?? true,
      };

      if (bestMatch.type === 'link') {
        return {
          type: 'link',
          linkUrl: bestMatch.linkUrl || '',
          node: bestMatch,
          relativeSubPath: '',
          permissions,
        };
      }

      if (bestMatch.type === 'virtual_dir') {
        const sub = normalized.slice(bestPrefix.length).replace(/^\/+/, '');
        return {
          type: 'virtual_dir',
          node: bestMatch,
          relativeSubPath: sub,
          permissions,
        };
      }

      if (bestMatch.type === 'physical_file' && bestMatch.physicalPath) {
        if (!fs.existsSync(bestMatch.physicalPath)) return null;
        return {
          type: 'physical_file',
          physicalPath: bestMatch.physicalPath,
          node: bestMatch,
          relativeSubPath: '',
          permissions,
        };
      }

      if (bestMatch.type === 'physical_dir' && bestMatch.physicalPath) {
        const sub = normalized.slice(bestPrefix.length).replace(/^\/+/, '');
        const targetPhysical = sub
          ? resolveSafePath(bestMatch.physicalPath, sub)
          : bestMatch.physicalPath;

        if (!targetPhysical || !fs.existsSync(targetPhysical)) {
          return null;
        }

        const stat = fs.statSync(targetPhysical);
        return {
          type: stat.isDirectory() ? 'physical_dir' : 'physical_file',
          physicalPath: targetPhysical,
          node: bestMatch,
          relativeSubPath: sub,
          permissions,
        };
      }
    }

    // 2. Default root mount at '/'
    const rootDir = settings.rootDir;
    const sub = normalized.replace(/^\/+/, '');
    const safeTarget = sub ? resolveSafePath(rootDir, sub) : rootDir;

    if (!safeTarget || !fs.existsSync(safeTarget)) {
      return null;
    }

    const stat = fs.statSync(safeTarget);
    return {
      type: stat.isDirectory() ? 'physical_dir' : 'physical_file',
      physicalPath: safeTarget,
      relativeSubPath: sub,
      permissions: {
        canRead: true,
        canSee: true,
        canUpload: true,
        canDelete: true,
        canList: true,
        canArchive: true,
      },
    };
  }

  /**
   * Lists directory contents, merging physical entries with any virtual child nodes
   */
  listDirectory(vfsPath: string, user?: UserAccount | null): DirectoryListing | null {
    const target = this.resolvePath(vfsPath, user);
    if (!target) return null;
    if (target.type === 'physical_file' || target.type === 'link') return null;
    if (!target.permissions.canList) return null;

    const normalizedPath = this.normalizeVfsPath(vfsPath);
    const items: FileItem[] = [];

    // 1. Collect any child VFS nodes mounted directly under this path
    const vfsNodes = this.store.getVfsNodes();
    for (const node of vfsNodes) {
      if (node.hidden) continue;
      if (node.allowedRoles && node.allowedRoles.length > 0) {
        if (!user || !node.allowedRoles.includes(user.role)) continue;
      }

      const nodeParent = this.normalizeVfsPath(path.posix.dirname(node.vfsPath));
      if (nodeParent === normalizedPath) {
        const nodeName = path.posix.basename(node.vfsPath);
        items.push({
          name: nodeName,
          relativePath: node.vfsPath.replace(/^\/+/, ''),
          isDirectory: node.type !== 'physical_file' && node.type !== 'link',
          size: 0,
          modifiedAt: node.createdAt,
          mimeType: node.type === 'link' ? 'application/x-url' : 'inode/directory',
          extension: node.type === 'link' ? 'url' : '',
          comment: node.comment,
          isVirtual: true,
        });
      }
    }

    // 2. Collect physical items if backed by a physical directory
    if (target.physicalPath && fs.existsSync(target.physicalPath)) {
      try {
        const comments = this.store.getCommentsForDir(target.physicalPath);
        const entries = fs.readdirSync(target.physicalPath, { withFileTypes: true });

        for (const entry of entries) {
          // Skip hidden system files and descript.ion itself from standard listing
          if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'descript.ion') {
            continue;
          }

          const entryPhysical = path.join(target.physicalPath, entry.name);
          try {
            const stat = fs.statSync(entryPhysical);
            const ext = entry.isDirectory()
              ? ''
              : path.extname(entry.name).slice(1).toLowerCase();
            const relVfs = normalizedPath === '/'
              ? entry.name
              : `${normalizedPath.slice(1)}/${entry.name}`;

            items.push({
              name: entry.name,
              relativePath: relVfs,
              isDirectory: entry.isDirectory(),
              size: stat.size,
              modifiedAt: stat.mtime.toISOString(),
              mimeType: entry.isDirectory() ? 'inode/directory' : lookupMime(entry.name),
              extension: ext,
              comment: comments[entry.name],
              isVirtual: false,
            });
          } catch {
            // Ignore unreadable entries
          }
        }
      } catch (err) {
        console.error('Failed to read physical directory in VFS:', err);
      }
    }

    // Sort: directories first, then alphabetical
    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });

    // Build breadcrumbs
    const breadcrumbs = [{ name: 'Root', path: '' }];
    if (normalizedPath !== '/') {
      const parts = normalizedPath.split('/').filter(Boolean);
      let acc = '';
      for (const part of parts) {
        acc += (acc ? '/' : '') + part;
        breadcrumbs.push({ name: part, path: acc });
      }
    }

    const totalFolders = items.filter((i) => i.isDirectory).length;
    const totalFiles = items.filter((i) => !i.isDirectory).length;
    const totalSize = items.reduce((acc, i) => acc + (i.isDirectory ? 0 : i.size), 0);

    return {
      currentPath: normalizedPath === '/' ? '' : normalizedPath.slice(1),
      breadcrumbs,
      items,
      totalFiles,
      totalFolders,
      totalSize,
      writable: target.permissions.canUpload,
    };
  }
}
