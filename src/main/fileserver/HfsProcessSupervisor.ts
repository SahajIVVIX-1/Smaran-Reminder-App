import { ChildProcess, execFile, execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import {
  FailedLoginRecordSchema,
  type FileServerSecurityEvent,
  type FileServerSettings,
  type HealthProbeLog,
  type LogLevel,
  type ServerLogEntry,
  type ServerStatus,
  type StartupDiagnosticInfo,
} from '@shared/fileserver';
import { cleanupStaleTempFiles, readValidatedJson, writeAtomicFile } from '../store/atomicFile';
import { HfsApiClient } from './HfsApiClient';
import { DEFAULT_CUSTOM_HTML, syncHfsConfigFile } from './HfsConfigBridge';
import type { FileServerStore } from './FileServerStore';
import { isLanIp, normalizeClientIp } from './ipUtils';
import { HfsOperationalLogger } from './HfsLogger';
import {
  authorizeFirewallRule,
  type FirewallStatus,
  isPortableExecutable,
  queryFirewallStatus,
  removeFirewallRule,
} from './windowsFirewall';

export interface SupervisorCallbacks {
  onStatusChanged?: (status: ServerStatus) => void;
  onLogAdded?: (log: ServerLogEntry) => void;
  onSecurityEvent?: (event: FileServerSecurityEvent) => void;
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
  private isStarting = false;
  public isQuitting = false;
  public startupTimeoutMs = 30000;
  private startupSpawnError: Error | null = null;
  private lastExitInfo: { code: number | null; signal: string | null; timestamp: number } | null = null;
  private lastStartupDiagnostic: StartupDiagnosticInfo | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private logs: ServerLogEntry[] = [];
  private startupErrorLogs: string[] = [];
  private currentStatus: ServerStatus;
  public static readonly FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
  public static readonly MAX_TRACKED_IPS = 500;
  public readonly failedLoginsPath: string;
  private failedAttemptsByIp = new Map<string, { count: number; lastTime: number }>();
  private startPromise: Promise<{ ok: boolean; error?: string }> | null = null;
  private logger: HfsOperationalLogger;

  constructor(
    dataDir: string,
    private readonly store: FileServerStore,
    private readonly callbacks: SupervisorCallbacks = {},
  ) {
    this.runtimeDir = path.join(dataDir, 'fileserver_engine');
    this.configYamlPath = path.join(this.runtimeDir, 'config.yaml');
    this.failedLoginsPath = path.join(dataDir, 'failed-logins.json');
    this.internalToken = crypto.randomUUID();
    this.logger = new HfsOperationalLogger(dataDir);
    this.loadFailedLogins();

    const settings = this.store.getSettings();
    this.currentStatus = {
      state: 'stopped',
      running: false,
      port: settings.port,
      localUrl: `http://localhost:${settings.port}`,
      lanUrls: this.getLanUrls(settings.port),
      liveConnections: 0,
      rootDir: settings.rootDir || this.getDefaultStorageDir(),
      lanAccessStatus: 'pending_check',
    };

    if (typeof app?.on === 'function') {
      app.on('before-quit', () => {
        this.killChildSync();
      });
    }

    process.on('exit', () => {
      this.killChildSync();
    });

    this.syncContextMenuIntegration();
  }

  getApiClient(): HfsApiClient | null {
    return this.apiClient;
  }

  getInternalToken(): string {
    return this.internalToken;
  }

  getStatus(): ServerStatus {
    const status = { ...this.currentStatus };
    // Clear stale license activation warning if license is currently valid
    if (
      status.error?.startsWith('License activation required') &&
      this.callbacks.isLicenseValid?.()
    ) {
      delete status.error;
      this.currentStatus.error = undefined;
      if (this.currentStatus.state === 'error') {
        this.currentStatus.state = this.child ? 'running' : 'stopped';
      }
    }
    return status;
  }

  getLogs(): ServerLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    this.logger.clear();
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
    const srcCustomHtml = path.join(engineDir, 'custom.html');
    if (fs.existsSync(srcCustomHtml)) {
      try {
        const srcContent = fs.readFileSync(srcCustomHtml, 'utf8');
        const dstContent = fs.existsSync(dstCustomHtml)
          ? fs.readFileSync(dstCustomHtml, 'utf8')
          : '';
        if (srcContent !== dstContent) {
          fs.writeFileSync(dstCustomHtml, srcContent, 'utf8');
        }
        return;
      } catch {
        // Fallback
      }
    }
    try {
      const dstContent = fs.existsSync(dstCustomHtml) ? fs.readFileSync(dstCustomHtml, 'utf8') : '';
      if (DEFAULT_CUSTOM_HTML !== dstContent) {
        fs.writeFileSync(dstCustomHtml, DEFAULT_CUSTOM_HTML, 'utf8');
      }
    } catch (err) {
      console.warn('Failed to write custom.html to runtimeDir:', err);
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
        fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
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
      this.emitAdminActivity(
        `Admin credentials updated for user "${creds.username}"`,
        creds.username,
      );
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  private flattenNestedDistIfNeeded(): void {
    const nestedDist = path.join(this.runtimeDir, 'dist');
    const nestedScript = path.join(nestedDist, 'src', 'index.js');
    if (fs.existsSync(nestedScript)) {
      try {
        const items = fs.readdirSync(nestedDist);
        for (const item of items) {
          const src = path.join(nestedDist, item);
          const dst = path.join(this.runtimeDir, item);
          if (fs.existsSync(dst)) {
            fs.rmSync(dst, { recursive: true, force: true });
          }
          fs.renameSync(src, dst);
        }
        try {
          fs.rmSync(nestedDist, { recursive: true, force: true });
        } catch {
          // ignore
        }
        this.addLog('info', 'Flattened nested engine directory into runtime root.');
      } catch (err) {
        this.addLog('warn', `Could not flatten nested engine dist: ${err}`);
      }
    }
  }

  public syncContextMenuIntegration(): void {
    if (process.platform !== 'win32') return;

    try {
      const runtimeIcon = path.join(this.runtimeDir, 'smaran.ico');
      const runtimeHfsIcon = path.join(this.runtimeDir, 'hfs.ico');

      // 1. Ensure runtime icons are updated with Smaran's branding icon
      const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd();
      const resPath = process.resourcesPath || '';
      const candidateIcons = [
        path.join(appPath, 'build', 'icon.ico'),
        path.join(resPath, 'icon.ico'),
        path.join(this.runtimeDir, 'smaran.ico'),
        path.join(this.runtimeDir, 'admin', 'favicon.ico'),
        path.join(this.runtimeDir, 'frontend', 'favicon.ico'),
      ];

      for (const icon of candidateIcons) {
        if (fs.existsSync(icon) && fs.statSync(icon).size > 50_000) {
          try {
            if (!fs.existsSync(this.runtimeDir)) {
              fs.mkdirSync(this.runtimeDir, { recursive: true });
            }
            fs.copyFileSync(icon, runtimeIcon);
            fs.copyFileSync(icon, runtimeHfsIcon);
            break;
          } catch {
            // ignore
          }
        }
      }

      // 2. Ensure extracted api.vfs.js has updated label
      const vfsScript = path.join(this.runtimeDir, 'src', 'api.vfs.js');
      if (fs.existsSync(vfsScript)) {
        try {
          const content = fs.readFileSync(vfsScript, 'utf8');
          if (content.includes('Add to HFS (new)')) {
            const updated = content
              .replace(/Add to HFS \(new\)/g, 'Add to Smaran HFS')
              .replace(
                /const_1\.APP_PATH \+ '\\\\hfs\.ico'/g,
                "const_1.APP_PATH + '\\\\smaran.ico'",
              );
            fs.writeFileSync(vfsScript, updated, 'utf8');
          }
        } catch {
          // ignore
        }
      }

      // 3. If Windows right-click registry entries exist, update them with Smaran branding
      const iconTarget = fs.existsSync(runtimeIcon) ? runtimeIcon : runtimeHfsIcon;
      execFile('reg.exe', ['query', 'HKCU\\Software\\Classes\\*\\shell\\AddToHFS3', '/ve'], { windowsHide: true }, (err, stdout) => {
        if (!err && stdout) {
          for (const k of ['*', 'Directory']) {
            execFile(
              'reg.exe',
              ['add', `HKCU\\Software\\Classes\\${k}\\shell\\AddToHFS3`, '/ve', '/f', '/d', 'Add to Smaran HFS'],
              { windowsHide: true },
            );
            if (fs.existsSync(iconTarget)) {
              execFile(
                'reg.exe',
                ['add', `HKCU\\Software\\Classes\\${k}\\shell\\AddToHFS3`, '/v', 'icon', '/f', '/d', iconTarget],
                { windowsHide: true },
              );
            }
          }
        }
      });

      // 4. Ensure runtime smaran-security plugin has required metadata
      const secPlugin = path.join(this.runtimeDir, 'plugins', 'smaran-security', 'plugin.js');
      if (fs.existsSync(secPlugin)) {
        try {
          const content = fs.readFileSync(secPlugin, 'utf8');
          if (!content.includes('apiRequired')) {
            const updated = content.replace(
              /exports\.version\s*=\s*[^;\n]+;?/,
              'exports.version = 3.4;\nexports.description = "Smaran security monitor — monitors login events, failed authentication attempts, and user activity for desktop notifications.";\nexports.apiRequired = 1;',
            );
            fs.writeFileSync(secPlugin, updated, 'utf8');
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  public async ensureEngineExtracted(): Promise<void> {
    this.flattenNestedDistIfNeeded();

    const runtimeScript = path.join(this.runtimeDir, 'src', 'index.js');
    const runtimePkg = path.join(this.runtimeDir, 'package.json');
    const runtimeCentral = path.join(this.runtimeDir, 'central.json');

    // If already extracted and verified, zero work needed
    if (
      fs.existsSync(runtimeScript) &&
      fs.existsSync(runtimePkg) &&
      fs.existsSync(runtimeCentral)
    ) {
      this.syncContextMenuIntegration();
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
      this.addLog(
        'error',
        `Failed to extract HFS engine: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`,
      );
      // Clean up partial extraction
      try {
        if (fs.existsSync(runtimeScript)) fs.rmSync(runtimeScript, { force: true });
      } catch {
        // Ignore cleanup failure
      }
      throw extractErr;
    }

    this.flattenNestedDistIfNeeded();

    // Post-extraction verification
    if (
      !fs.existsSync(runtimeScript) ||
      !fs.existsSync(runtimePkg) ||
      !fs.existsSync(runtimeCentral)
    ) {
      const missing = [
        !fs.existsSync(runtimeScript) ? 'src/index.js' : null,
        !fs.existsSync(runtimePkg) ? 'package.json' : null,
        !fs.existsSync(runtimeCentral) ? 'central.json' : null,
      ]
        .filter(Boolean)
        .join(', ');
      const err = `HFS engine extraction incomplete. Missing entry points: ${missing}`;
      this.addLog('error', err);
      throw new Error(err);
    }

    this.syncContextMenuIntegration();

    const elapsed = Date.now() - startTime;
    this.addLog('info', `Smaran HFS engine verified and ready in ${elapsed}ms.`);
  }

  public resolveEngineScript(): { scriptPath: string; engineDir: string } {
    // 1. Check if engine is extracted in runtimeDir
    const runtimeScript = path.join(this.runtimeDir, 'src', 'index.js');
    if (fs.existsSync(runtimeScript)) {
      return { scriptPath: runtimeScript, engineDir: this.runtimeDir };
    }

    // 1b. Check if nested dist exists in runtimeDir
    const nestedScript = path.join(this.runtimeDir, 'dist', 'src', 'index.js');
    if (fs.existsSync(nestedScript)) {
      return { scriptPath: nestedScript, engineDir: path.join(this.runtimeDir, 'dist') };
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

  private getLastExit(): { code: number | null; signal: string | null; timestamp: number } | null {
    return this.lastExitInfo;
  }

  start(): Promise<{ ok: boolean; error?: string }> {
    if (this.child && this.currentStatus.running) {
      return Promise.resolve({ ok: true });
    }
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = this.doStart().finally(() => {
      this.startPromise = null;
      this.isStarting = false;
    });
    return this.startPromise;
  }

  private detectSpecificStartupError(): string | null {
    const combined = [...this.startupErrorLogs, ...this.logs.map((l) => l.message)].join(' ');
    if (combined.includes('EADDRINUSE') || /address already in use/i.test(combined)) {
      return `Port ${this.currentStatus.port} is already in use by another application (EADDRINUSE).`;
    }
    if (combined.includes('EACCES') || /permission denied/i.test(combined)) {
      return `Access denied binding to port ${this.currentStatus.port} (EACCES).`;
    }
    if (combined.includes('EADDRNOTAVAIL') || /address not available/i.test(combined)) {
      return `Network address not available for port ${this.currentStatus.port} (EADDRNOTAVAIL).`;
    }
    if (/Cannot find module/i.test(combined)) {
      return `Missing runtime module dependency in HFS engine.`;
    }
    if (/SyntaxError/i.test(combined)) {
      return `Syntax error encountered during engine script execution.`;
    }
    return null;
  }

  private async doStart(): Promise<{ ok: boolean; error?: string }> {
    if (this.child && this.currentStatus.running) {
      return { ok: true };
    }

    const startTime = Date.now();
    this.isStopping = false;
    this.isStarting = true;
    this.startupSpawnError = null;
    this.lastExitInfo = null;
    this.startupErrorLogs = [];
    this.updateStatus({ state: 'starting', running: false, error: undefined });

    // 1. License Check
    if (this.callbacks.isLicenseValid && !this.callbacks.isLicenseValid()) {
      this.isStarting = false;
      const errorMsg =
        'License activation required. Smaran HFS will start after a valid license is activated.';
      this.addLog('warn', errorMsg);
      this.updateStatus({ state: 'error', running: false, error: errorMsg });
      return { ok: false, error: errorMsg };
    }

    // 2. Engine Extraction & File Resolution
    let extractionDurationMs: number | undefined;
    let engineInfo: { scriptPath: string; engineDir: string };
    try {
      const extStart = Date.now();
      await this.ensureEngineExtracted();
      extractionDurationMs = Date.now() - extStart;
      engineInfo = this.resolveEngineScript();
    } catch (resolveErr: unknown) {
      this.isStarting = false;
      const errorMsg = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
      this.addLog('error', errorMsg);
      this.updateStatus({ state: 'error', running: false, error: errorMsg });
      return { ok: false, error: errorMsg };
    }

    // Verify engine directory integrity
    const requiredFiles = ['package.json', 'central.json'];
    for (const reqFile of requiredFiles) {
      const fp = path.join(engineInfo.engineDir, reqFile);
      if (!fs.existsSync(fp)) {
        this.isStarting = false;
        const errorMsg = `Corrupt or incomplete HFS engine: missing ${reqFile} in ${engineInfo.engineDir}`;
        this.addLog('error', errorMsg);
        this.updateStatus({ state: 'error', running: false, error: errorMsg });
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
      this.isStarting = false;
      this.addLog('error', storagePerm.error || 'Permission denied for storage folder');
      this.updateStatus({ state: 'error', running: false, error: storagePerm.error });
      return { ok: false, error: storagePerm.error };
    }

    const runtimePerm = checkDirectoryPermissions(this.runtimeDir);
    if (!runtimePerm.ok) {
      this.isStarting = false;
      this.addLog('error', runtimePerm.error || 'Permission denied for runtime folder');
      this.updateStatus({ state: 'error', running: false, error: runtimePerm.error });
      return { ok: false, error: runtimePerm.error };
    }

    // 4. Ensure Config File & Determine Active Port
    this.ensureConfigFile(settings);
    const activePort = settings.port || 5901;

    // 5. Port Availability & Conflict Check
    const portCheck = await checkPortAvailable(activePort);
    if (!portCheck.available) {
      this.isStarting = false;
      this.addLog('error', portCheck.error || `Port ${activePort} is not available`);
      this.updateStatus({ state: 'error', running: false, error: portCheck.error });
      return { ok: false, error: portCheck.error };
    }

    try {
      this.addLog(
        'info',
        `Starting Smaran HFS on port ${activePort} (startup deadline: ${this.startupTimeoutMs}ms)...`,
      );

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

      // Redact passwords and tokens from logged arguments
      const sanitizedArgs = args.map((arg, idx) => {
        if (idx > 0 && (args[idx - 1] === '--token' || args[idx - 1] === '--password')) {
          return '••••••••';
        }
        return arg;
      });

      this.addLog('info', `Spawning engine: ${process.execPath} ${sanitizedArgs.join(' ')}`);

      this.child = spawn(process.execPath, args, {
        env: childEnv,
        cwd: this.runtimeDir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.apiClient = new HfsApiClient(activePort, this.internalToken);

      this.child.on('spawn', () => {
        this.addLog('info', `HFS engine process spawned with PID ${this.child?.pid}`);
      });

      this.child.on('error', (err: Error) => {
        this.startupSpawnError = err;
        this.addLog('error', `HFS engine process spawn error: ${err.message}`);
      });

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
        this.lastExitInfo = { code, signal, timestamp: Date.now() };
        const exitMsg = `HFS engine process exited (code=${code}, signal=${signal})`;
        this.addLog(this.isStopping ? 'info' : 'warn', exitMsg);

        const wasStarting = this.isStarting;
        this.stopHealthCheck();

        // If exited during startup, waitForHealthy will report the failure without auto-restart
        const shouldRestart =
          !this.isStopping &&
          !wasStarting &&
          this.currentStatus.state === 'running' &&
          this.store.getSettings().enabled;

        const hasErr = !this.isStopping && code !== 0 && code !== null;
        const specific = this.detectSpecificStartupError();
        const errStr = this.isStopping
          ? undefined
          : specific || this.startupErrorLogs.slice(-3).join('; ') || (hasErr ? exitMsg : undefined);

        if (!wasStarting) {
          this.child = null;
          this.apiClient = null;
          this.updateStatus({
            state: shouldRestart ? 'starting' : errStr ? 'error' : 'stopped',
            running: false,
            liveConnections: 0,
            error: errStr,
          });

          if (shouldRestart) {
            this.addLog('info', 'Restarting Smaran HFS engine...');
            setTimeout(() => {
              if (!this.isStopping && this.store.getSettings().enabled) {
                void this.start();
              }
            }, 1500);
          }
        }
      });

      this.child.on('close', () => {
        if (!this.isStarting && this.child) {
          this.child = null;
        }
      });

      const { healthProbes } = await this.waitForHealthy(activePort, this.startupTimeoutMs);

      this.isStarting = false;
      this.startHealthCheck();

      // Query Windows Firewall status for LAN access
      let fwStatus: FirewallStatus | undefined;
      try {
        fwStatus = await queryFirewallStatus();
      } catch {
        // Non-blocking
      }

      const lanAccessStatus = fwStatus
        ? fwStatus.hasRule && fwStatus.action === 'allow'
          ? 'authorized'
          : fwStatus.hasRule && fwStatus.action === 'block'
            ? 'unauthorized'
            : 'unauthorized'
        : 'unknown';

      this.updateStatus({
        state: 'running',
        running: true,
        port: activePort,
        localUrl: `http://localhost:${activePort}`,
        lanUrls: this.getLanUrls(activePort),
        rootDir,
        error: undefined,
        lanAccessStatus,
        firewallStatus: fwStatus
          ? {
              hasRule: fwStatus.hasRule,
              action: fwStatus.action,
              enabled: fwStatus.enabled,
              details: fwStatus.details,
            }
          : undefined,
      });

      const startupDurationMs = Date.now() - startTime;
      this.lastStartupDiagnostic = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        isPackaged: app?.isPackaged ?? false,
        isPortable: isPortableExecutable(),
        execPath: process.execPath,
        args: sanitizedArgs,
        port: activePort,
        pid: this.child?.pid ?? null,
        startupDurationMs,
        extractionDurationMs,
        healthCheckResults: healthProbes,
        firewallStatus: fwStatus
          ? {
              hasRule: fwStatus.hasRule,
              action: fwStatus.action,
              enabled: fwStatus.enabled,
              details: fwStatus.details,
            }
          : undefined,
        processErrors: [...this.startupErrorLogs],
        exitInfo: (() => {
          const exit = this.getLastExit();
          return exit ? { code: exit.code, signal: exit.signal } : undefined;
        })(),
      };

      this.addLog(
        'info',
        `Smaran HFS is ready and listening at http://localhost:${activePort} (started in ${startupDurationMs}ms)`,
      );
      if (fwStatus) {
        this.addLog('info', `LAN Access: ${fwStatus.details}`);
      }
      return { ok: true };
    } catch (err: unknown) {
      this.isStarting = false;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const specific = this.detectSpecificStartupError();
      const detail = specific
        ? ` [${specific}]`
        : this.startupErrorLogs.length > 0
          ? ` (${this.startupErrorLogs.slice(-2).join('; ')})`
          : '';
      const fullError = `${errorMsg}${detail}`;
      this.addLog('error', `Failed to start Smaran HFS: ${fullError}`);
      this.updateStatus({ state: 'error', running: false, error: fullError });
      await this.stop();
      return { ok: false, error: fullError };
    }
  }

  async stop(): Promise<void> {
    this.isStopping = true;
    this.isStarting = false;
    this.stopHealthCheck();
    this.updateStatus({ state: 'stopping', running: false });

    if (!this.child) {
      this.updateStatus({ state: 'stopped', running: false, liveConnections: 0 });
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
            execFile('taskkill.exe', ['/F', '/T', '/PID', String(pid)], { windowsHide: true }, () =>
              resolve(),
            );
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
    this.updateStatus({ state: 'stopped', running: false, liveConnections: 0 });
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    await this.stop();
    return this.start();
  }

  public stopSync(): void {
    this.isStopping = true;
    this.isStarting = false;
    this.isQuitting = true;
    this.stopHealthCheck();
    if (this.child?.pid) {
      try {
        execFileSync('taskkill.exe', ['/F', '/T', '/PID', String(this.child.pid)], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } catch {
        try {
          this.child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
      this.child = null;
    }
    this.apiClient = null;
    this.updateStatus({ state: 'stopped', running: false, liveConnections: 0 });
  }

  private killChildSync(): void {
    if (this.child?.pid) {
      try {
        execFileSync('taskkill.exe', ['/F', '/T', '/PID', String(this.child.pid)], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } catch {
        // Best effort
      }
      this.child = null;
    }
  }

  private async waitForHealthy(
    port: number,
    timeoutMs: number,
  ): Promise<{ healthProbes: HealthProbeLog[] }> {
    const start = Date.now();
    const healthProbes: HealthProbeLog[] = [];
    const pollInterval = 300;

    while (Date.now() - start < timeoutMs) {
      // 1. Process spawn error
      if (this.startupSpawnError) {
        throw new Error(`Failed to spawn HFS engine process: ${this.startupSpawnError.message}`);
      }

      // 2. Process exit during startup
      const exitAtPoll = this.getLastExit();
      if (exitAtPoll) {
        const specific = this.detectSpecificStartupError();
        const errDetail = specific || this.startupErrorLogs.slice(-3).join('; ');
        throw new Error(
          `HFS engine process terminated during startup (exit code: ${exitAtPoll.code ?? 'none'}, signal: ${exitAtPoll.signal ?? 'none'})${errDetail ? `: ${errDetail}` : ''}`,
        );
      }

      // 3. Probe loopback HTTP health with bounded timeout (1500ms)
      if (this.apiClient) {
        try {
          const probe = await this.apiClient.checkDetailedHealth(1500);
          healthProbes.push({
            timestamp: new Date().toISOString(),
            durationMs: probe.durationMs,
            status: probe.ok ? 'ok' : 'failed',
            statusCode: probe.statusCode,
            error: probe.error,
          });

          if (probe.ok) {
            // Localhost HTTP health verified!
            return { healthProbes };
          }
        } catch (probeErr: unknown) {
          const msg = probeErr instanceof Error ? probeErr.message : String(probeErr);
          healthProbes.push({
            timestamp: new Date().toISOString(),
            durationMs: 0,
            status: 'failed',
            error: msg,
          });
        }
      }

      // Check child exit again in case it exited during the probe
      const exitPostProbe = this.getLastExit();
      if (exitPostProbe) {
        const specific = this.detectSpecificStartupError();
        const errDetail = specific || this.startupErrorLogs.slice(-3).join('; ');
        throw new Error(
          `HFS engine process terminated during startup (exit code: ${exitPostProbe.code ?? 'none'}, signal: ${exitPostProbe.signal ?? 'none'})${errDetail ? `: ${errDetail}` : ''}`,
        );
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    const specific = this.detectSpecificStartupError();
    const errDetail = specific || this.startupErrorLogs.slice(-3).join('; ');
    const isAlive = Boolean(this.child && this.child.exitCode === null && !this.child.killed);

    throw new Error(
      `Server failed to respond on port ${port} within ${timeoutMs}ms${isAlive ? ` (Process PID ${this.child?.pid} is alive but unready)` : ''}${errDetail ? `: ${errDetail}` : ''}`,
    );
  }

  public getStartupDiagnostic(): StartupDiagnosticInfo | null {
    return this.lastStartupDiagnostic;
  }

  public exportDiagnostics(): string {
    const diag = this.lastStartupDiagnostic;
    const isWin = process.platform === 'win32';
    const lines: string[] = [
      '======================================================================',
      '              SMARAN FILE SERVER STARTUP DIAGNOSTICS                 ',
      '======================================================================',
      `Export Timestamp     : ${new Date().toISOString()}`,
      `Application Version  : 3.4.8`,
      `Node Version         : ${process.version}`,
      `Platform / Arch      : ${process.platform} (${process.arch})`,
      `Packaged Mode        : ${app?.isPackaged ?? false}`,
      `Portable Mode        : ${isPortableExecutable()}`,
      `Executable Path      : ${process.execPath}`,
      `Server State         : ${this.currentStatus.state}`,
      `Server Running       : ${this.currentStatus.running}`,
      `Configured Port      : ${this.currentStatus.port}`,
      `LAN Access Status    : ${this.currentStatus.lanAccessStatus || 'unknown'}`,
      '',
      '--- Firewall Information ---',
      `Firewall Supported   : ${isWin}`,
      `Firewall Rule Found  : ${diag?.firewallStatus?.hasRule ?? this.currentStatus.firewallStatus?.hasRule ?? false}`,
      `Firewall Action      : ${diag?.firewallStatus?.action ?? this.currentStatus.firewallStatus?.action ?? 'none'}`,
      `Firewall Rule Name   : ${diag?.firewallStatus?.details ?? this.currentStatus.firewallStatus?.details ?? 'N/A'}`,
      '',
      '--- Process Information ---',
      `Process PID          : ${this.child?.pid ?? diag?.pid ?? 'None'}`,
      `Process Arguments    : ${diag?.args ? diag.args.join(' ') : 'N/A'}`,
      `Startup Duration     : ${diag?.startupDurationMs ? `${diag.startupDurationMs}ms` : 'N/A'}`,
      `Extraction Duration  : ${diag?.extractionDurationMs ? `${diag.extractionDurationMs}ms` : 'None (Already extracted)'}`,
      `Process Spawned      : ${Boolean(this.child?.pid || diag?.pid)}`,
      `Exit Code            : ${this.lastExitInfo?.code ?? diag?.exitInfo?.code ?? 'N/A'}`,
      `Exit Signal          : ${this.lastExitInfo?.signal ?? diag?.exitInfo?.signal ?? 'N/A'}`,
      '',
      '--- Health Check Probes ---',
    ];

    if (diag?.healthCheckResults?.length) {
      for (const p of diag.healthCheckResults) {
        lines.push(
          `[${p.timestamp}] status=${p.status} code=${p.statusCode ?? 'none'} duration=${p.durationMs}ms ${p.error ? `err=${p.error}` : ''}`,
        );
      }
    } else {
      lines.push('No probe logs recorded.');
    }

    lines.push('', '--- Startup Process Errors (if any) ---');
    if (this.startupErrorLogs.length) {
      for (const err of this.startupErrorLogs) {
        lines.push(`  ${err}`);
      }
    } else {
      lines.push('  None recorded.');
    }

    lines.push('', '--- Recent Operational Logs (Sanitized) ---');
    const recentLogs = this.logs.slice(-30);
    for (const log of recentLogs) {
      lines.push(`[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`);
    }

    lines.push('======================================================================');
    return lines.join('\n');
  }

  public async getFirewallStatus(): Promise<FirewallStatus> {
    const status = await queryFirewallStatus();
    this.updateStatus({
      lanAccessStatus: status.hasRule && status.action === 'allow' ? 'authorized' : 'unauthorized',
      firewallStatus: {
        hasRule: status.hasRule,
        action: status.action,
        enabled: status.enabled,
        details: status.details,
      },
    });
    return status;
  }

  public async authorizeFirewall(): Promise<{ ok: boolean; message: string; error?: string }> {
    const res = await authorizeFirewallRule();
    await this.getFirewallStatus();
    return res;
  }

  public async removeFirewall(): Promise<{ ok: boolean; message: string; error?: string }> {
    const res = await removeFirewallRule();
    await this.getFirewallStatus();
    return res;
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
    const entry = this.logger.log(level, message, ip);
    this.logs.push(entry);
    if (this.logs.length > 500) {
      this.logs.shift();
    }
    this.callbacks.onLogAdded?.(entry);
  }

  private loadFailedLogins(): void {
    try {
      cleanupStaleTempFiles(path.dirname(this.failedLoginsPath), 'failed-logins.json');
      const res = readValidatedJson(this.failedLoginsPath, z.array(FailedLoginRecordSchema), []);
      const now = Date.now();
      this.failedAttemptsByIp.clear();
      for (const rec of res.data) {
        if (now - rec.lastTime < HfsProcessSupervisor.FAILED_LOGIN_WINDOW_MS) {
          this.failedAttemptsByIp.set(rec.ip, { count: rec.count, lastTime: rec.lastTime });
        }
      }
    } catch (err) {
      console.warn('[HfsSupervisor] Failed reading failed-logins.json:', err);
      this.failedAttemptsByIp.clear();
    }
  }

  private saveFailedLogins(): void {
    try {
      const now = Date.now();
      // 1. Evict expired entries
      for (const [ip, data] of this.failedAttemptsByIp.entries()) {
        if (now - data.lastTime >= HfsProcessSupervisor.FAILED_LOGIN_WINDOW_MS) {
          this.failedAttemptsByIp.delete(ip);
        }
      }

      // 2. Bound memory/disk size
      if (this.failedAttemptsByIp.size > HfsProcessSupervisor.MAX_TRACKED_IPS) {
        const sorted = Array.from(this.failedAttemptsByIp.entries()).sort(
          (a, b) => a[1].lastTime - b[1].lastTime,
        );
        const toRemove = sorted.slice(
          0,
          this.failedAttemptsByIp.size - HfsProcessSupervisor.MAX_TRACKED_IPS,
        );
        for (const [ip] of toRemove) {
          this.failedAttemptsByIp.delete(ip);
        }
      }

      // 3. Atomically write to disk
      const records = Array.from(this.failedAttemptsByIp.entries()).map(([ip, val]) => ({
        ip,
        count: val.count,
        lastTime: val.lastTime,
      }));
      writeAtomicFile(this.failedLoginsPath, JSON.stringify(records, null, 2), { backup: false });
    } catch (err) {
      console.warn('[HfsSupervisor] Failed persisting failed-logins.json:', err);
    }
  }

  public getFailedLoginAttempts(ip: string): number {
    const cleanIp = normalizeClientIp(ip);
    const existing = this.failedAttemptsByIp.get(cleanIp);
    if (!existing) return 0;
    if (Date.now() - existing.lastTime >= HfsProcessSupervisor.FAILED_LOGIN_WINDOW_MS) {
      this.failedAttemptsByIp.delete(cleanIp);
      this.saveFailedLogins();
      return 0;
    }
    return existing.count;
  }

  private handleSecurityEventLine(jsonStr: string): void {
    try {
      const raw = JSON.parse(jsonStr);
      const cleanIp = normalizeClientIp(raw.clientIp);
      const accessType = isLanIp(cleanIp) ? 'LAN' : 'External';

      let repeatCount = 1;
      if (raw.type === 'failedLogin') {
        const now = Date.now();
        const existing = this.failedAttemptsByIp.get(cleanIp);
        if (existing && now - existing.lastTime < HfsProcessSupervisor.FAILED_LOGIN_WINDOW_MS) {
          repeatCount = existing.count + 1;
          this.failedAttemptsByIp.set(cleanIp, { count: repeatCount, lastTime: now });
        } else {
          this.failedAttemptsByIp.set(cleanIp, { count: 1, lastTime: now });
        }
        this.saveFailedLogins();
      } else if (raw.type === 'login') {
        if (this.failedAttemptsByIp.has(cleanIp)) {
          this.failedAttemptsByIp.delete(cleanIp);
          this.saveFailedLogins();
        }
      }

      const event: FileServerSecurityEvent = {
        id: crypto.randomUUID(),
        type: raw.type,
        username: raw.username || 'unknown',
        clientIp: cleanIp,
        userAgent: raw.userAgent || 'Unknown Client',
        accessType,
        reason: raw.reason,
        repeatCount,
        timestamp: raw.timestamp || new Date().toISOString(),
        details: raw.details,
      };

      this.callbacks.onSecurityEvent?.(event);
    } catch (err) {
      console.warn('Failed parsing security event:', err);
    }
  }

  public emitAdminActivity(details: string, username = 'smaran'): void {
    if (this.isQuitting || this.isStopping) return;
    const event: FileServerSecurityEvent = {
      id: crypto.randomUUID(),
      type: 'adminActivity',
      username,
      clientIp: '127.0.0.1',
      userAgent: 'Smaran Desktop Admin',
      accessType: 'LAN',
      timestamp: new Date().toISOString(),
      details,
    };
    this.callbacks.onSecurityEvent?.(event);
  }

  private parseLogLine(line: string): void {
    if (line.includes('[SMARAN_SECURITY_EVENT]')) {
      const idx = line.indexOf('[SMARAN_SECURITY_EVENT]');
      const jsonStr = line.substring(idx + '[SMARAN_SECURITY_EVENT]'.length).trim();
      this.handleSecurityEventLine(jsonStr);
      return;
    }
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
