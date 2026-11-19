import { ChildProcess, exec, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import type {
  FileServerSettings,
  LogLevel,
  ServerLogEntry,
  ServerStatus,
} from '@shared/fileserver';
import { HfsApiClient } from './HfsApiClient';
import { generateHfsConfigYaml } from './HfsConfigBridge';
import type { FileServerStore } from './FileServerStore';

export interface SupervisorCallbacks {
  onStatusChanged?: (status: ServerStatus) => void;
  onLogAdded?: (log: ServerLogEntry) => void;
  isLicenseValid?: () => boolean;
}

export async function checkPortAvailable(
  port: number,
): Promise<{ available: boolean; error?: string }> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return {
      available: false,
      error: `Invalid port number: ${port}. Port must be between 1 and 65535.`,
    };
  }
  if (port < 1024) {
    return {
      available: false,
      error: `Port ${port} is a system-privileged port (< 1024). Smaran runs as a standard user for security and does not request administrator privileges. Please configure a port number of 1024 or higher (e.g. 5901).`,
    };
  }
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve({
          available: false,
          error: `Port ${port} is already in use by another application. Please choose another port or close the conflicting application.`,
        });
      } else {
        resolve({ available: false, error: `Cannot bind to port ${port}: ${err.message}` });
      }
    });
    server.listen({ port, host: '127.0.0.1' }, () => {
      server.close(() => {
        resolve({ available: true });
      });
    });
  });
}

