import crypto from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import net, { type Socket } from 'node:net';
import os from 'node:os';
import type { RemoteHubOverview, RemoteHubServerStatus } from '@shared/remotehub';
import { RemoteHubDeviceManager } from './RemoteHubDeviceManager';
import { RemoteHubInputControl, type InputEvent } from './RemoteHubInputControl';
import { RemoteHubLogger } from './RemoteHubLogger';
import { RemoteHubStreamManager } from './RemoteHubStreamManager';
import { RemoteHubUserStore } from './RemoteHubUserStore';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface RemoteHubServerOptions {
  port: number;
  bindAddress: string;
  allowLan: boolean;
  userStore: RemoteHubUserStore;
  deviceManager: RemoteHubDeviceManager;
  streamManager: RemoteHubStreamManager;
  inputControl: RemoteHubInputControl;
  logger: RemoteHubLogger;
}

export class RemoteHubServer {
  private server: http.Server | null = null;
  private status: RemoteHubServerStatus = 'stopped';
  private startedAt: number | null = null;
  private readonly wsClients = new Set<{
    socket: Socket;
    userId?: string;
    role?: 'owner' | 'operator' | 'viewer';
    authenticated: boolean;
  }>();

  constructor(private readonly options: RemoteHubServerOptions) {}

  getStatus(): RemoteHubServerStatus {
    return this.status;
  }

  getUptime(): number {
    return this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
  }

  getLanIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (!iface.internal && iface.family === 'IPv4') {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  getLanUrl(): string {
    const ip = this.options.allowLan ? this.getLanIp() : '127.0.0.1';
    return `http://${ip}:${this.options.port}`;
  }

  getConnectedUsersCount(): number {
    const uniqueUsers = new Set<string>();
    for (const c of this.wsClients) {
      if (c.authenticated && c.userId) uniqueUsers.add(c.userId);
    }
    return uniqueUsers.size;
  }

  /**
   * Pre-flight port availability probe to prevent collisions before binding.
   */
  private checkPortAvailable(port: number, host: string): Promise<boolean> {
    return new Promise((resolve) => {
      const probe = net.createServer();
      probe.unref();
      probe.once('error', () => resolve(false));
      probe.listen({ port, host }, () => {
        probe.close(() => resolve(true));
      });
    });
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    if (this.status === 'running' || this.status === 'starting') {
      return { ok: true };
    }

    this.status = 'starting';
    const host = this.options.allowLan ? this.options.bindAddress : '127.0.0.1';
    const port = this.options.port;

    const available = await this.checkPortAvailable(port, host);
    if (!available) {
      this.status = 'error';
      const msg = `Port ${port} is already in use by another application. Please configure a different port in Remote Hub Settings.`;
      this.options.logger.error('server', msg);
      return { ok: false, error: msg };
    }

    return new Promise((resolve) => {
      try {
        const srv = http.createServer((req, res) => this.handleHttpRequest(req, res));

        srv.on('upgrade', (req, socket, head) => {
          this.handleWsUpgrade(req, socket as Socket, head);
        });

        srv.on('error', (err: Error) => {
          this.status = 'error';
          this.options.logger.error('server', `Server error on port ${port}: ${err.message}`);
          resolve({ ok: false, error: err.message });
        });

        srv.listen(port, host, () => {
          this.server = srv;
          this.status = 'running';
          this.startedAt = Date.now();
          const lanUrl = this.getLanUrl();
          this.options.logger.info(
            'server',
            `Remote Hub Server running on ${host}:${port} (${lanUrl})`,
          );
          resolve({ ok: true });
        });
      } catch (err) {
        this.status = 'error';
        const msg = err instanceof Error ? err.message : String(err);
        this.options.logger.error('server', `Failed to start server: ${msg}`);
        resolve({ ok: false, error: msg });
      }
    });
  }

  async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'stopping') return;

    this.status = 'stopping';
    this.options.logger.info('server', 'Stopping Remote Hub Server...');

