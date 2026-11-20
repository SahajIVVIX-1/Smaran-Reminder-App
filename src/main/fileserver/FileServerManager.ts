import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { BrowserWindow, dialog, shell } from 'electron';
import * as QRCode from 'qrcode';
import { IPC } from '@shared/channels';
import type {
  FileServerAuditFilter,
  FileServerSecurityEvent,
  FileServerSettings,
  SafeAdminCredentials,
  ServerLogEntry,
  ServerStatus,
  StartupDiagnosticInfo,
} from '@shared/fileserver';
import { FileServerAuditStore } from './FileServerAuditStore';
import {
  FileServerStore,
  generateDefaultAdminPassword,
  validateAdminPassword,
} from './FileServerStore';
import {
  checkDirectoryPermissions,
  checkPortAvailable,
  HfsProcessSupervisor,
} from './HfsProcessSupervisor';
import {
  DEFAULT_CUSTOM_HTML,
  generateHfsConfigYaml,
  generateMountBatScript,
  syncHfsConfigFile,
} from './HfsConfigBridge';
import {
  backupWebClientRegistry,
  restartWebClientService,
  restoreWebClientRegistry,
  runElevatedReg,
} from './webdavRegistry';
import { type FirewallStatus } from './windowsFirewall';
import { normalizeClientIp } from './ipUtils';

export function validateDriveLetter(driveLetter?: string): string {
  const target = (driveLetter || 'Z:').trim().toUpperCase();
  const match = /^([A-Z]):?$/.exec(target);
  if (!match) {
    throw new Error(`Invalid drive letter: "${driveLetter}". Drive letter must be a single letter from A to Z.`);
  }
  return `${match[1]}:`;
}

export function validateCredentialInput(value: string, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) {
      throw new Error(`${fieldName} contains invalid control characters.`);
    }
  }
  return value;
}

