import { ChildProcess, exec, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import type { FileServerSettings, LogLevel, ServerLogEntry, ServerStatus } from '@shared/fileserver';
import { HfsApiClient } from './HfsApiClient';
import { generateHfsConfigYaml } from './HfsConfigBridge';
import type { FileServerStore } from './FileServerStore';

export interface SupervisorCallbacks {
  onStatusChanged?: (status: ServerStatus) => void;
  onLogAdded?: (log: ServerLogEntry) => void;
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
  private currentStatus: ServerStatus;

  constructor(
    dataDir: string,
    private readonly store: FileServerStore,
    private readonly callbacks: SupervisorCallbacks = {}
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

    app.on('before-quit', () => {
      this.killChildSync();
    });

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

  private getDefaultStorageDir(): string {
    return path.join(app.getPath('userData'), 'Smaran Files');
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

  private ensureConfigFile(settings: FileServerSettings): void {
    if (!fs.existsSync(this.runtimeDir)) {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
    }

    if (fs.existsSync(this.configYamlPath)) {
      try {
        let content = fs.readFileSync(this.configYamlPath, 'utf8');
        if (!content.includes('localhost_admin: false')) {
          content = content.replace(/localhost_admin:\s*\w+/g, 'localhost_admin: false');
          fs.writeFileSync(this.configYamlPath, content, 'utf8');
        }
        return;
      } catch (err) {
        console.error('Failed to verify config.yaml:', err);
      }
    }

    const yaml = generateHfsConfigYaml({
      settings,
      users: this.store.getUsers(),
      internalToken: this.internalToken,
      adminPassword: settings.adminPassword || 'smaran@123',
    });
    fs.writeFileSync(this.configYamlPath, yaml, 'utf8');
  }

  public async updateAdminAccount(creds: { username: string; password: string }): Promise<{ ok: boolean; error?: string }> {
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
          console.warn('Could not update running HFS account via API; saving to config.yaml:', apiErr);
        }
      }

      if (fs.existsSync(this.configYamlPath)) {
        try {
          let content = fs.readFileSync(this.configYamlPath, 'utf8');
          const accountRegex = new RegExp(`(\\n\\s{2}${creds.username}:[\\s\\S]*?password:\\s*)("[^"]*"|'[^']*'|\\S+)`, 'g');
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

  private resolveEngineScript(): string {
    const candidates = [
      path.join(process.resourcesPath, 'resources', 'engine', 'dist', 'src', 'index.js'),
      path.join(process.resourcesPath, 'engine', 'dist', 'src', 'index.js'),
      path.join(app.getAppPath(), 'resources', 'engine', 'dist', 'src', 'index.js'),
      path.join(__dirname, '..', '..', 'resources', 'engine', 'dist', 'src', 'index.js'),
      'D:\\03_Projects\\hfs-3.4.1\\dist\\src\\index.js',
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }

    throw new Error(`Smaran HFS engine script not found. Searched paths:\n${candidates.join('\n')}`);
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    if (this.child) {
      return { ok: true };
    }

    this.isStopping = false;
    const settings = this.store.getSettings();

    try {
      this.ensureConfigFile(settings);
      const engineScript = this.resolveEngineScript();

      this.addLog('info', `Starting Smaran HFS on port ${settings.port}...`);

      const childEnv = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        SMARAN_INTERNAL_TOKEN: this.internalToken,
        PORT: String(settings.port),
      };

      const args = [
        engineScript,
        '--cwd',
        this.runtimeDir,
        '--config',
        this.configYamlPath,
      ];

      this.child = spawn(process.execPath, args, {
        env: childEnv,
        cwd: this.runtimeDir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.apiClient = new HfsApiClient(settings.port, this.internalToken);

      this.child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString('utf8').split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          this.parseLogLine(line);
        }
      });

      this.child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString('utf8').split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          this.addLog('warn', line);
        }
      });

      this.child.on('exit', (code, signal) => {
        const exitMsg = `HFS process exited (code=${code}, signal=${signal})`;
        this.addLog(this.isStopping ? 'info' : 'warn', exitMsg);
        this.child = null;
        this.apiClient = null;
        this.stopHealthCheck();

        this.updateStatus({
          running: false,
          liveConnections: 0,
        });
      });

      await this.waitForHealthy(settings.port, 6000);

      this.startHealthCheck();
      this.updateStatus({
        running: true,
        port: settings.port,
        localUrl: `http://localhost:${settings.port}`,
        lanUrls: this.getLanUrls(settings.port),
        rootDir: settings.rootDir || this.getDefaultStorageDir(),
        error: undefined,
      });

      this.addLog('info', `Smaran HFS is ready at http://localhost:${settings.port}`);
      return { ok: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.addLog('error', `Failed to start Smaran HFS: ${errorMsg}`);
      this.updateStatus({ running: false, error: errorMsg });
      await this.stop();
      return { ok: false, error: errorMsg };
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
        throw new Error(`Engine process exited immediately with code ${this.child.exitCode}`);
      }
      try {
        if (this.apiClient) {
          const res = await this.apiClient.getStatus();
          if (res) return;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Server failed to respond within ${timeoutMs}ms`);
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
        // Ignore transient poll error
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
