import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { UserAccount } from '@shared/fileserver';
import type { VfsManager } from './vfs/VfsManager';
import { lookupMime } from './mime';
import { resolveSafePath } from './security';

export class WebDavHandler {
  private locks = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly vfs: VfsManager,
    private readonly rootDir: string,
  ) {}

  isWebDavRequest(req: http.IncomingMessage): boolean {
    const method = req.method || '';
    return [
      'PROPFIND',
      'PROPPATCH',
      'MKCOL',
      'COPY',
      'MOVE',
      'LOCK',
      'UNLOCK',
    ].includes(method);
  }

  async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    _clientIp: string,
    user?: UserAccount | null,
  ): Promise<boolean> {
    const method = req.method || 'GET';
    const rawUrl = req.url || '/';
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // Apply standard WebDAV headers
    res.setHeader('DAV', '1,2');
    res.setHeader('MS-Author-Via', 'DAV');
    res.setHeader(
      'Allow',
      'OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK',
    );

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return true;
    }

    if (method === 'PROPFIND') {
      if (user && !user.permissions.read) {
        res.writeHead(403);
        res.end('Permission denied: read access required');
        return true;
      }
      await this.handlePropfind(pathname, req, res);
      return true;
    }

    if (method === 'MKCOL') {
      if (user && !user.permissions.mkdir) {
        res.writeHead(403);
        res.end('Permission denied: folder creation required');
        return true;
      }
      await this.handleMkcol(pathname, req, res);
      return true;
    }

    if (method === 'DELETE') {
      if (user && !user.permissions.delete) {
        res.writeHead(403);
        res.end('Permission denied: delete access required');
        return true;
      }
      await this.handleDelete(pathname, req, res);
      return true;
    }

    if (method === 'MOVE') {
      if (user && !user.permissions.rename) {
        res.writeHead(403);
        res.end('Permission denied: rename access required');
        return true;
      }
      await this.handleMove(pathname, req, res);
      return true;
    }

    if (method === 'COPY') {
      if (user && !user.permissions.upload) {
        res.writeHead(403);
        res.end('Permission denied: upload access required');
        return true;
      }
      await this.handleCopy(pathname, req, res);
      return true;
    }

    if (method === 'LOCK') {
      await this.handleLock(pathname, req, res);
      return true;
    }

    if (method === 'UNLOCK') {
      await this.handleUnlock(pathname, req, res);
      return true;
    }

    if (method === 'PUT') {
      if (user && !user.permissions.upload) {
        res.writeHead(403);
        res.end('Permission denied: upload access required');
        return true;
      }
      await this.handlePut(pathname, req, res);
      return true;
    }

    return false;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async handlePropfind(
    vfsPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const depthHeader = (req.headers['depth'] as string) || '1';
    const depth = depthHeader === '0' ? 0 : 1;

    const target = this.vfs.resolvePath(vfsPath);
    if (!target) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Resource not found');
      return;
    }

    const xmlParts: string[] = [
      '<?xml version="1.0" encoding="utf-8" ?>',
      '<D:multistatus xmlns:D="DAV:">',
    ];

    const formatEntry = (
      href: string,
      displayName: string,
      isDir: boolean,
      size: number,
      mtime: Date,
      ctime: Date,
      mimeType: string,
    ) => {
      const cleanHref = href.startsWith('/') ? href : '/' + href;
      const formattedHref = isDir && !cleanHref.endsWith('/') ? cleanHref + '/' : cleanHref;

      return `  <D:response>
    <D:href>${this.escapeXml(formattedHref)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${this.escapeXml(displayName)}</D:displayname>
        ${
          isDir
            ? '<D:resourcetype><D:collection/></D:resourcetype>'
            : `<D:resourcetype/><D:getcontentlength>${size}</D:getcontentlength><D:getcontenttype>${mimeType}</D:getcontenttype>`
        }
        <D:getlastmodified>${mtime.toUTCString()}</D:getlastmodified>
        <D:creationdate>${ctime.toISOString()}</D:creationdate>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
    };

    // 1. Entry for the requested resource itself
    if (target.physicalPath && fs.existsSync(target.physicalPath)) {
      const stat = fs.statSync(target.physicalPath);
      const isDir = stat.isDirectory();
      xmlParts.push(
        formatEntry(
          vfsPath,
          path.basename(target.physicalPath) || 'Root',
          isDir,
          stat.size,
          stat.mtime,
          stat.birthtime || stat.ctime,
          lookupMime(target.physicalPath),
        ),
      );

      // 2. If directory and depth >= 1, list children
      if (isDir && depth >= 1) {
        try {
          const entries = fs.readdirSync(target.physicalPath, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.name.startsWith('.') || ent.name.toLowerCase() === 'descript.ion') {
              continue;
            }
            const childPhysical = path.join(target.physicalPath, ent.name);
            try {
              const childStat = fs.statSync(childPhysical);
              const childHref = path.posix.join(vfsPath, ent.name);
              xmlParts.push(
                formatEntry(
                  childHref,
                  ent.name,
                  ent.isDirectory(),
                  childStat.size,
                  childStat.mtime,
                  childStat.birthtime || childStat.ctime,
                  lookupMime(ent.name),
                ),
              );
            } catch {
              // Ignore file stat errors
            }
          }
        } catch {
          // Directory read error
        }
      }
    } else {
      // Virtual directory entry
      xmlParts.push(
        formatEntry(
          vfsPath,
          path.posix.basename(vfsPath) || 'Root',
          true,
          0,
          new Date(),
          new Date(),
          'inode/directory',
        ),
      );
    }

    xmlParts.push('</D:multistatus>');

    res.writeHead(207, {
      'Content-Type': 'application/xml; charset=utf-8',
    });
    res.end(xmlParts.join('\n'));
  }

  private async handleMkcol(
    vfsPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const target = this.vfs.resolvePath(vfsPath);
    let physicalTarget = target?.physicalPath;

    if (!physicalTarget) {
      const safe = resolveSafePath(this.rootDir, vfsPath.replace(/^\/+/, ''));
      if (!safe) {
        res.writeHead(403);
        res.end();
        return;
      }
      physicalTarget = safe;
    }

    try {
      if (fs.existsSync(physicalTarget)) {
        res.writeHead(405); // Method not allowed (already exists)
        res.end();
        return;
      }
      fs.mkdirSync(physicalTarget, { recursive: true });
      res.writeHead(201);
      res.end();
    } catch {
      res.writeHead(500);
      res.end();
    }
  }

  private async handleDelete(
    vfsPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const target = this.vfs.resolvePath(vfsPath);
    if (!target || !target.physicalPath || !fs.existsSync(target.physicalPath)) {
      res.writeHead(404);
      res.end();
      return;
    }

    try {
      fs.rmSync(target.physicalPath, { recursive: true, force: true });
      res.writeHead(204);
      res.end();
    } catch {
      res.writeHead(500);
      res.end();
    }
  }

  private async handleMove(
    vfsPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const destHeader = req.headers['destination'] as string;
    if (!destHeader) {
      res.writeHead(400);
      res.end();
      return;
    }

    const destParsed = new URL(destHeader, 'http://localhost');
    const destPath = decodeURIComponent(destParsed.pathname);

    const sourceTarget = this.vfs.resolvePath(vfsPath);
    if (!sourceTarget?.physicalPath || !fs.existsSync(sourceTarget.physicalPath)) {
      res.writeHead(404);
      res.end();
      return;
    }

    let destPhysical = this.vfs.resolvePath(destPath)?.physicalPath;
    if (!destPhysical) {
      const safe = resolveSafePath(this.rootDir, destPath.replace(/^\/+/, ''));
      if (safe) destPhysical = safe;
    }

    if (!destPhysical) {
      res.writeHead(403);
      res.end();
      return;
    }

    try {
      const parentDir = path.dirname(destPhysical);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.renameSync(sourceTarget.physicalPath, destPhysical);
      res.writeHead(201);
      res.end();
    } catch {
      res.writeHead(500);
      res.end();
    }
  }

  private async handleCopy(
    vfsPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const destHeader = req.headers['destination'] as string;
    if (!destHeader) {
      res.writeHead(400);
      res.end();
      return;
    }

    const destParsed = new URL(destHeader, 'http://localhost');
    const destPath = decodeURIComponent(destParsed.pathname);

    const sourceTarget = this.vfs.resolvePath(vfsPath);
    if (!sourceTarget?.physicalPath || !fs.existsSync(sourceTarget.physicalPath)) {
      res.writeHead(404);
      res.end();
      return;
    }

    let destPhysical = this.vfs.resolvePath(destPath)?.physicalPath;
    if (!destPhysical) {
      const safe = resolveSafePath(this.rootDir, destPath.replace(/^\/+/, ''));
      if (safe) destPhysical = safe;
    }

    if (!destPhysical) {
      res.writeHead(403);
      res.end();
      return;
    }

    try {
      fs.cpSync(sourceTarget.physicalPath, destPhysical, { recursive: true });
      res.writeHead(201);
      res.end();
    } catch {
      res.writeHead(500);
      res.end();
    }
  }

  private async handleLock(
    vfsPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const lockToken = 'urn:uuid:' + randomUUID();
    const timeout = 3600;
    this.locks.set(vfsPath, { token: lockToken, expiresAt: Date.now() + timeout * 1000 });

    res.setHeader('Lock-Token', `<${lockToken}>`);
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });

    res.end(`<?xml version="1.0" encoding="utf-8" ?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:owner><D:href>smaran-hfs</D:href></D:owner>
      <D:timeout>Second-${timeout}</D:timeout>
      <D:locktoken><D:href>${lockToken}</D:href></D:locktoken>
      <D:lockroot><D:href>${this.escapeXml(vfsPath)}</D:href></D:lockroot>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`);
  }

  private async handleUnlock(
    vfsPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    this.locks.delete(vfsPath);
    res.writeHead(204);
    res.end();
  }

  private async handlePut(
    vfsPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const target = this.vfs.resolvePath(vfsPath);
    let physicalTarget = target?.physicalPath;

    if (!physicalTarget) {
      const safe = resolveSafePath(this.rootDir, vfsPath.replace(/^\/+/, ''));
      if (!safe) {
        res.writeHead(403);
        res.end();
        return;
      }
      physicalTarget = safe;
    }

    try {
      const parentDir = path.dirname(physicalTarget);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const fileStream = fs.createWriteStream(physicalTarget);
      req.pipe(fileStream);

      fileStream.on('finish', () => {
        res.writeHead(201);
        res.end();
      });

      fileStream.on('error', () => {
        res.writeHead(500);
        res.end();
      });
    } catch {
      res.writeHead(500);
      res.end();
    }
  }
}