export function execFilePromise(file: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export class FileServerManager {
  readonly store: FileServerStore;
  readonly supervisor: HfsProcessSupervisor;
  readonly auditStore: FileServerAuditStore;
  private syncQueue: Promise<unknown> = Promise.resolve();
  private onSecurityEventCallback?: (event: FileServerSecurityEvent) => void;

  constructor(readonly dataDir: string, isLicenseValid?: () => boolean) {
    this.store = new FileServerStore(dataDir);
    this.auditStore = new FileServerAuditStore(dataDir);
    this.supervisor = new HfsProcessSupervisor(dataDir, this.store, {
      onStatusChanged: (status) => this.broadcast(IPC.fileserverStatusChanged, status),
      onLogAdded: (log) => this.broadcast(IPC.fileserverLogAdded, log),
      onSecurityEvent: (event) => this.handleSecurityEvent(event),
      isLicenseValid,
    });
  }

  public setSecurityEventListener(listener: (event: FileServerSecurityEvent) => void): void {
    this.onSecurityEventCallback = listener;
  }

  public getSecurityEvents(filter?: FileServerAuditFilter): FileServerSecurityEvent[] {
    return this.auditStore.getEvents(filter);
  }

  private handleSecurityEvent(event: FileServerSecurityEvent): void {
    this.auditStore.add(event);
    this.onSecurityEventCallback?.(event);
  }

  private queueOperation<T>(op: () => Promise<T>): Promise<T> {
    const next = this.syncQueue.then(op, op);
    this.syncQueue = next.catch(() => {});
    return next;
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  }

  getStatus(): ServerStatus {
    return this.supervisor.getStatus();
  }

  getSettings(): FileServerSettings {
    return this.store.getSafeSettings();
  }

  async updateSettings(patch: Partial<FileServerSettings>): Promise<FileServerSettings> {
    return this.queueOperation(async () => {
      const prevSettings = this.store.getSettings();
      const isRunning = this.getStatus().running;

      // 1. Validation
      if (patch.port !== undefined) {
        if (!Number.isInteger(patch.port) || patch.port < 1024 || patch.port > 65535) {
          throw new Error('Port must be an integer between 1024 and 65535.');
        }
        if (isRunning && patch.port !== prevSettings.port) {
          const avail = await checkPortAvailable(patch.port);
          if (!avail.available) {
            throw new Error(avail.error || `Port ${patch.port} is already in use.`);
          }
        }
      }

      if (patch.rootDir !== undefined && patch.rootDir !== '') {
        const perm = checkDirectoryPermissions(patch.rootDir);
        if (!perm.ok) {
          throw new Error(perm.error || `Folder "${patch.rootDir}" is not accessible.`);
        }
      }

      if (patch.adminUsername !== undefined && !patch.adminUsername.trim()) {
        throw new Error('Admin username cannot be empty.');
      }

      if (patch.adminPassword !== undefined) {
        const val = validateAdminPassword(patch.adminPassword);
        if (!val.ok) {
          throw new Error(val.error);
        }
      }

      // 2. Persist to store
      const updated = this.store.updateSettings(patch);

      // 3. Synchronize config.yaml
      syncHfsConfigFile(this.supervisor.getConfigYamlPath(), {
        settings: updated,
        adminPassword: updated.adminPassword,
        previousAdminUsername: prevSettings.adminUsername,
        defaultStorageDir: this.supervisor.getDefaultStorageDir(),
      });

      // 4. If running, restart if engine configuration changed
      const needsRestart =
        isRunning &&
        (patch.port !== undefined ||
          patch.rootDir !== undefined ||
          patch.adminUsername !== undefined ||
          patch.adminPassword !== undefined);

      if (needsRestart) {
        const restartRes = await this.supervisor.restart();
        if (!restartRes.ok) {
          // Attempt rollback
          this.store.updateSettings(prevSettings);
          syncHfsConfigFile(this.supervisor.getConfigYamlPath(), {
            settings: prevSettings,
            adminPassword: prevSettings.adminPassword,
            defaultStorageDir: this.supervisor.getDefaultStorageDir(),
          });
          await this.supervisor.restart();
          throw new Error(restartRes.error || 'Failed to restart server with new settings');
        }
      } else if (!isRunning) {
        if (patch.port !== undefined) {
          this.supervisor.updateStatusPort(patch.port);
        }
        if (patch.rootDir !== undefined) {
          this.supervisor.updateStatusRootDir(patch.rootDir);
        }
      }

      if (patch.port !== undefined && patch.port !== prevSettings.port) {
        this.supervisor.emitAdminActivity(
          `Server port changed from ${prevSettings.port} to ${patch.port}`,
        );
      }
      if (patch.rootDir !== undefined && patch.rootDir !== prevSettings.rootDir) {
        this.supervisor.emitAdminActivity(
          `Storage root directory changed to "${patch.rootDir || 'default'}"`,
        );
      }
      if (patch.enabled !== undefined && patch.enabled !== prevSettings.enabled) {
        this.supervisor.emitAdminActivity(`File server ${patch.enabled ? 'enabled' : 'disabled'}`);
      }

      this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
      return this.store.getSafeSettings();
    });
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    return this.queueOperation(async () => {
      const res = await this.supervisor.start();
      if (res.ok) {
        const port = this.getStatus().port || 5901;
        this.supervisor.emitAdminActivity(`File server started on port ${port}`);
        const settings = this.store.getSettings();
        if (settings.autoOpenAdminOnStart) {
          const adminUrl = `http://localhost:${port}/~/admin/`;
          void shell.openExternal(adminUrl);
        }
      }
      this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
      return res;
    });
  }

  async stop(): Promise<void> {
    return this.queueOperation(async () => {
      await this.supervisor.stop();
      if (!this.supervisor.isQuitting) {
        this.supervisor.emitAdminActivity('File server stopped');
      }
      this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    });
  }

  stopSync(): void {
    this.supervisor.stopSync();
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    return this.queueOperation(async () => {
      const res = await this.supervisor.restart();
      this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
      return res;
    });
  }

  getLogs(): ServerLogEntry[] {
    return this.supervisor.getLogs();
  }

  clearLogs(): void {
    this.supervisor.clearLogs();
  }

  async getFirewallStatus(): Promise<FirewallStatus> {
    const status = await this.supervisor.getFirewallStatus();
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    return status;
  }

  async authorizeFirewall(): Promise<{ ok: boolean; message: string; error?: string }> {
    const res = await this.supervisor.authorizeFirewall();
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    return res;
  }

  async removeFirewall(): Promise<{ ok: boolean; message: string; error?: string }> {
    const res = await this.supervisor.removeFirewall();
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    return res;
  }

  getDiagnostics(): StartupDiagnosticInfo | null {
    return this.supervisor.getStartupDiagnostic();
  }

  exportDiagnostics(): string {
    return this.supervisor.exportDiagnostics();
  }

  async pickRootDir(): Promise<string | null> {
    const res = await dialog.showOpenDialog({
      title: 'Select Smaran HFS Root Storage Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!res.canceled && res.filePaths.length > 0) {
      const picked = res.filePaths[0];
      if (picked) {
        await this.updateSettings({ rootDir: picked });
        return picked;
      }
    }
    return null;
  }

  async openFolder(folderPath?: string): Promise<void> {
    const settings = this.store.getSettings();
    const target = folderPath
      ? folderPath
      : settings.rootDir || this.supervisor.getDefaultStorageDir();
    if (target) {
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
      await shell.openPath(target);
    }
  }

  async generateQr(url: string): Promise<string> {
    try {
      return await QRCode.toDataURL(url, {
        margin: 1,
        color: {
          dark: '#e06c43',
          light: '#0c0c0e',
        },
      });
    } catch {
      return '';
    }
  }

  async getAdminCredentials(): Promise<SafeAdminCredentials> {
    return this.store.getSafeAdminCredentials();
  }

  async setAdminCredentials(creds: {
    username: string;
    password: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const val = validateAdminPassword(creds.password);
    if (!val.ok) {
      return { ok: false, error: val.error };
    }
    if (!creds.username || !creds.username.trim()) {
      return { ok: false, error: 'Admin username cannot be empty.' };
    }
    try {
      await this.updateSettings({
        adminUsername: creds.username.trim(),
        adminPassword: creds.password,
      });
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  async resetDefaults(): Promise<{ ok: boolean; error?: string }> {
    return this.queueOperation(async () => {
      try {
        await this.supervisor.stop();

        const defaultDir = this.supervisor.getDefaultStorageDir();
        const freshPassword = generateDefaultAdminPassword();
        const defaultSettings: FileServerSettings = {
          enabled: false,
          port: 5901,
          rootDir: defaultDir,
          autoStart: false,
          autoOpenAdminOnStart: false,
          adminUsername: 'smaran',
          adminPassword: freshPassword,
          notifyOnLogin: true,
          notifyOnFailedLogin: true,
          notifyOnAdminActivity: true,
        };

        this.store.updateSettings(defaultSettings);

        const yaml = generateHfsConfigYaml({
          settings: defaultSettings,
          users: [],
          adminPassword: freshPassword,
        });

        fs.writeFileSync(this.supervisor.getConfigYamlPath(), yaml, 'utf8');

        // Reset custom.html to default theme error pages and web client WebDAV helper
        const customHtmlPath = path.join(this.supervisor.runtimeDir, 'custom.html');
        try {
          fs.writeFileSync(customHtmlPath, DEFAULT_CUSTOM_HTML, 'utf8');
        } catch {
          // ignore
        }

        const engineInfo = this.supervisor.resolveEngineScript();
        this.supervisor.ensureBundledPlugins(engineInfo.engineDir);
        this.supervisor.ensureCustomHtml(engineInfo.engineDir);

        const res = await this.supervisor.start();
        this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
        return res;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    });
  }

  async mountLocalDrive(payload?: {
    driveLetter?: string;
    username?: string;
    password?: string;
  }): Promise<{ ok: boolean; driveLetter?: string; error?: string }> {
    if (!this.getStatus().running) {
      return {
        ok: false,
        error: 'Smaran HFS server is not running. Please start the server first before mounting.',
      };
    }

    const drive = validateDriveLetter(payload?.driveLetter);
    const settings = this.store.getSettings();
    const port = settings.port || 5901;
    const url = `http://127.0.0.1:${port}/`;
    const uncPath = `\\\\127.0.0.1@${port}\\DavWWWRoot`;
    const user = validateCredentialInput(payload?.username || settings.adminUsername || 'admin', 'Username');
    const pwd = validateCredentialInput(payload?.password || settings.adminPassword, 'Password');

    try {
      // 1. Delete previous mapping on this drive letter if any
      try {
        await execFilePromise('net.exe', ['use', drive, '/delete', '/yes']);
      } catch {
        // Ignored
      }

      // 2. Ensure WebClient service is running without throwing
      try {
        await execFilePromise('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "Get-Service WebClient -ErrorAction SilentlyContinue | Where-Object {$_.Status -ne 'Running'} | Start-Service",
        ]);
      } catch {
        // Ignored
      }

      // 3. Attempt mapping: try URL first, then UNC path fallback
      let lastErr: unknown = null;
      try {
        await execFilePromise('net.exe', ['use', drive, url, pwd, `/user:${user}`, '/persistent:yes']);
      } catch (err1) {
        lastErr = err1;
        try {
          await execFilePromise('net.exe', ['use', drive, uncPath, pwd, `/user:${user}`, '/persistent:yes']);
          lastErr = null;
        } catch (err2) {
          lastErr = err2;
        }
      }

      // 4. VERIFY MOUNT: Never report success without verification
      let verified = false;
      try {
        if (fs.existsSync(`${drive}\\`)) {
          verified = true;
        }
      } catch {
        verified = false;
      }

      if (verified) {
        void shell.openPath(`${drive}\\`);
        return { ok: true, driveLetter: drive };
      }

      // If not verified, unmount cleanly and provide clear diagnostic guidance
      try {
        await execFilePromise('net.exe', ['use', drive, '/delete', '/yes']);
      } catch {
        // Ignored
      }

      const rawMsg =
        lastErr instanceof Error ? lastErr.message : String(lastErr || 'Drive not mounted');
      let friendlyError = rawMsg;
      if (
        rawMsg.includes('1244') ||
        rawMsg.includes('authenticated') ||
        rawMsg.includes('BasicAuth')
      ) {
        friendlyError = `Windows WebClient rejected unencrypted HTTP authentication (Windows requires BasicAuthLevel=2 in registry for HTTP WebDAV). Click "Enable WebDAV on this PC" to configure Windows automatically.`;
      } else if (rawMsg.includes('85') || rawMsg.includes('already in use')) {
        friendlyError = `Drive letter ${drive} is already assigned to another network location.`;
      } else if (rawMsg.includes('67') || rawMsg.includes('network name cannot be found')) {
        friendlyError = `Windows could not reach the WebDAV endpoint on port ${port}. Windows WebClient service is stopped or requires BasicAuthLevel=2. Click "Enable WebDAV on this PC" below to configure Windows automatically.`;
      }

      return { ok: false, error: friendlyError };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  async enableWebClientService(): Promise<{ ok: boolean; error?: string }> {
    try {
      await backupWebClientRegistry(this.dataDir);
      await runElevatedReg([
        'add',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\WebClient\\Parameters',
        '/v',
        'BasicAuthLevel',
        '/t',
        'REG_DWORD',
        '/d',
        '2',
        '/f',
      ]);
      await runElevatedReg([
        'add',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\WebClient\\Parameters',
        '/v',
        'FileSizeLimitInBytes',
        '/t',
        'REG_DWORD',
        '/d',
        '4294967295',
        '/f',
      ]);
      await restartWebClientService();
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  async restoreWebClientService(): Promise<{ ok: boolean; error?: string }> {
    const res = await restoreWebClientRegistry(this.dataDir);
    return { ok: res.ok, error: res.error };
  }

  async exportMountScript(): Promise<{ ok: boolean; filePath?: string; error?: string }> {
    try {
      const settings = this.store.getSettings();
      const port = settings.port || 5901;
      const status = this.getStatus();
      let ip = '127.0.0.1';
      if (status.lanUrls?.[0]) {
        try {
          ip = new URL(status.lanUrls[0]).hostname;
        } catch {
          // fallback
        }
      }

      const script = generateMountBatScript(ip, port);
      const res = await dialog.showSaveDialog({
        title: 'Export Windows WebDAV Mount Script',
        defaultPath: 'mount-smaran-drive.bat',
        filters: [{ name: 'Batch Script (*.bat)', extensions: ['bat'] }],
      });

      if (!res.canceled && res.filePath) {
        fs.writeFileSync(res.filePath, script, 'utf8');
        return { ok: true, filePath: res.filePath };
      }
      return { ok: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  async unmountLocalDrive(driveLetter = 'Z:'): Promise<{ ok: boolean; error?: string }> {
    try {
      const drive = validateDriveLetter(driveLetter);
      await execFilePromise('net.exe', ['use', drive, '/delete', '/yes']);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  async getSessions(): Promise<Array<{ id: string; ip: string; speed?: number }>> {
    const api = this.supervisor.getApiClient();
    if (!api) return [];
    try {
      const res = await api.getConnections();
      return (res?.connections || []).map((c) => ({
        ...c,
        ip: normalizeClientIp(c.ip),
      }));
    } catch {
      return [];
    }
  }

  async disconnectSession(id: string): Promise<{ ok: boolean }> {
    const api = this.supervisor.getApiClient();
    if (!api) return { ok: false };
    try {
      return await api.disconnect(id);
    } catch {
      return { ok: false };
    }
  }
}
