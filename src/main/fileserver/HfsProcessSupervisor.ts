import { execSync, spawn, type ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import type { FileServerSettings, LogLevel, ServerLogEntry, ServerStatus } from '@shared/fileserver';
import { HfsApiClient } from './HfsApiClient';
import { generateHfsConfigYaml } from './HfsConfigBridge';
import type { FileServerStore } from './FileServerStore';
import { buildServerUrls, getLanIps } from './network';

export interface HfsSupervisorEvents {
  onStatusChanged?: (status: ServerStatus) => void;
  onLogAdded?: (log: ServerLogEntry) => void;
}

export class HfsProcessSupervisor {
  private child: ChildProcess | null = null;
  private internalToken: string;
  private running = false;
  private runtimeDir: string;
  private configYamlPath: string;
  private startTime: Date | null = null;
  private lastError: string | null = null;
  readonly apiClient: HfsApiClient;

  constructor(
    private readonly store: FileServerStore,
    private readonly dataDir: string,
    private readonly events: HfsSupervisorEvents = {},
  ) {
    this.internalToken = crypto.randomBytes(32).toString('hex');
    this.runtimeDir = path.join(dataDir, 'fileserver_engine');
    this.configYamlPath = path.join(this.runtimeDir, 'config.yaml');

    this.apiClient = new HfsApiClient(
      () => this.store.getSettings().port,
      () => this.internalToken,
    );

    // Ensure clean teardown if host process exits
    const cleanExit = () => {
      this.forceKillSync();
    };
    process.once('exit', cleanExit);
    if (app) {
      app.once('before-quit', cleanExit);
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  get token(): string {
    return this.internalToken;
  }

  private resolveEngineLaunchConfig(settings: { port: number }): { runner: string; args: string[] } {
    const commonArgs = ['--cwd', this.runtimeDir, '--config', this.configYamlPath, '--port', String(settings.port)];

    if (process.env.SMARAN_HFS_ENGINE_PATH && fs.existsSync(process.env.SMARAN_HFS_ENGINE_PATH)) {
      const p = process.env.SMARAN_HFS_ENGINE_PATH;
      if (p.endsWith('.exe')) {
        return { runner: p, args: commonArgs };
      }
      return { runner: process.execPath, args: [p, ...commonArgs] };
    }

    // Check Electron packaged resources
    if (process.resourcesPath) {
      const candidates = [
        path.join(process.resourcesPath, 'resources', 'engine', 'dist', 'src', 'index.js'),
        path.join(process.resourcesPath, 'engine', 'dist', 'src', 'index.js'),
        path.join(process.resourcesPath, 'resources', 'engine', 'hfs.exe'),
        path.join(process.resourcesPath, 'engine', 'hfs.exe'),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          if (cand.endsWith('.exe')) return { runner: cand, args: commonArgs };
          return { runner: process.execPath, args: [cand, ...commonArgs] };
        }
      }
    }

    // Check workspace bundled resources
    try {
      const appRoot = app?.getAppPath ? app.getAppPath() : process.cwd();
      const workspaceJs = path.join(appRoot, 'resources', 'engine', 'dist', 'src', 'index.js');
      if (fs.existsSync(workspaceJs)) {
        return { runner: process.execPath, args: [workspaceJs, ...commonArgs] };
      }
    } catch {
      // ignore
    }

    // Check development exe
    const devExe = 'D:\\03_Projects\\hfs-3.4.1\\dist\\hfs.exe';
    if (fs.existsSync(devExe)) return { runner: devExe, args: commonArgs };

    // Check development js
    const devPath = 'D:\\03_Projects\\hfs-3.4.1\\dist\\src\\index.js';
    if (fs.existsSync(devPath)) return { runner: process.execPath, args: [devPath, ...commonArgs] };

    // Check relative repo path
    const relPath = path.resolve(__dirname, '../../../../hfs-3.4.1/dist/src/index.js');
    if (fs.existsSync(relPath)) return { runner: process.execPath, args: [relPath, ...commonArgs] };

    throw new Error(`Smaran HFS Engine could not be located. Checked ${devPath}`);
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    if (this.running) return { ok: true };

    try {
      const settings = this.store.getSettings();

      // Ensure storage directory
      fs.mkdirSync(settings.rootDir, { recursive: true });
      fs.mkdirSync(this.runtimeDir, { recursive: true });

      // Ensure config.yaml is prepared without destroying browser-admin edits
      this.ensureConfigFile(settings);

      const { runner, args } = this.resolveEngineLaunchConfig(settings);

      this.lastError = null;

      this.child = spawn(runner, args, {
        cwd: this.runtimeDir,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          SMARAN_INTERNAL_TOKEN: this.internalToken,
          NODE_ENV: 'production',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this.child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          this.emitLog('info', trimmed);
        }
      });

      this.child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          this.lastError = trimmed;
          this.emitLog('warn', trimmed);
        }
      });

      this.child.on('close', (code, signal) => {
        this.running = false;
        this.child = null;
        this.emitLog('info', `HFS engine process stopped (code=${code}, signal=${signal})`);
        this.events.onStatusChanged?.(this.getStatus());
      });

      // Await server readiness via API ping
      const ready = await this.waitForReady(settings.port, 10000);
      if (!ready) {
        await this.stop();
        return {
          ok: false,
          error: this.lastError || 'HFS engine timed out before becoming responsive on port ' + settings.port,
        };
      }

      this.running = true;
      this.startTime = new Date();
      this.events.onStatusChanged?.(this.getStatus());
      return { ok: true };
    } catch (err) {
      this.running = false;
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      return { ok: false, error: msg };
    }
  }

  async stop(): Promise<void> {
    if (!this.child) {
      this.running = false;
      return;
    }

    const pid = this.child.pid;
    this.running = false;

    // Gracefully ask HFS to quit via its internal API
    try {
      await this.apiClient.quit();
    } catch {
      // ignore
    }

    // Wait up to 2 seconds for graceful exit
    const exitedGracefully = await new Promise<boolean>((resolve) => {
      if (!this.child) return resolve(true);
      const timer = setTimeout(() => resolve(false), 2000);
      this.child.once('close', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });

    if (!exitedGracefully && pid) {
      this.killPidTree(pid);
    }

    this.child = null;
    this.events.onStatusChanged?.(this.getStatus());
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    await this.stop();
    return this.start();
  }

  private async waitForReady(port: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!this.child || this.child.exitCode !== null) return false;
      try {
        const st = await this.apiClient.getStatus();
        if (st && st.http?.listening) {
          return true;
        }
      } catch {
        // Not ready yet, retry
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    return false;
  }

  private ensureConfigFile(settings: FileServerSettings): void {
    if (!fs.existsSync(this.configYamlPath)) {
      const users = this.store.getUsers();
      const vfsNodes = this.store.getVfsNodes();
      const adminPass = settings.adminPassword || 'smaran@123';
      const configYaml = generateHfsConfigYaml({
        settings,
        users,
        vfsNodes,
        adminPassword: adminPass,
      });
      fs.writeFileSync(this.configYamlPath, configYaml, 'utf8');
      return;
    }

    // Preserve all browser-admin changes (VFS nodes, users, plugins, options)!
    // Only verify critical parameters (port, localhost_admin: false)
    try {
      let content = fs.readFileSync(this.configYamlPath, 'utf8');
      let changed = false;

      // Ensure localhost_admin is false
      if (!/localhost_admin:\s*false/i.test(content)) {
        if (/localhost_admin:\s*true/i.test(content)) {
          content = content.replace(/localhost_admin:\s*true/i, 'localhost_admin: false');
          changed = true;
        } else {
          content = `localhost_admin: false\n` + content;
          changed = true;
        }
      }

      // Ensure port is in sync
      const portRegex = /port:\s*(\d+)/i;
      const match = content.match(portRegex);
      if (match && Number(match[1]) !== settings.port) {
        content = content.replace(portRegex, `port: ${settings.port}`);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(this.configYamlPath, content, 'utf8');
      }
    } catch (err) {
      console.warn('Failed to verify existing config.yaml:', err);
    }
  }

  async updateAdminAccount(username: string, password: string, oldUsername?: string): Promise<void> {
    if (this.running) {
      try {
        await this.apiClient.callApi('add_account', {
          overwrite: true,
          username,
          password,
          admin: true,
        });
        if (oldUsername && oldUsername.toLowerCase() !== username.toLowerCase()) {
          await this.apiClient.callApi('del_account', { username: oldUsername }).catch(() => {});
        }
        return;
      } catch (err) {
        console.warn('Live HFS API add_account failed, falling back to disk update:', err);
      }
    }

    // When stopped or if API failed, update config.yaml on disk directly
    try {
      if (fs.existsSync(this.configYamlPath)) {
        let content = fs.readFileSync(this.configYamlPath, 'utf8');
        const oldName = oldUsername || 'smaran';
        const oldEscaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const userBlockRegex = new RegExp(
          `(\\s{2}${oldEscaped}:[\\s\\S]*?)(?=\\n\\s{2}[a-zA-Z0-9_"-]+:|\\n[a-zA-Z0-9_"-]+:|$)`,
          'i',
        );
        const newBlock = `  ${JSON.stringify(username)}:\n    admin: true\n    password: ${JSON.stringify(password)}`;

        if (/accounts:/i.test(content)) {
          if (userBlockRegex.test(content)) {
            content = content.replace(userBlockRegex, newBlock);
          } else {
            content = content.replace(/accounts:/i, `accounts:\n${newBlock}`);
          }
        } else {
          content += `\naccounts:\n${newBlock}\n`;
        }
        fs.writeFileSync(this.configYamlPath, content, 'utf8');
      }
    } catch (err) {
      console.warn('Failed to update admin account in config.yaml:', err);
    }
  }

  private forceKillSync(): void {
    if (this.child?.pid) {
      this.killPidTree(this.child.pid);
      this.child = null;
      this.running = false;
    }
  }

  private killPidTree(pid: number): void {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pid} >nul 2>&1`);
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Process might already be dead
    }
  }

  private emitLog(level: LogLevel, message: string): void {
    const entry: ServerLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      clientIp: '127.0.0.1',
      message,
    };
    this.events.onLogAdded?.(entry);
  }

  getStatus(): ServerStatus {
    const settings = this.store.getSettings();
    const port = settings.port;
    const running = this.running;
    const uptimeSeconds = this.startTime && running ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;
    const lanIps = getLanIps();
    const { localUrl, lanUrls } = buildServerUrls(port, lanIps, settings.httpsEnabled);

    return {
      running,
      port,
      bindAddress: settings.bindAddress,
      serverName: settings.serverName,
      rootDir: settings.rootDir,
      uptimeSeconds,
      lanIps,
      localUrl,
      lanUrls,
      externalUrl: null,
      connectedClients: running ? 1 : 0,
      activeTransfers: [],
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
      currentUploadSpeedBps: 0,
      currentDownloadSpeedBps: 0,
      authEnabled: settings.authEnabled,
      guestAccess: settings.guestAccess,
      upnpMapped: false,
      publicIp: '',
      liveConnections: [],
      error: this.lastError || undefined,
    };
  }
}