export function checkDirectoryPermissions(dirPath: string): { ok: boolean; error?: string } {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const testFile = path.join(dirPath, `.smaran_perm_test_${crypto.randomUUID()}`);
    fs.writeFileSync(testFile, 'smaran-ok', 'utf8');
    fs.unlinkSync(testFile);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Folder "${dirPath}" is not writable: ${msg}. Please choose a writable directory or check permissions.`,
    };
  }
}

export class HfsProcessSupervisor {
  private child: ChildProcess | null = null;
  private runtimeDir: string;
  private configYamlPath: string;
  private internalToken: string;
  private apiClient: HfsApiClient | null = null;
  private isStopping = false;
  private healthTimer: NodeJS.Timeout | null = null;
  private logs: ServerLogEntry[] = [];
  private startupErrorLogs: string[] = [];
  private currentStatus: ServerStatus;

  constructor(
    dataDir: string,
    private readonly store: FileServerStore,
    private readonly callbacks: SupervisorCallbacks = {},
  ) {
    this.runtimeDir = path.join(dataDir, 'fileserver_engine');
    this.configYamlPath = path.join(this.runtimeDir, 'config.yaml');
    this.internalToken = crypto.randomUUID();

    const settings = this.store.getSettings();
    this.currentStatus = {
      running: false,
      port: settings.port,
      localUrl: `http://localhost:${settings.port}`,
      lanUrls: this.getLanUrls(settings.port),
      liveConnections: 0,
      rootDir: settings.rootDir || this.getDefaultStorageDir(),
    };

    if (typeof app?.on === 'function') {
      app.on('before-quit', () => {
        this.killChildSync();
      });
    }

    process.on('exit', () => {
      this.killChildSync();
    });
  }

  getApiClient(): HfsApiClient | null {
    return this.apiClient;
  }

  getInternalToken(): string {
    return this.internalToken;
  }

  getStatus(): ServerStatus {
    return { ...this.currentStatus };
  }

  getLogs(): ServerLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  public getDefaultStorageDir(): string {
    const base = typeof app?.getPath === 'function' ? app.getPath('userData') : os.tmpdir();
    return path.join(base, 'Smaran Files');
  }

  private getLanUrls(port: number): string[] {
    const urls: string[] = [];
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          urls.push(`http://${net.address}:${port}`);
        }
      }
    }
    return urls;
  }

  private syncPortFromConfig(): number {
    const settings = this.store.getSettings();
    let port = settings.port;

    if (fs.existsSync(this.configYamlPath)) {
      try {
        const content = fs.readFileSync(this.configYamlPath, 'utf8');
        const match = content.match(/^port:\s*(\d+)/m);
        if (match && match[1]) {
          const yamlPort = parseInt(match[1], 10);
          if (yamlPort > 0 && yamlPort <= 65535) {
            port = yamlPort;
            if (settings.port !== port) {
              this.store.updateSettings({ port });
            }
          }
        }
      } catch (err) {
        console.warn('Could not read port from config.yaml:', err);
      }
    }
    return port;
  }

  private ensureConfigFile(settings: FileServerSettings): void {
    if (!fs.existsSync(this.runtimeDir)) {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
    }

    if (fs.existsSync(this.configYamlPath)) {
      try {
        let content = fs.readFileSync(this.configYamlPath, 'utf8');
        let modified = false;

        if (!content.includes('localhost_admin: false')) {
          content = content.replace(/localhost_admin:\s*\w+/g, 'localhost_admin: false');
          modified = true;
        }

        if (modified) {
          fs.writeFileSync(this.configYamlPath, content, 'utf8');
        }
        return;
      } catch (err) {
        console.error('Failed to verify config.yaml:', err);
      }
    }

    const defaultDir = this.getDefaultStorageDir();
    if (!fs.existsSync(defaultDir)) {
      try {
        fs.mkdirSync(defaultDir, { recursive: true });
      } catch {
        // Handled in permission check
      }
    }

    const yaml = generateHfsConfigYaml({
      settings: {
        ...settings,
        rootDir: settings.rootDir || defaultDir,
      },
      users: this.store.getUsers(),
      internalToken: this.internalToken,
      adminPassword: settings.adminPassword || 'smaran',
    });
    fs.writeFileSync(this.configYamlPath, yaml, 'utf8');
  }

  public async updateAdminAccount(creds: {
    username: string;
    password: string;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      this.store.updateSettings({
        adminUsername: creds.username,
        adminPassword: creds.password,
      });

      if (this.child && this.apiClient) {
        try {
          await this.apiClient.addAccount({
            username: creds.username,
            password: creds.password,
            admin: true,
          });
        } catch (apiErr) {
          console.warn(
            'Could not update running HFS account via API; saving to config.yaml:',
            apiErr,
          );
        }
      }

      if (fs.existsSync(this.configYamlPath)) {
        try {
          let content = fs.readFileSync(this.configYamlPath, 'utf8');
          const accountRegex = new RegExp(
            `(\\n\\s{2}${creds.username}:[\\s\\S]*?password:\\s*)("[^"]*"|'[^']*'|\\S+)`,
            'g',
          );
          if (accountRegex.test(content)) {
            content = content.replace(accountRegex, `$1"${creds.password}"`);
          } else if (content.includes('accounts:')) {
            const entry = `\n  ${creds.username}:\n    password: "${creds.password}"\n    admin: true`;
            content = content.replace('accounts:', `accounts:${entry}`);
          }
          fs.writeFileSync(this.configYamlPath, content, 'utf8');
        } catch (yamlErr) {
          console.error('Failed to rewrite config.yaml account:', yamlErr);
        }
      }

      this.addLog('info', `Admin credentials updated for user "${creds.username}"`);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  public resolveEngineScript(): { scriptPath: string; engineDir: string } {
    const resPath = process.resourcesPath || '';
    const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd();
    const candidateDirs = [
      path.join(resPath, 'engine', 'dist'),
      path.join(resPath, 'resources', 'engine', 'dist'),
      path.join(appPath, 'resources', 'engine', 'dist'),
      path.join(__dirname, '..', '..', 'resources', 'engine', 'dist'),
    ];

    for (const dir of candidateDirs) {
      const script = path.join(dir, 'src', 'index.js');
      if (fs.existsSync(script)) {
        return { scriptPath: script, engineDir: dir };
      }
    }

    throw new Error(
      `Smaran HFS engine script not found. Searched paths:\n${candidateDirs.map((d) => path.join(d, 'src', 'index.js')).join('\n')}`,
    );
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    if (this.child) {
      return { ok: true };
    }

    this.isStopping = false;
    this.startupErrorLogs = [];

    // 1. License Check
    if (this.callbacks.isLicenseValid && !this.callbacks.isLicenseValid()) {
      const errorMsg =
        'License activation required. Smaran HFS will start after a valid license is activated.';
      this.addLog('warn', errorMsg);
      this.updateStatus({ running: false, error: errorMsg });
      return { ok: false, error: errorMsg };
    }

    // 2. Engine File Resolution
    let engineInfo: { scriptPath: string; engineDir: string };
    try {
      engineInfo = this.resolveEngineScript();
    } catch (resolveErr: unknown) {
      const errorMsg = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
      this.addLog('error', errorMsg);
      this.updateStatus({ running: false, error: errorMsg });
      return { ok: false, error: errorMsg };
    }

    // Verify engine directory integrity
    const requiredFiles = ['package.json', 'central.json'];
    for (const reqFile of requiredFiles) {
      const fp = path.join(engineInfo.engineDir, reqFile);
      if (!fs.existsSync(fp)) {
        const errorMsg = `Corrupt or incomplete HFS engine: missing ${reqFile} in ${engineInfo.engineDir}`;
        this.addLog('error', errorMsg);
        this.updateStatus({ running: false, error: errorMsg });
        return { ok: false, error: errorMsg };
      }
    }

    const settings = this.store.getSettings();

    // 3. Storage Directory & Permission Check
    const rootDir = settings.rootDir || this.getDefaultStorageDir();
    const storagePerm = checkDirectoryPermissions(rootDir);
    if (!storagePerm.ok) {
      this.addLog('error', storagePerm.error || 'Permission denied for storage folder');
      this.updateStatus({ running: false, error: storagePerm.error });
      return { ok: false, error: storagePerm.error };
    }

    const runtimePerm = checkDirectoryPermissions(this.runtimeDir);
    if (!runtimePerm.ok) {
      this.addLog('error', runtimePerm.error || 'Permission denied for runtime folder');
      this.updateStatus({ running: false, error: runtimePerm.error });
      return { ok: false, error: runtimePerm.error };
    }

    // 4. Ensure Config File & Synchronize Port
    this.ensureConfigFile(settings);
    const activePort = this.syncPortFromConfig();

    // 5. Port Availability & Conflict Check
    const portCheck = await checkPortAvailable(activePort);
    if (!portCheck.available) {
      this.addLog('error', portCheck.error || `Port ${activePort} is not available`);
      this.updateStatus({ running: false, error: portCheck.error });
      return { ok: false, error: portCheck.error };
    }

    try {
      this.addLog('info', `Starting Smaran HFS on port ${activePort}...`);

      const childEnv = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        SMARAN_INTERNAL_TOKEN: this.internalToken,
        PORT: String(activePort),
      };

      const args = [
        engineInfo.scriptPath,
        '--cwd',
        this.runtimeDir,
        '--config',
        this.configYamlPath,
        '--port',
        String(activePort),
      ];

      this.child = spawn(process.execPath, args, {
        env: childEnv,
        cwd: this.runtimeDir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.apiClient = new HfsApiClient(activePort, this.internalToken);

      this.child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString('utf8').split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          this.parseLogLine(line);
        }
      });

      this.child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString('utf8').split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          this.startupErrorLogs.push(line);
          this.addLog('error', line);
        }
      });

      this.child.on('exit', (code, signal) => {
        const exitMsg = `HFS engine process exited (code=${code}, signal=${signal})`;
        this.addLog(this.isStopping ? 'info' : 'warn', exitMsg);
        this.child = null;
        this.apiClient = null;
        this.stopHealthCheck();

        this.updateStatus({
          running: false,
          liveConnections: 0,
          error: this.isStopping
            ? undefined
            : this.startupErrorLogs.slice(-3).join('; ') || exitMsg,
        });
      });

      await this.waitForHealthy(activePort, 12000);

      this.startHealthCheck();
      this.updateStatus({
        running: true,
        port: activePort,
        localUrl: `http://localhost:${activePort}`,
        lanUrls: this.getLanUrls(activePort),
        rootDir,
        error: undefined,
      });

      this.addLog('info', `Smaran HFS is ready and listening at http://localhost:${activePort}`);
      return { ok: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const detail =
        this.startupErrorLogs.length > 0 ? ` (${this.startupErrorLogs.slice(-2).join('; ')})` : '';
      const fullError = `${errorMsg}${detail}`;
      this.addLog('error', `Failed to start Smaran HFS: ${fullError}`);
      this.updateStatus({ running: false, error: fullError });
      await this.stop();
      return { ok: false, error: fullError };
    }
  }

  async stop(): Promise<void> {
    this.isStopping = true;
    this.stopHealthCheck();

    if (!this.child) {
      this.updateStatus({ running: false, liveConnections: 0 });
      return;
    }

    this.addLog('info', 'Stopping Smaran HFS...');

    if (this.apiClient) {
      try {
        await this.apiClient.quit();
      } catch {
        // Fallback to process kill
      }
    }

    if (this.child) {
      const pid = this.child.pid;
      this.child.kill('SIGTERM');

      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (pid) {
            exec(`taskkill /F /T /PID ${pid}`, () => resolve());
          } else {
            resolve();
          }
        }, 1500);

        this.child?.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    this.child = null;
    this.apiClient = null;
    this.updateStatus({ running: false, liveConnections: 0 });
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    await this.stop();
    return this.start();
  }

  private killChildSync(): void {
    if (this.child?.pid) {
      try {
        exec(`taskkill /F /T /PID ${this.child.pid}`);
      } catch {
        // Best effort
      }
      this.child = null;
    }
  }

  private async waitForHealthy(port: number, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.child?.exitCode !== null && this.child?.exitCode !== undefined) {
        const errDetail = this.startupErrorLogs.slice(-3).join('; ');
        throw new Error(
          `Engine process exited immediately with code ${this.child.exitCode}${errDetail ? `: ${errDetail}` : ''}`,
        );
      }
      try {
        if (this.apiClient) {
          const res = await this.apiClient.getStatus();
          if (res) return;
        }
      } catch {
        // If API is still initializing, check basic HTTP connectivity as fallback
        try {
          if (this.apiClient && (await this.apiClient.checkHttpHealth())) {
            return;
          }
        } catch {
          // Retry
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    const errDetail = this.startupErrorLogs.slice(-3).join('; ');
    throw new Error(
      `Server failed to respond on port ${port} within ${timeoutMs}ms${errDetail ? `: ${errDetail}` : ''}`,
    );
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthTimer = setInterval(async () => {
      if (!this.child || !this.apiClient) return;
      try {
        const conns = await this.apiClient.getConnections();
        const liveCount = conns?.connections?.length ?? 0;
        if (this.currentStatus.liveConnections !== liveCount) {
          this.updateStatus({ liveConnections: liveCount });
        }
      } catch {
        // Transient poll error
      }
    }, 3000);
  }

  private stopHealthCheck(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private updateStatus(patch: Partial<ServerStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...patch };
    this.callbacks.onStatusChanged?.(this.getStatus());
  }

  private addLog(level: LogLevel, message: string, ip?: string): void {
    const entry: ServerLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message,
      ip,
    };
    this.logs.push(entry);
    if (this.logs.length > 500) {
      this.logs.shift();
    }
    this.callbacks.onLogAdded?.(entry);
  }

  private parseLogLine(line: string): void {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('fail')) {
      this.addLog('error', line);
    } else if (lower.includes('warn')) {
      this.addLog('warn', line);
    } else {
      this.addLog('info', line);
    }
  }
}
