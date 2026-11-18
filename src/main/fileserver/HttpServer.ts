import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import type { Socket } from 'node:net';
import type {
  ActiveTransfer,
  DirectoryListing,
  FileItem,
  ServerLogEntry,
  ServerStatus,
  TransferHistoryEntry,
} from '@shared/fileserver';
import type { FileServerStore } from './FileServerStore';
import { lookupMime } from './mime';
import { buildServerUrls, getLanIps } from './network';
import { resolveSafePath, verifyPassword } from './security';
import { getWebManagerHtml } from './webUi';

export interface HttpServerEvents {
  onStatusChanged?: (status: ServerStatus) => void;
  onTransfersUpdated?: (transfers: ActiveTransfer[]) => void;
  onLogAdded?: (log: ServerLogEntry) => void;
}

export class HttpServer {
  private server: http.Server | https.Server | null = null;
  private startedAt: number | null = null;
  private activeConnections = new Set<Socket>();
  private activeTransfers = new Map<string, ActiveTransfer>();
  private totalBytesUploaded = 0;
  private totalBytesDownloaded = 0;
  private currentUploadSpeedBps = 0;
  private currentDownloadSpeedBps = 0;
  private lastUploadBytes = 0;
  private lastDownloadBytes = 0;
  private speedTimer: ReturnType<typeof setInterval> | null = null;
  private rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly store: FileServerStore,
    private readonly events: HttpServerEvents = {},
  ) {}

  get isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    if (this.isRunning) return { ok: true };

    const settings = this.store.getSettings();
    this.store.ensureRootDir();

    return new Promise((resolve) => {
      try {
        const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
          this.handleRequest(req, res).catch((err) => {
            console.error('Request handling error:', err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          });
        };

        if (settings.httpsEnabled && settings.httpsCertPath && settings.httpsKeyPath) {
          const options = {
            cert: fs.readFileSync(settings.httpsCertPath),
            key: fs.readFileSync(settings.httpsKeyPath),
          };
          this.server = https.createServer(options, requestHandler);
        } else {
          this.server = http.createServer(requestHandler);
        }

        this.server.on('connection', (socket: Socket) => {
          this.activeConnections.add(socket);
          socket.on('close', () => this.activeConnections.delete(socket));
        });

        this.server.on('error', (err: Error) => {
          console.error('File server error:', err);
          this.log('error', `Server error: ${err.message}`);
          this.stop();
          resolve({ ok: false, error: err.message });
        });

        const bindHost = settings.bindAddress || '0.0.0.0';
        this.server.listen(settings.port, bindHost, () => {
          this.startedAt = Date.now();
          this.startSpeedMonitor();
          this.log('info', `Server started on ${bindHost}:${settings.port}`);
          this.events.onStatusChanged?.(this.getStatus());
          resolve({ ok: true });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log('error', `Failed to start server: ${msg}`);
        resolve({ ok: false, error: msg });
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.speedTimer) {
        clearInterval(this.speedTimer);
        this.speedTimer = null;
      }

      // Terminate any active connections
      for (const socket of this.activeConnections) {
        socket.destroy();
      }
      this.activeConnections.clear();
      this.activeTransfers.clear();

      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.startedAt = null;
          this.log('info', 'Server stopped');
          this.events.onStatusChanged?.(this.getStatus());
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    await this.stop();
    return this.start();
  }

  getStatus(): ServerStatus {
    const settings = this.store.getSettings();
    const lanIps = getLanIps();
    const { localUrl, lanUrls } = buildServerUrls(settings.port, lanIps, settings.httpsEnabled);
    const uptime = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;

    return {
      running: this.isRunning,
      port: settings.port,
      bindAddress: settings.bindAddress,
      serverName: settings.serverName,
      rootDir: settings.rootDir,
      uptimeSeconds: uptime,
      lanIps,
      localUrl,
      lanUrls,
      connectedClients: this.activeConnections.size,
      activeTransfers: Array.from(this.activeTransfers.values()),
      totalBytesUploaded: this.totalBytesUploaded,
      totalBytesDownloaded: this.totalBytesDownloaded,
      currentUploadSpeedBps: this.currentUploadSpeedBps,
      currentDownloadSpeedBps: this.currentDownloadSpeedBps,
      authEnabled: settings.authEnabled,
      guestAccess: settings.guestAccess,
    };
  }

  private startSpeedMonitor(): void {
    if (this.speedTimer) clearInterval(this.speedTimer);
    this.speedTimer = setInterval(() => {
      this.currentUploadSpeedBps = Math.max(0, this.totalBytesUploaded - this.lastUploadBytes);
      this.currentDownloadSpeedBps = Math.max(
        0,
        this.totalBytesDownloaded - this.lastDownloadBytes,
      );
      this.lastUploadBytes = this.totalBytesUploaded;
      this.lastDownloadBytes = this.totalBytesDownloaded;

      if (this.activeTransfers.size > 0) {
        this.events.onTransfersUpdated?.(Array.from(this.activeTransfers.values()));
      }
    }, 1000);
  }

  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    req?: http.IncomingMessage,
    status?: number,
  ): void {
    const clientIp = req
      ? (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1'
      : '127.0.0.1';
    const entry: ServerLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      clientIp,
      method: req?.method,
      url: req?.url,
      status,
      message,
    };
    this.store.addLog(entry);
    this.events.onLogAdded?.(entry);
  }

  private checkRateLimit(clientIp: string, maxPerMin: number): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(clientIp);
    if (!entry || entry.resetAt < now) {
      this.rateLimitMap.set(clientIp, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    entry.count++;
    return entry.count <= maxPerMin;
  }

  private checkAuth(req: http.IncomingMessage): boolean {
    const settings = this.store.getSettings();
    if (!settings.authEnabled) return true;

    // Check basic auth header or bearer token
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const [username, password] = decoded.split(':');
        if (username && password) {
          const user = this.store.findUserByUsername(username);
          if (user && verifyPassword(password, user.passwordHash)) {
            return true;
          }
        }
      } catch {
        // Fall through
      }
    }

    // Guest access allowed for GET requests if configured
    if (settings.guestAccess && (req.method === 'GET' || req.method === 'HEAD')) {
      return true;
    }

    return false;
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const clientIp =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const settings = this.store.getSettings();

    // Check rate limit
    if (!this.checkRateLimit(clientIp, settings.rateLimitPerMin)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests. Please slow down.' }));
      this.log('warn', 'Rate limit exceeded', req, 429);
      return;
    }

    // CORS headers for LAN clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const rawUrl = req.url || '/';
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // 1. Root and Web Manager UI
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getWebManagerHtml(settings.serverName));
      return;
    }

    // 2. Public API Status
    if (pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getStatus()));
      return;
    }

    // 3. User Login API
    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      if (body && typeof body.username === 'string' && typeof body.password === 'string') {
        const user = this.store.findUserByUsername(body.username);
        if (user && verifyPassword(body.password, user.passwordHash)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, user: { username: user.username, role: user.role } }));
          this.log('info', `User '${user.username}' logged in successfully`, req, 200);
          return;
        }
      }
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid username or password' }));
      this.log('warn', 'Failed login attempt', req, 401);
      return;
    }

    // 4. Share Links handling
    if (pathname.startsWith('/share/')) {
      await this.handleShareRoute(pathname, parsedUrl, req, res);
      return;
    }

    // 5. Authentication check for general file operations
    if (!this.checkAuth(req)) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Basic realm="Smaran File Server"',
      });
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    // 6. Directory Listing API
    if (pathname === '/api/files' && req.method === 'GET') {
      const relPath = parsedUrl.searchParams.get('path') || '';
      const listing = this.listDirectory(relPath);
      if (!listing) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Folder not found or inaccessible' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(listing));
      return;
    }

    // 7. Make Directory API
    if (pathname === '/api/mkdir' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      const parentRel = typeof body?.path === 'string' ? body.path : '';
      const dirName = typeof body?.name === 'string' ? body.name.trim() : '';

      if (!dirName || dirName.includes('/') || dirName.includes('\\')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid directory name' }));
        return;
      }

      const safeTarget = resolveSafePath(settings.rootDir, path.join(parentRel, dirName));
      if (!safeTarget) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
      }

      try {
        fs.mkdirSync(safeTarget, { recursive: true });
        this.log('info', `Created directory: ${dirName}`, req, 200);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Could not create directory' }));
      }
      return;
    }

    // 8. Delete API
    if (pathname === '/api/delete' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      const relPath = typeof body?.path === 'string' ? body.path : '';
      const safeTarget = resolveSafePath(settings.rootDir, relPath);

      if (!safeTarget || safeTarget === path.resolve(settings.rootDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Cannot delete root directory' }));
        return;
      }

      try {
        if (fs.existsSync(safeTarget)) {
          fs.rmSync(safeTarget, { recursive: true, force: true });
          this.log('info', `Deleted: ${relPath}`, req, 200);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File or folder not found' }));
        }
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Delete failed' }));
      }
      return;
    }

    // 9. Rename API
    if (pathname === '/api/rename' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      const relPath = typeof body?.path === 'string' ? body.path : '';
      const newName = typeof body?.newName === 'string' ? body.newName.trim() : '';

      if (!newName || newName.includes('/') || newName.includes('\\')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid new name' }));
        return;
      }

      const safeSource = resolveSafePath(settings.rootDir, relPath);
      if (!safeSource) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
      }

      const parentDir = path.dirname(safeSource);
      const safeDest = resolveSafePath(settings.rootDir, path.relative(settings.rootDir, path.join(parentDir, newName)));
      if (!safeDest) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
      }

      try {
        fs.renameSync(safeSource, safeDest);
        this.log('info', `Renamed '${relPath}' to '${newName}'`, req, 200);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rename failed' }));
      }
      return;
    }

    // 10. File Upload API (Direct stream write to disk)
    if (pathname === '/api/upload' && req.method === 'POST') {
      await this.handleFileUpload(parsedUrl, req, res);
      return;
    }

    // 11. Download / Raw File Serving with Range Support
    if (pathname.startsWith('/download/') || pathname.startsWith('/raw/')) {
      const isDownload = pathname.startsWith('/download/');
      const rawRel = pathname.replace(/^\/(download|raw)\//, '');
      await this.serveFile(rawRel, isDownload, req, res);
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private async handleShareRoute(
    pathname: string,
    parsedUrl: URL,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const parts = pathname.split('/').filter(Boolean); // ['share', token, ...]
    const token = parts[1];
    if (!token) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Share token required');
      return;
    }

    const share = this.store.findShareByToken(token);
    if (!share) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Share link not found or expired');
      return;
    }

    // Check expiration
    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      res.writeHead(410, { 'Content-Type': 'text/plain' });
      res.end('This share link has expired');
      return;
    }

    // Check max downloads
    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      res.writeHead(410, { 'Content-Type': 'text/plain' });
      res.end('Maximum download limit reached for this share link');
      return;
    }

    // If password protected, verify password parameter or header
    if (share.passwordProtected && share.passwordHash) {
      const pwd = parsedUrl.searchParams.get('pwd') || (req.headers['x-share-password'] as string);
      if (!pwd || !verifyPassword(pwd, share.passwordHash)) {
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#161617;color:#fff;display:grid;place-items:center;min-height:90vh;">
          <form method="GET" style="background:#222;padding:24px;border-radius:8px;display:flex;flex-direction:column;gap:12px;">
            <h3>Password Required</h3>
            <input type="password" name="pwd" placeholder="Enter password" autofocus style="padding:8px;border-radius:4px;border:1px solid #444;background:#111;color:#fff;">
            <button type="submit" style="padding:8px;background:#e06c43;color:#fff;border:none;border-radius:4px;cursor:pointer;">Unlock</button>
          </form></body></html>`);
        return;
      }
    }

    // Serve download for file
    this.store.recordShareDownload(share.id);
    await this.serveFile(share.relativePath, true, req, res);
  }

  private async handleFileUpload(
    parsedUrl: URL,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const settings = this.store.getSettings();
    const targetFolderRel = parsedUrl.searchParams.get('path') || '';
    let fileName = parsedUrl.searchParams.get('name') || '';

    if (!fileName) {
      // Fallback name
      fileName = `upload-${Date.now()}`;
    }

    // Clean filename
    fileName = path.basename(fileName);

    const safeTarget = resolveSafePath(settings.rootDir, path.join(targetFolderRel, fileName));
    if (!safeTarget) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied' }));
      return;
    }

    const transferId = crypto.randomUUID();
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const contentLength = Number(req.headers['content-length'] || 0);

    // Limit check
    const maxBytes = settings.uploadLimitMb * 1024 * 1024;
    if (contentLength > maxBytes) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `File exceeds maximum allowed upload size (${settings.uploadLimitMb} MB)` }));
      return;
    }

    const activeTransfer: ActiveTransfer = {
      id: transferId,
      fileName,
      direction: 'upload',
      clientIp,
      bytesTransferred: 0,
      totalBytes: contentLength,
      speedBps: 0,
      percent: 0,
      startedAt: new Date().toISOString(),
    };
    this.activeTransfers.set(transferId, activeTransfer);

    const startTime = Date.now();
    const writeStream = fs.createWriteStream(safeTarget);

    req.on('data', (chunk: Buffer) => {
      activeTransfer.bytesTransferred += chunk.length;
      this.totalBytesUploaded += chunk.length;
      if (activeTransfer.totalBytes > 0) {
        activeTransfer.percent = Math.min(100, Math.round((activeTransfer.bytesTransferred / activeTransfer.totalBytes) * 100));
      }
    });

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      this.activeTransfers.delete(transferId);
      const durationMs = Date.now() - startTime;
      const historyEntry: TransferHistoryEntry = {
        id: transferId,
        fileName,
        direction: 'upload',
        clientIp,
        totalBytes: activeTransfer.bytesTransferred,
        status: 'completed',
        startedAt: activeTransfer.startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
      };
      this.store.addHistory(historyEntry);
      this.log('info', `Uploaded '${fileName}' (${activeTransfer.bytesTransferred} bytes)`, req, 200);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, name: fileName, size: activeTransfer.bytesTransferred }));
    });

    writeStream.on('error', (err) => {
      this.activeTransfers.delete(transferId);
      this.log('error', `Upload failed for '${fileName}': ${err.message}`, req, 500);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File write error' }));
      }
    });

    req.on('aborted', () => {
      this.activeTransfers.delete(transferId);
      writeStream.destroy();
      try {
        if (fs.existsSync(safeTarget)) fs.unlinkSync(safeTarget);
      } catch {
        // Cleanup attempt
      }
    });
  }

  private async serveFile(
    relPath: string,
    isDownload: boolean,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const settings = this.store.getSettings();
    const safeTarget = resolveSafePath(settings.rootDir, relPath);

    if (!safeTarget || !fs.existsSync(safeTarget)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const stat = fs.statSync(safeTarget);
    if (stat.isDirectory()) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Cannot download directory directly');
      return;
    }

    const fileSize = stat.size;
    const mimeType = lookupMime(safeTarget);
    const fileName = path.basename(safeTarget);

    // Range Request Handling (206 Partial Content)
    const rangeHeader = settings.enableRangeRequests ? req.headers['range'] : undefined;
    let start = 0;
    let end = fileSize - 1;
    let statusCode = 200;

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const part0 = parts[0];
      const part1 = parts[1];

      if (part0) start = parseInt(part0, 10);
      if (part1) end = parseInt(part1, 10);

      if (start > end || start >= fileSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        res.end();
        return;
      }
      statusCode = 206;
    }

    const chunkLength = end - start + 1;
    const headers: Record<string, string | number> = {
      'Content-Type': mimeType,
      'Content-Length': chunkLength,
      'Accept-Ranges': 'bytes',
      'Last-Modified': stat.mtime.toUTCString(),
    };

    if (isDownload) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(fileName)}"`;
    }

    if (statusCode === 206) {
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
    }

    res.writeHead(statusCode, headers);

    const transferId = crypto.randomUUID();
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const activeTransfer: ActiveTransfer = {
      id: transferId,
      fileName,
      direction: 'download',
      clientIp,
      bytesTransferred: 0,
      totalBytes: chunkLength,
      speedBps: 0,
      percent: 0,
      startedAt: new Date().toISOString(),
    };
    this.activeTransfers.set(transferId, activeTransfer);

    const stream = fs.createReadStream(safeTarget, { start, end });
    const startTime = Date.now();

    stream.on('data', (chunk: Buffer | string) => {
      const len = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      activeTransfer.bytesTransferred += len;
      this.totalBytesDownloaded += len;
      if (activeTransfer.totalBytes > 0) {
        activeTransfer.percent = Math.min(100, Math.round((activeTransfer.bytesTransferred / activeTransfer.totalBytes) * 100));
      }
    });

    stream.on('end', () => {
      this.activeTransfers.delete(transferId);
      const durationMs = Date.now() - startTime;
      const historyEntry: TransferHistoryEntry = {
        id: transferId,
        fileName,
        direction: 'download',
        clientIp,
        totalBytes: activeTransfer.bytesTransferred,
        status: 'completed',
        startedAt: activeTransfer.startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
      };
      this.store.addHistory(historyEntry);
    });

    stream.on('error', (_err) => {
      this.activeTransfers.delete(transferId);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Stream read error');
      }
    });

    req.on('close', () => {
      stream.destroy();
      this.activeTransfers.delete(transferId);
    });

    stream.pipe(res);
  }

  listDirectory(relPath: string): DirectoryListing | null {
    const settings = this.store.getSettings();
    const safeTarget = resolveSafePath(settings.rootDir, relPath);
    if (!safeTarget || !fs.existsSync(safeTarget)) return null;

    const stat = fs.statSync(safeTarget);
    if (!stat.isDirectory()) return null;

    const entries = fs.readdirSync(safeTarget, { withFileTypes: true });
    const items: FileItem[] = [];
    let totalFiles = 0;
    let totalFolders = 0;
    let totalSize = 0;

    for (const entry of entries) {
      try {
        const fullChild = path.join(safeTarget, entry.name);
        const childStat = fs.statSync(fullChild);
        const isDir = entry.isDirectory();
        const size = isDir ? 0 : childStat.size;
        if (isDir) totalFolders++;
        else {
          totalFiles++;
          totalSize += size;
        }

        const childRel = path.relative(settings.rootDir, fullChild).replace(/\\/g, '/');

        items.push({
          name: entry.name,
          relativePath: childRel,
          isDirectory: isDir,
          size,
          modifiedAt: childStat.mtime.toISOString(),
          mimeType: isDir ? 'inode/directory' : lookupMime(entry.name),
          extension: isDir ? '' : path.extname(entry.name).toLowerCase(),
        });
      } catch {
        // Skip inaccessible entries
      }
    }

    // Build breadcrumbs
    const normalizedRel = path.relative(settings.rootDir, safeTarget).replace(/\\/g, '/');
    const parts = normalizedRel ? normalizedRel.split('/') : [];
    const breadcrumbs: { name: string; path: string }[] = [{ name: 'Root', path: '' }];
    let accPath = '';
    for (const p of parts) {
      accPath = accPath ? `${accPath}/${p}` : p;
      breadcrumbs.push({ name: p, path: accPath });
    }

    return {
      currentPath: normalizedRel,
      breadcrumbs,
      items,
      totalFiles,
      totalFolders,
      totalSize,
      writable: true,
    };
  }

  cancelTransfer(transferId: string): boolean {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return false;
    this.activeTransfers.delete(transferId);
    this.events.onTransfersUpdated?.(Array.from(this.activeTransfers.values()));
    return true;
  }

  private readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1_000_000) {
          req.destroy();
          resolve(null);
        }
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
      req.on('error', () => resolve(null));
    });
  }
}
