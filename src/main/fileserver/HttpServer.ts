import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'node:net';
import type {
  ActiveTransfer,
  LiveConnection,
  ServerLogEntry,
  ServerStatus,
  TransferHistoryEntry,
  UserAccount,
} from '@shared/fileserver';
import type { FileServerStore } from './FileServerStore';
import { lookupMime } from './mime';
import { buildServerUrls, getLanIps } from './network';
import {
  BruteForceLimiter,
  isIpAllowed,
  resolveSafePath,
  verifyPassword,
} from './security';
import { getWebManagerHtml } from './webUi';
import { VfsManager } from './vfs/VfsManager';
import { streamFolderAsZip, streamSelectionAsZip } from './vfs/zipStream';
import { WebDavHandler } from './webdav';
import { BandwidthManager } from './throttler';
import { NatManager } from './nat';
import { DdnsManager } from './ddns';

export interface HttpServerEvents {
  onStatusChanged?: (status: ServerStatus) => void;
  onTransfersUpdated?: (transfers: ActiveTransfer[]) => void;
  onLogAdded?: (log: ServerLogEntry) => void;
}

interface SocketTracker {
  id: string;
  socket: Socket;
  clientIp: string;
  userAgent: string;
  connectedAt: string;
  currentPath: string;
  bytesSent: number;
  bytesReceived: number;
  lastActivity: number;
}

export class HttpServer {
  private server: http.Server | https.Server | null = null;
  private startedAt: number | null = null;
  private socketMap = new Map<Socket, SocketTracker>();
  private activeTransfers = new Map<string, ActiveTransfer>();
  private totalBytesUploaded = 0;
  private totalBytesDownloaded = 0;
  private currentUploadSpeedBps = 0;
  private currentDownloadSpeedBps = 0;
  private lastUploadBytes = 0;
  private lastDownloadBytes = 0;
  private speedTimer: ReturnType<typeof setInterval> | null = null;
  private rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  public readonly vfs: VfsManager;
  private readonly webdav: WebDavHandler;
  private readonly bandwidth = new BandwidthManager();
  private readonly nat = new NatManager();
  private readonly ddns: DdnsManager;
  private readonly bruteForce = new BruteForceLimiter();

  constructor(
    private readonly store: FileServerStore,
    private readonly events: HttpServerEvents = {},
  ) {
    this.vfs = new VfsManager(this.store);
    this.webdav = new WebDavHandler(this.vfs, this.store.getSettings().rootDir);
    this.ddns = new DdnsManager((level, msg) => this.log(level, msg));
  }

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
          const clientIp = socket.remoteAddress || '127.0.0.1';
          const tracker: SocketTracker = {
            id: randomUUID(),
            socket,
            clientIp,
            userAgent: 'Connecting...',
            connectedAt: new Date().toISOString(),
            currentPath: '/',
            bytesSent: 0,
            bytesReceived: 0,
            lastActivity: Date.now(),
          };
          this.socketMap.set(socket, tracker);

          socket.on('data', (chunk) => {
            tracker.bytesReceived += chunk.length;
            tracker.lastActivity = Date.now();
          });