    // Close all connected WebSocket clients
    for (const client of this.wsClients) {
      try {
        client.socket.destroy();
      } catch {
        // ignore
      }
    }
    this.wsClients.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }

    this.status = 'stopped';
    this.startedAt = null;
    this.options.logger.info('server', 'Remote Hub Server stopped.');
  }

  // ---------- HTTP Request Routing ----------

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    // Add CORS headers for web dashboard
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Public / API Endpoints
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: this.getUptime() }));
      return;
    }

    if (pathname === '/api/overview') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const overview: RemoteHubOverview = {
        status: this.status,
        port: this.options.port,
        bindAddress: this.options.bindAddress,
        lanUrl: this.getLanUrl(),
        connectedUsers: this.getConnectedUsersCount(),
        connectedDevices: this.options.deviceManager.listDevices().length,
        activeStreams: this.options.streamManager.getStreamCount(),
        activeSessions: this.options.inputControl.getActiveSession() ? 1 : 0,
        cpuUsage: 0,
        ramUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptimeSec: this.getUptime(),
        adminCreated: this.options.userStore.hasOwner(),
      };
      res.end(JSON.stringify(overview));
      return;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      this.readJsonBody(req, res, (body) => {
        const username = String(body['username'] || '');
        const password = String(body['password'] || '');
        const ip = req.socket.remoteAddress;

        const authRes = this.options.userStore.authenticate(username, password, ip);
        if (!authRes.ok) {
          this.options.logger.warn('auth', `Failed login attempt for "${username}" from ${ip}`);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: authRes.error }));
          return;
        }

        this.options.logger.info('auth', `User "${username}" signed in successfully from ${ip}`);
        res.setHeader(
          'Set-Cookie',
          `smaran_session=${authRes.sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`,
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, user: authRes.user, token: authRes.sessionToken }));
      });
      return;
    }

    if (pathname === '/api/auth/me') {
      const user = this.authenticateRequest(req);
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, user }));
      return;
    }

    if (pathname === '/api/streams') {
      const streams = this.options.streamManager.listStreams();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, streams }));
      return;
    }

    if (pathname === '/api/devices/pair' && req.method === 'POST') {
      this.readJsonBody(req, res, (body) => {
        const code = String(body['code'] || '');
        const name = String(body['name'] || '');
        const hostname = String(body['hostname'] || '');
        const ip = req.socket.remoteAddress || '127.0.0.1';
        const osName = String(body['os'] || 'Windows');
        const isSmaranInstalled = Boolean(body['isSmaranInstalled']);
        const agentVersion = body['agentVersion'] ? String(body['agentVersion']) : undefined;

        const pairRes = this.options.deviceManager.pairDevice(code, {
          name,
          hostname,
          ip,
          os: osName,
          isSmaranInstalled,
          agentVersion,
        });

        if (!pairRes.ok) {
          this.options.logger.security('device', `Device pairing failed: ${pairRes.error}`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: pairRes.error }));
          return;
        }

        this.options.logger.info(
          'device',
          `Device "${name}" paired successfully (Smaran Host: ${isSmaranInstalled}).`,
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, device: pairRes.device, token: pairRes.deviceToken }));
      });
      return;
    }

    // Default: Serve Built-in Web Client
    if (pathname === '/' || pathname === '/index.html' || pathname === '/dashboard') {
      this.serveWebClient(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  private readJsonBody(
    req: IncomingMessage,
    res: ServerResponse,
    callback: (data: Record<string, unknown>) => void,
  ): void {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        callback(parsed);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Malformed JSON payload.' }));
      }
    });
  }

  private authenticateRequest(req: IncomingMessage) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const res = this.options.userStore.validateSession(token);
      if (res.valid) return res.user;
    }

    // Check cookie
    const cookie = req.headers.cookie;
    if (cookie) {
      const match = cookie.match(/smaran_session=([^;]+)/);
      if (match && match[1]) {
        const res = this.options.userStore.validateSession(match[1]);
        if (res.valid) return res.user;
      }
    }

    return null;
  }

  // ---------- WebSocket RFC 6455 Handler ----------

  private handleWsUpgrade(req: IncomingMessage, socket: Socket, _head: Buffer): void {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(key + WS_GUID)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n',
    ];

    socket.write(headers.join('\r\n'));

    const client = {
      socket,
      authenticated: false,
    };
    this.wsClients.add(client);

    socket.on('data', (buffer: Buffer) => {
      this.handleWsFrame(client, buffer);
    });

    socket.on('close', () => {
      this.wsClients.delete(client);
    });

    socket.on('error', () => {
      this.wsClients.delete(client);
    });
  }

  private handleWsFrame(
    client: {
      socket: Socket;
      userId?: string;
      role?: 'owner' | 'operator' | 'viewer';
      authenticated: boolean;
    },
    buf: Buffer,
  ): void {
    if (buf.length < 2) return;
    const secondByte = buf[1];
    if (secondByte === undefined) return;
    const isMasked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let currentOffset = 2;

    if (payloadLength === 126) {
      if (buf.length < 4) return;
      payloadLength = buf.readUInt16BE(currentOffset);
      currentOffset += 2;
    } else if (payloadLength === 127) {
      if (buf.length < 10) return;
      payloadLength = Number(buf.readBigUInt64BE(currentOffset));
      currentOffset += 8;
    }

    let maskKey: Buffer | null = null;
    if (isMasked) {
      if (buf.length < currentOffset + 4) return;
      maskKey = buf.subarray(currentOffset, currentOffset + 4);
      currentOffset += 4;
    }

    if (buf.length < currentOffset + payloadLength) return;
    const payload = buf.subarray(currentOffset, currentOffset + payloadLength);

    if (isMasked && maskKey) {
      for (let i = 0; i < payload.length; i++) {
        const b = payload[i];
        const m = maskKey[i % 4];
        if (b !== undefined && m !== undefined) {
          payload[i] = b ^ m;
        }
      }
    }

    try {
      const text = payload.toString('utf8');
      const msg = JSON.parse(text);
      this.processWsMessage(client, msg);
    } catch {
      // ignore frame parse errors
    }
  }

  private processWsMessage(
    client: {
      socket: Socket;
      userId?: string;
      role?: 'owner' | 'operator' | 'viewer';
      authenticated: boolean;
    },
    msg: Record<string, unknown>,
  ): void {
    const type = String(msg['type'] || '');

    if (type === 'auth') {
      const token = String(msg['token'] || '');
      const valid = this.options.userStore.validateSession(token);
      if (valid.valid && valid.user) {
        client.authenticated = true;
        client.userId = valid.user.id;
        client.role = valid.user.role;
        this.sendWsJson(client.socket, { type: 'auth_ok', user: valid.user });
      } else {
        this.sendWsJson(client.socket, { type: 'auth_error', message: 'Invalid session' });
      }
      return;
    }

    // WebRTC Signaling Exchange
    if (type === 'signal_offer' || type === 'signal_answer' || type === 'signal_ice') {
      // Broadcast signaling packets to interested peer clients
      for (const peer of this.wsClients) {
        if (peer !== client) {
          this.sendWsJson(peer.socket, msg);
        }
      }
      return;
    }

    // Remote Control Messages
    if (type === 'control_request') {
      if (!client.authenticated || !client.userId || !client.role) {
        this.sendWsJson(client.socket, {
          type: 'control_error',
          message: 'Authentication required',
        });
        return;
      }
      const targetDeviceId = String(msg['targetDeviceId'] || 'host-local');
      const targetDev = this.options.deviceManager.getDevice(targetDeviceId);

      const res = this.options.inputControl.requestControl({
        userId: client.userId,
        username: client.userId,
        userRole: client.role,
        targetDeviceId,
        isTargetSmaranInstalled: Boolean(targetDev?.isSmaranInstalled),
      });

      this.sendWsJson(client.socket, { type: 'control_response', ...res });
      return;
    }

    if (type === 'control_input') {
      const sessionId = String(msg['sessionId'] || '');
      const event = msg['event'] as InputEvent;
      if (sessionId && event) {
        this.options.inputControl.handleInput(sessionId, event);
      }
      return;
    }

    // Device Heartbeat from Sharing Agent
    if (type === 'heartbeat') {
      const token = String(msg['deviceToken'] || '');
      if (token) {
        this.options.deviceManager.recordHeartbeat(token);
      }
    }
  }

  private sendWsJson(socket: Socket, data: unknown): void {
    try {
      const text = JSON.stringify(data);
      const payload = Buffer.from(text, 'utf8');
      const len = payload.length;

      let frame: Buffer;
      if (len <= 125) {
        frame = Buffer.alloc(2 + len);
        frame[0] = 0x81; // FIN + text
        frame[1] = len;
        payload.copy(frame, 2);
      } else if (len <= 65535) {
        frame = Buffer.alloc(4 + len);
        frame[0] = 0x81;
        frame[1] = 126;
        frame.writeUInt16BE(len, 2);
        payload.copy(frame, 4);
      } else {
        frame = Buffer.alloc(10 + len);
        frame[0] = 0x81;
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(len), 2);
        payload.copy(frame, 10);
      }

      socket.write(frame);
    } catch {
      // socket write error
    }
  }

  // ---------- Built-in Responsive Web Client ----------

  private serveWebClient(res: ServerResponse): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Smaran Remote Hub</title>
  <style>
    :root {
      --bg: #0f1117;
      --card: #181b24;
      --border: #282d3d;
      --ink: #f0f3fa;
      --muted: #8b95a8;
      --accent: #38bdf8;
      --accent-soft: rgba(56, 189, 248, 0.12);
      --success: #34d399;
      --danger: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: var(--bg); color: var(--ink); padding: 24px; min-height: 100vh; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .logo-title { display: flex; align-items: center; gap: 12px; }
    .dots { display: grid; grid-template-columns: repeat(3, 6px); gap: 4px; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
    h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .card-title { font-size: 14px; font-weight: 600; color: var(--muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-val { font-size: 26px; font-weight: 700; color: var(--ink); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; background: var(--accent-soft); color: var(--accent); }
    .badge.green { background: rgba(52, 211, 153, 0.15); color: var(--success); }
    .streams-section h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
    .stream-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .stream-thumb { width: 100%; height: 160px; background: #000; display: flex; align-items: center; justify-content: center; position: relative; }
    .stream-thumb img { width: 100%; height: 100%; object-fit: contain; }
    .stream-info { padding: 14px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .stream-name { font-size: 15px; font-weight: 600; }
    .srt-box { margin-top: 8px; background: #12141c; border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-family: monospace; font-size: 11px; word-break: break-all; color: var(--accent); }
    .btn { background: var(--accent); color: #000; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 600; font-size: 13px; cursor: pointer; transition: opacity 0.2s; margin-top: 8px; }
    .btn:hover { opacity: 0.9; }
    .footer { text-align: center; font-size: 12px; color: var(--muted); margin-top: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-title">
      <div class="dots">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
      <h1>Smaran Remote Hub</h1>
    </div>
    <span class="badge green">● Live & Synchronized</span>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Server Status</div>
      <div class="stat-val" style="color: var(--success)">RUNNING</div>
      <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">TCP Port ${this.options.port} · Control & WebRTC</div>
    </div>
    <div class="card">
      <div class="card-title">Active Streams</div>
      <div class="stat-val" id="stat-streams">${this.options.streamManager.getStreamCount()}</div>
      <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Independent SRT pipelines active</div>
    </div>
    <div class="card">
      <div class="card-title">Registered Devices</div>
      <div class="stat-val">${this.options.deviceManager.listDevices().length}</div>
      <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Smaran Host & Participant Agents</div>
    </div>
  </div>

  <div class="streams-section">
    <h2>Available Screen & Window Streams</h2>
    <div class="grid" id="streams-grid">
      <div style="color: var(--muted); font-size: 13px;">Loading live streams...</div>
    </div>
  </div>

  <div class="footer">
    Smaran Remote Hub &copy; 2026 SahajS &middot; Secure Media & Remote Desktop Control
  </div>

  <script>
    async function loadStreams() {
      try {
        const res = await fetch('/api/streams');
        const data = await res.json();
        const grid = document.getElementById('streams-grid');
        if (!data.streams || data.streams.length === 0) {
          grid.innerHTML = '<div style="color: var(--muted); font-size: 13px;">No active streams currently shared. Open Smaran Remote Hub to broadcast screens or windows.</div>';
          return;
        }
        grid.innerHTML = data.streams.map(s => \`
          <div class="stream-card">
            <div class="stream-thumb">
              \${s.thumbnailUrl ? '<img src="' + s.thumbnailUrl + '" />' : '<span style="color:#666">Live Feed</span>'}
            </div>
            <div class="stream-info">
              <div class="stream-name">\${s.name}</div>
              <div style="font-size: 12px; color: var(--muted)">Source: \${s.sourceTitle} (\${s.sourceType}) &middot; \${s.resolution} @ \${s.fps}fps</div>
              \${s.srt && s.srt.enabled ? \`
                <div style="font-size: 11px; font-weight:600; margin-top:6px; color:var(--muted)">OBS / vMix SRT Input String:</div>
                <div class="srt-box">\${s.srt.obsSourceString || s.srt.url}</div>
              \` : ''}
              <button class="btn" onclick="copyText('\${s.srt ? s.srt.obsSourceString : ''}')">Copy SRT Endpoint</button>
            </div>
          </div>
        \`).join('');
      } catch (e) {
        console.error(e);
      }
    }
    function copyText(txt) {
      if (!txt) return;
      navigator.clipboard.writeText(txt);
      alert('SRT connection URL copied to clipboard!');
    }
    loadStreams();
    setInterval(loadStreams, 5000);
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
}
