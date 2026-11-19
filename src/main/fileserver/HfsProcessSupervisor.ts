import { ChildProcess, exec, execFile, spawn } from 'node:child_process';
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
import { DEFAULT_CUSTOM_HTML, syncHfsConfigFile } from './HfsConfigBridge';
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
  public readonly runtimeDir: string;
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
    try {
      if (typeof app?.getPath === 'function') {
        const docDir = app.getPath('documents');
        if (docDir) {
          return path.join(docDir, 'Smaran Files');
        }
      }
    } catch {
      // fallback
    }
    const home = os.homedir();
    return path.join(home, 'Documents', 'Smaran Files');
  }

  public getConfigYamlPath(): string {
    return this.configYamlPath;
  }

  public ensureCustomHtml(engineDir: string): void {
    if (path.resolve(engineDir) === path.resolve(this.runtimeDir)) {
      return;
    }
    const dstCustomHtml = path.join(this.runtimeDir, 'custom.html');
    if (!fs.existsSync(dstCustomHtml)) {
      const srcCustomHtml = path.join(engineDir, 'custom.html');
      if (fs.existsSync(srcCustomHtml)) {
        try {
          fs.copyFileSync(srcCustomHtml, dstCustomHtml);
          return;
        } catch {
          // Fallback
        }
      }
      try {
        fs.writeFileSync(dstCustomHtml, DEFAULT_CUSTOM_HTML, 'utf8');
      } catch (err) {
        console.warn('Failed to write custom.html to runtimeDir:', err);
      }
    }
  }

  public ensureBundledPlugins(engineDir: string): void {
    const srcPluginsDir = path.join(engineDir, 'plugins');
    const dstPluginsDir = path.join(this.runtimeDir, 'plugins');

    if (path.resolve(srcPluginsDir) === path.resolve(dstPluginsDir)) {
      return;
    }

    if (!fs.existsSync(srcPluginsDir)) {
      return;
    }

    if (!fs.existsSync(dstPluginsDir)) {
      fs.mkdirSync(dstPluginsDir, { recursive: true });
    }

    try {
      const plugins = fs.readdirSync(srcPluginsDir);
      for (const p of plugins) {
        const srcPath = path.join(srcPluginsDir, p);
        const dstPath = path.join(dstPluginsDir, p);
        if (!fs.existsSync(dstPath)) {
          fs.cpSync(srcPath, dstPath, { recursive: true });
        }
      }
    } catch (err) {
      console.warn('Failed copying bundled plugins to runtimeDir:', err);
    }
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

  public updateStatusPort(port: number): void {
    this.currentStatus.port = port;
    this.currentStatus.localUrl = `http://localhost:${port}`;
    this.currentStatus.lanUrls = this.getLanUrls(port);
    this.callbacks.onStatusChanged?.(this.getStatus());
  }

  public updateStatusRootDir(rootDir: string): void {
    this.currentStatus.rootDir = rootDir;
    this.callbacks.onStatusChanged?.(this.getStatus());
  }

  public ensureConfigFile(settings: FileServerSettings): void {
    if (!fs.existsSync(this.runtimeDir)) {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
    }

    const defaultDir = this.getDefaultStorageDir();
    if (!fs.existsSync(defaultDir)) {
      try {
        fs.mkdirSync(defaultDir, { recursive: true });
      } catch {
        // Handled in permission check
      }
    }

    syncHfsConfigFile(this.configYamlPath, {
      settings,
      adminPassword: settings.adminPassword,
      defaultStorageDir: defaultDir,
    });
  }

  public async updateAdminAccount(creds: {
    username: string;
    password: string;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const prevUsername = this.store.getSettings().adminUsername;
      this.store.updateSettings({
        adminUsername: creds.username,
        adminPassword: creds.password,
      });

      syncHfsConfigFile(this.configYamlPath, {
        settings: this.store.getSettings(),
        adminPassword: creds.password,
        previousAdminUsername: prevUsername,
        defaultStorageDir: this.getDefaultStorageDir(),
      });

      if (this.child) {
        await this.restart();
      }

      this.addLog('info', `Admin credentials updated for user "${creds.username}"`);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  public async ensureEngineExtracted(): Promise<void> {
    const runtimeScript = path.join(this.runtimeDir, 'src', 'index.js');
    const runtimePkg = path.join(this.runtimeDir, 'package.json');
    const runtimeCentral = path.join(this.runtimeDir, 'central.json');

    // If already extracted and verified, zero work needed
    if (fs.existsSync(runtimeScript) && fs.existsSync(runtimePkg) && fs.existsSync(runtimeCentral)) {
      return;
    }

    // Locate engine.tar.gz archive
    const resPath = process.resourcesPath || '';
    const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd();
    const candidateArchives = [
      path.join(resPath, 'engine.tar.gz'),
      path.join(resPath, 'resources', 'engine.tar.gz'),
      path.join(appPath, 'resources', 'engine.tar.gz'),
      path.join(__dirname, '..', '..', 'resources', 'engine.tar.gz'),
      path.join(process.cwd(), 'resources', 'engine.tar.gz'),
    ];

    let foundArchive: string | null = null;
    for (const archive of candidateArchives) {
      if (fs.existsSync(archive)) {
        foundArchive = archive;
        break;
      }
    }

    if (!foundArchive) {
      // In dev mode, uncompressed engine in resources/engine/dist may already exist
      return;
    }

    // Pre-extraction integrity verification
    const stat = fs.statSync(foundArchive);
    if (stat.size < 1_000_000) {
      const err = `HFS engine archive is incomplete or truncated (${stat.size} bytes): ${foundArchive}`;
      this.addLog('error', err);
      throw new Error(err);
    }

    if (!fs.existsSync(this.runtimeDir)) {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
    }

    this.addLog('info', 'Extracting self-contained Smaran HFS engine components...');
    const startTime = Date.now();

    try {
      await new Promise<void>((resolve, reject) => {
        execFile('tar.exe', ['-xzf', foundArchive, '-C', this.runtimeDir], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } catch (extractErr) {
      this.addLog('error', `Failed to extract HFS engine: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`);
      // Clean up partial extraction
      try {
        if (fs.existsSync(runtimeScript)) fs.rmSync(runtimeScript, { force: true });
      } catch {
        // Ignore cleanup failure
      }
      throw extractErr;
    }

    // Post-extraction verification
    if (!fs.existsSync(runtimeScript) || !fs.existsSync(runtimePkg) || !fs.existsSync(runtimeCentral)) {
      const missing = [
        !fs.existsSync(runtimeScript) ? 'src/index.js' : null,
        !fs.existsSync(runtimePkg) ? 'package.json' : null,
        !fs.existsSync(runtimeCentral) ? 'central.json' : null,
      ].filter(Boolean).join(', ');
      const err = `HFS engine extraction incomplete. Missing entry points: ${missing}`;
      this.addLog('error', err);
      throw new Error(err);
    }

    const elapsed = Date.now() - startTime;
    this.addLog('info', `Smaran HFS engine verified and ready in ${elapsed}ms.`);
  }

  public resolveEngineScript(): { scriptPath: string; engineDir: string } {
    // 1. Check if engine is extracted in runtimeDir
    const runtimeScript = path.join(this.runtimeDir, 'src', 'index.js');
    if (fs.existsSync(runtimeScript)) {
      return { scriptPath: runtimeScript, engineDir: this.runtimeDir };
    }

    // 2. Candidate uncompressed directories (e.g. dev mode fallback)
    const resPath = process.resourcesPath || '';
    const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd();
    const candidateDirs = [
      path.join(resPath, 'engine', 'dist'),
      path.join(resPath, 'resources', 'engine', 'dist'),
      path.join(appPath, 'resources', 'engine', 'dist'),
      path.join(__dirname, '..', '..', 'resources', 'engine', 'dist'),
      path.join(process.cwd(), 'resources', 'engine', 'dist'),
    ];

    for (const dir of candidateDirs) {
      const script = path.join(dir, 'src', 'index.js');
      if (fs.existsSync(script)) {
        return { scriptPath: script, engineDir: dir };
      }
    }

    throw new Error(
      `Smaran HFS engine script not found. Searched runtimeDir (${this.runtimeDir}) and candidate paths:\n${candidateDirs.map((d) => path.join(d, 'src', 'index.js')).join('\n')}`,
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

    // 2. Engine Extraction & File Resolution
    let engineInfo: { scriptPath: string; engineDir: string };
    try {
      await this.ensureEngineExtracted();
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

    // Ensure all bundled plugins and custom.html are copied to runtime directory
    this.ensureBundledPlugins(engineInfo.engineDir);
    this.ensureCustomHtml(engineInfo.engineDir);

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

    // 4. Ensure Config File & Determine Active Port
    this.ensureConfigFile(settings);
    const activePort = settings.port || 5901;

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

        const shouldRestart = !this.isStopping && this.store.getSettings().enabled;

        this.updateStatus({
          running: false,
          liveConnections: 0,
          error: this.isStopping
            ? undefined
            : this.startupErrorLogs.slice(-3).join('; ') || exitMsg,
        });

        if (shouldRestart) {
          this.addLog('info', 'Restarting Smaran HFS engine...');
          setTimeout(() => {
            if (!this.isStopping && this.store.getSettings().enabled) {
              void this.start();
            }
          }, 1500);
        }
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