          socket.on('close', () => {
            this.socketMap.delete(socket);
          });
        });

        this.server.on('error', (err: Error) => {
          console.error('File server error:', err);
          this.log('error', `Server error: ${err.message}`);
          this.stop();
          resolve({ ok: false, error: err.message });
        });

        const bindHost = settings.bindAddress || '0.0.0.0';
        this.server.listen(settings.port, bindHost, async () => {
          this.startedAt = Date.now();
          this.startSpeedMonitor();
          this.log('info', `Server started on ${bindHost}:${settings.port}`);

          // UPnP automatic router port forwarding
          if (settings.upnpEnabled) {
            try {
              const natResult = await this.nat.mapPort(settings.port, settings.serverName);
              if (natResult.mapped) {
                this.log('info', `UPnP port ${settings.port} forwarded on router (WAN: ${natResult.publicIp})`);
              } else if (natResult.error) {
                this.log('warn', `UPnP port mapping notice: ${natResult.error}`);
              }
            } catch {
              // Ignore UPnP discovery issues
            }
          }

          // Dynamic DNS updater
          if (settings.ddnsUrl) {
            const publicIp = this.nat.getStatus().publicIp || getLanIps()[0] || '127.0.0.1';
            this.ddns.start(settings.ddnsUrl, settings.ddnsIntervalMinutes, publicIp);
          }

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

  async stop(): Promise<void> {
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }

    this.ddns.stop();

    // Unmap UPnP
    const settings = this.store.getSettings();
    if (settings.upnpEnabled) {
      await this.nat.unmapPort(settings.port);
    }

    // Destroy active connections
    for (const [socket] of this.socketMap) {
      socket.destroy();
    }
    this.socketMap.clear();
    this.activeTransfers.clear();

    return new Promise((resolve) => {
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

  killConnection(connectionId: string): boolean {
    for (const [socket, tracker] of this.socketMap.entries()) {
      if (tracker.id === connectionId) {
        socket.destroy();
        this.socketMap.delete(socket);
        this.log('info', `Connection ${tracker.clientIp} disconnected by admin`);
        return true;
      }
    }
    return false;
  }

  getStatus(): ServerStatus {
    const settings = this.store.getSettings();
    const lanIps = getLanIps();
    const { localUrl, lanUrls } = buildServerUrls(settings.port, lanIps, settings.httpsEnabled);
    const uptime = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
    const natStatus = this.nat.getStatus();

    const liveConnections: LiveConnection[] = [];
    for (const [, tracker] of this.socketMap) {
      liveConnections.push({
        id: tracker.id,
        clientIp: tracker.clientIp,
        userAgent: tracker.userAgent,
        connectedAt: tracker.connectedAt,
        currentPath: tracker.currentPath,
        speedBps: this.currentDownloadSpeedBps + this.currentUploadSpeedBps,
        bytesSent: tracker.bytesSent,
        bytesReceived: tracker.bytesReceived,
      });
    }

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
      connectedClients: this.socketMap.size,
      activeTransfers: Array.from(this.activeTransfers.values()),
      totalBytesUploaded: this.totalBytesUploaded,
      totalBytesDownloaded: this.totalBytesDownloaded,
      currentUploadSpeedBps: this.currentUploadSpeedBps,
      currentDownloadSpeedBps: this.currentDownloadSpeedBps,
      authEnabled: settings.authEnabled,
      guestAccess: settings.guestAccess,
      upnpMapped: natStatus.mapped,
      publicIp: natStatus.publicIp,
      liveConnections,
    };
  }

  private startSpeedMonitor(): void {
    this.lastUploadBytes = this.totalBytesUploaded;
    this.lastDownloadBytes = this.totalBytesDownloaded;

    this.speedTimer = setInterval(() => {
      const upDelta = this.totalBytesUploaded - this.lastUploadBytes;
      const downDelta = this.totalBytesDownloaded - this.lastDownloadBytes;

      this.currentUploadSpeedBps = Math.max(0, upDelta);
      this.currentDownloadSpeedBps = Math.max(0, downDelta);

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
      id: randomUUID(),
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

  private authenticateUser(req: http.IncomingMessage): UserAccount | null {
    const settings = this.store.getSettings();
    if (!settings.authEnabled) return null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const [username, password] = decoded.split(':');
        if (username && password) {
          const user = this.store.findUserByUsername(username);
          if (user && verifyPassword(password, user.passwordHash)) {
            return user;
          }
        }
      } catch {
        // Fall through
      }
    }
    return null;
  }

  private checkAuth(req: http.IncomingMessage, user: UserAccount | null): boolean {
    const settings = this.store.getSettings();
    if (!settings.authEnabled) return true;
    if (user) return true;

    // Guest access allowed for GET/HEAD
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

    // Update socket tracker
    const tracker = this.socketMap.get(req.socket);
    if (tracker) {
      tracker.userAgent = (req.headers['user-agent'] as string) || 'Browser';
      tracker.currentPath = req.url || '/';
      tracker.lastActivity = Date.now();
    }

    // 1. IP Firewall Check
    if (!isIpAllowed(clientIp, settings.ipFilterEnabled, settings.ipAllowlist, settings.ipBlocklist)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access forbidden by IP firewall' }));
      this.log('warn', 'Connection rejected by IP firewall', req, 403);
      return;
    }

    // 2. Anti-Brute Force Lockout
    if (settings.bruteForceProtection && this.bruteForce.isLocked(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many failed login attempts. Temporarily locked out.' }));
      this.log('warn', 'Blocked by anti-brute force limiter', req, 429);
      return;
    }

    // 3. Rate Limit
    if (!this.checkRateLimit(clientIp, settings.rateLimitPerMin)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests. Please slow down.' }));
      this.log('warn', 'Rate limit exceeded', req, 429);
      return;
    }

    // CORS headers for LAN clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, Depth, Destination, Timeout, Lock-Token');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, DAV, Lock-Token');

    if (req.method === 'OPTIONS' && !this.webdav.isWebDavRequest(req)) {
      res.writeHead(204);
      res.end();
      return;
    }

    // 4. WebDAV Protocol Handling
    if (settings.webdavEnabled && this.webdav.isWebDavRequest(req)) {
      const handled = await this.webdav.handleRequest(req, res, clientIp);
      if (handled) return;
    }

    const rawUrl = req.url || '/';
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // 5. Root & Web File Manager UI
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getWebManagerHtml(settings.serverName));
      return;
    }

    // 6. Public API Status
    if (pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getStatus()));
      return;
    }

    // 7. Login API
    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      if (body && typeof body.username === 'string' && typeof body.password === 'string') {
        const user = this.store.findUserByUsername(body.username);
        if (user && verifyPassword(body.password, user.passwordHash)) {
          this.bruteForce.recordSuccess(clientIp);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, user: { username: user.username, role: user.role } }));
          this.log('info', `User '${user.username}' logged in successfully`, req, 200);
          return;
        }
      }
      this.bruteForce.recordFailure(clientIp);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid username or password' }));
      this.log('warn', 'Failed login attempt', req, 401);
      return;
    }

    // 8. Share Links
    if (pathname.startsWith('/share/')) {
      await this.handleShareRoute(pathname, parsedUrl, req, res);
      return;
    }

    // 9. Auth check
    const user = this.authenticateUser(req);
    if (!this.checkAuth(req, user)) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Basic realm="Smaran File Server"',
      });
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    // 10. Directory Listing API via VFS
    if (pathname === '/api/files' && req.method === 'GET') {
      const relPath = parsedUrl.searchParams.get('path') || '';
      const listing = this.vfs.listDirectory(relPath, user);
      if (!listing) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Folder not found or inaccessible' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(listing));
      return;
    }

    // 11. Streaming ZIP of Folder API
    if (pathname === '/api/zip' && req.method === 'GET') {
      const relPath = parsedUrl.searchParams.get('path') || '';
      await this.handleFolderZipDownload(relPath, user, req, res);
      return;
    }

    // 12. Streaming ZIP of Multi-file Selection API
    if (pathname === '/api/zip-selection' && req.method === 'GET') {
      const itemsRaw = parsedUrl.searchParams.get('items') || '';
      const itemsList = itemsRaw.split(';').map((s) => s.trim()).filter(Boolean);
      await this.handleSelectionZipDownload(itemsList, user, req, res);
      return;
    }

    // 13. File Comment (descript.ion) API
    if (pathname === '/api/comment' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      const relPath = typeof body?.path === 'string' ? body.path : '';
      const commentText = typeof body?.comment === 'string' ? body.comment : '';

      const target = this.vfs.resolvePath(relPath, user);
      if (!target?.physicalPath) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }

      const dir = path.dirname(target.physicalPath);
      const name = path.basename(target.physicalPath);
      this.store.setCommentForFile(dir, name, commentText);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // 14. Make Directory API
    if (pathname === '/api/mkdir' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      const parentRel = typeof body?.path === 'string' ? body.path : '';
      const dirName = typeof body?.name === 'string' ? body.name.trim() : '';

      if (!dirName || dirName.includes('/') || dirName.includes('\\')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid directory name' }));
        return;
      }

      const parentTarget = this.vfs.resolvePath(parentRel, user);
      const physicalBase = parentTarget?.physicalPath || settings.rootDir;
      const safeTarget = resolveSafePath(physicalBase, dirName);

      if (!safeTarget) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
      }

      try {
        if (!fs.existsSync(safeTarget)) {
          fs.mkdirSync(safeTarget, { recursive: true });
        }
        this.log('info', `Created folder '${dirName}' in '${parentRel}'`, req, 200);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, name: dirName }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to create directory' }));
      }
      return;
    }

    // 15. Delete File/Folder API
    if (pathname === '/api/delete' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      const relPath = typeof body?.path === 'string' ? body.path : '';

      const target = this.vfs.resolvePath(relPath, user);
      if (!target?.physicalPath || !fs.existsSync(target.physicalPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Item not found' }));
        return;
      }

      if (!target.permissions.canDelete) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Delete permission denied' }));
        return;
      }

      try {
        fs.rmSync(target.physicalPath, { recursive: true, force: true });
        this.log('info', `Deleted '${relPath}'`, req, 200);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to delete item' }));
      }
      return;
    }

    // 16. Rename API
    if (pathname === '/api/rename' && req.method === 'POST') {
      const body = await this.readJsonBody(req);
      const relPath = typeof body?.path === 'string' ? body.path : '';
      const newName = typeof body?.newName === 'string' ? body.newName.trim() : '';

      if (!newName || newName.includes('/') || newName.includes('\\')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid new name' }));
        return;
      }

      const target = this.vfs.resolvePath(relPath, user);
      if (!target?.physicalPath || !fs.existsSync(target.physicalPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Item not found' }));
        return;
      }

      const parentDir = path.dirname(target.physicalPath);
      const destPhysical = path.join(parentDir, newName);

      try {
        fs.renameSync(target.physicalPath, destPhysical);
        this.log('info', `Renamed '${relPath}' to '${newName}'`, req, 200);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rename failed' }));
      }
      return;
    }

    // 17. File Upload API
    if (pathname === '/api/upload' && req.method === 'POST') {
      await this.handleFileUpload(parsedUrl, user, req, res);
      return;
    }

    // 18. File Serving (Raw & Download) with Range and Throttling Support
    if (pathname.startsWith('/download/') || pathname.startsWith('/raw/')) {
      const isDownload = pathname.startsWith('/download/');
      const rawRel = pathname.replace(/^\/(download|raw)\//, '');
      await this.serveFile(rawRel, isDownload, user, req, res);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private async handleFolderZipDownload(
    relPath: string,
    user: UserAccount | null,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const target = this.vfs.resolvePath(relPath, user);
    if (!target?.physicalPath || !fs.existsSync(target.physicalPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Folder not found');
      return;
    }

    if (!target.permissions.canArchive) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Archive permission denied');
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const settings = this.store.getSettings();

    if (!this.bandwidth.canStartDownload(clientIp, settings.maxDownloads)) {
      res.writeHead(429, { 'Content-Type': 'text/plain' });
      res.end('Too many concurrent downloads. Please wait.');
      return;
    }

    const transferId = randomUUID();
    const folderName = path.basename(target.physicalPath) || 'archive';
    const activeTransfer: ActiveTransfer = {
      id: transferId,
      fileName: `${folderName}.zip`,
      direction: 'download',
      clientIp,
      bytesTransferred: 0,
      totalBytes: 0, // dynamic
      speedBps: 0,
      percent: 0,
      startedAt: new Date().toISOString(),
    };
    this.activeTransfers.set(transferId, activeTransfer);
    this.bandwidth.startDownload(clientIp);

    try {
      await streamFolderAsZip(target.physicalPath, res, {
        archiveName: `${folderName}.zip`,
        onProgress: (bytes) => {
          activeTransfer.bytesTransferred += bytes;
          this.totalBytesDownloaded += bytes;
        },
      });
    } finally {
      this.activeTransfers.delete(transferId);
      this.bandwidth.endDownload(clientIp);
    }
  }

  private async handleSelectionZipDownload(
    itemsList: string[],
    user: UserAccount | null,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const resolvedItems: { physicalPath: string; archivePath: string }[] = [];

    for (const rel of itemsList) {
      const target = this.vfs.resolvePath(rel, user);
      if (target?.physicalPath && fs.existsSync(target.physicalPath)) {
        resolvedItems.push({
          physicalPath: target.physicalPath,
          archivePath: path.basename(target.physicalPath),
        });
      }
    }

    if (resolvedItems.length === 0) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('No valid files selected');
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const settings = this.store.getSettings();

    if (!this.bandwidth.canStartDownload(clientIp, settings.maxDownloads)) {
      res.writeHead(429, { 'Content-Type': 'text/plain' });
      res.end('Too many concurrent downloads. Please wait.');
      return;
    }

    const transferId = randomUUID();
    const activeTransfer: ActiveTransfer = {
      id: transferId,
      fileName: 'selected-files.zip',
      direction: 'download',
      clientIp,
      bytesTransferred: 0,
      totalBytes: 0,
      speedBps: 0,
      percent: 0,
      startedAt: new Date().toISOString(),
    };
    this.activeTransfers.set(transferId, activeTransfer);
    this.bandwidth.startDownload(clientIp);

    try {
      await streamSelectionAsZip(resolvedItems, res, 'selected-files.zip', {
        onProgress: (bytes) => {
          activeTransfer.bytesTransferred += bytes;
          this.totalBytesDownloaded += bytes;
        },
      });
    } finally {
      this.activeTransfers.delete(transferId);
      this.bandwidth.endDownload(clientIp);
    }
  }

  private async handleShareRoute(
    pathname: string,
    parsedUrl: URL,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const parts = pathname.split('/').filter(Boolean);
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

    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      res.writeHead(410, { 'Content-Type': 'text/plain' });
      res.end('This share link has expired');
      return;
    }

    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      res.writeHead(410, { 'Content-Type': 'text/plain' });
      res.end('Maximum download limit reached for this share link');
      return;
    }

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

    this.store.recordShareDownload(share.id);
    await this.serveFile(share.relativePath, true, null, req, res);
  }

  private async handleFileUpload(
    parsedUrl: URL,
    user: UserAccount | null,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const settings = this.store.getSettings();
    const targetFolderRel = parsedUrl.searchParams.get('path') || '';
    let fileName = parsedUrl.searchParams.get('name') || '';

    if (!fileName) {
      fileName = `upload-${Date.now()}`;
    }
    fileName = path.basename(fileName);

    const folderTarget = this.vfs.resolvePath(targetFolderRel, user);
    const physicalDir = folderTarget?.physicalPath || settings.rootDir;

    if (folderTarget && !folderTarget.permissions.canUpload) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upload permission denied' }));
      return;
    }

    const safeTarget = resolveSafePath(physicalDir, fileName);
    if (!safeTarget) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied' }));
      return;
    }

    const transferId = randomUUID();
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const contentLength = Number(req.headers['content-length'] || 0);

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

    // Apply upload throttler if configured
    const throttler = this.bandwidth.createUploadThrottler(clientIp, settings);

    req.on('data', (chunk: Buffer) => {
      activeTransfer.bytesTransferred += chunk.length;
      this.totalBytesUploaded += chunk.length;
      if (activeTransfer.totalBytes > 0) {
        activeTransfer.percent = Math.min(100, Math.round((activeTransfer.bytesTransferred / activeTransfer.totalBytes) * 100));
      }
    });

    if (throttler) {
      req.pipe(throttler).pipe(writeStream);
    } else {
      req.pipe(writeStream);
    }

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
    user: UserAccount | null,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const settings = this.store.getSettings();
    const target = this.vfs.resolvePath(relPath, user);

    if (!target?.physicalPath || !fs.existsSync(target.physicalPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    if (!target.permissions.canRead) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Read permission denied');
      return;
    }

    const safeTarget = target.physicalPath;
    const stat = fs.statSync(safeTarget);
    if (stat.isDirectory()) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Cannot download directory directly (use ZIP download)');
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    // Concurrency limit check
    if (!this.bandwidth.canStartDownload(clientIp, settings.maxDownloads)) {
      res.writeHead(429, { 'Content-Type': 'text/plain' });
      res.end('Too many concurrent downloads. Please try again later.');
      return;
    }

    const fileSize = stat.size;
    const mimeType = lookupMime(safeTarget);
    const fileName = path.basename(safeTarget);

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

    const transferId = randomUUID();
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
    this.bandwidth.startDownload(clientIp);

    const stream = fs.createReadStream(safeTarget, { start, end });
    const throttler = this.bandwidth.createDownloadThrottler(clientIp, settings);
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
      this.bandwidth.endDownload(clientIp);
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
      this.bandwidth.endDownload(clientIp);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Stream read error');
      }
    });

    req.on('close', () => {
      stream.destroy();
      this.activeTransfers.delete(transferId);
      this.bandwidth.endDownload(clientIp);
    });

    if (throttler) {
      stream.pipe(throttler).pipe(res);
    } else {
      stream.pipe(res);
    }
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
