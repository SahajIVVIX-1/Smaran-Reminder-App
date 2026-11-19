import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BrowserWindow, dialog, shell } from 'electron';
import * as QRCode from 'qrcode';
import { IPC } from '@shared/channels';
import type { FileServerSettings, ServerLogEntry, ServerStatus } from '@shared/fileserver';
import { FileServerStore } from './FileServerStore';
import {
  checkDirectoryPermissions,
  checkPortAvailable,
  HfsProcessSupervisor,
} from './HfsProcessSupervisor';
import { generateHfsConfigYaml, syncHfsConfigFile } from './HfsConfigBridge';

const execAsync = promisify(exec);

export class FileServerManager {
  readonly store: FileServerStore;
  readonly supervisor: HfsProcessSupervisor;
  private syncQueue: Promise<unknown> = Promise.resolve();

  constructor(dataDir: string, isLicenseValid?: () => boolean) {
    this.store = new FileServerStore(dataDir);
    this.supervisor = new HfsProcessSupervisor(dataDir, this.store, {
      onStatusChanged: (status) => this.broadcast(IPC.fileserverStatusChanged, status),
      onLogAdded: (log) => this.broadcast(IPC.fileserverLogAdded, log),
      isLicenseValid,
    });
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
    return this.store.getSettings();
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

      if (patch.adminPassword !== undefined && !patch.adminPassword.trim()) {
        throw new Error('Admin password cannot be empty.');
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

      this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
      return updated;
    });
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    return this.queueOperation(async () => {
      const res = await this.supervisor.start();
      if (res.ok) {
        const settings = this.store.getSettings();
        if (settings.autoOpenAdminOnStart) {
          const port = this.getStatus().port || 5901;
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
      this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    });
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
    const target = folderPath ? folderPath : settings.rootDir || this.supervisor.getDefaultStorageDir();
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

  async getAdminCredentials(): Promise<{ username: string; password?: string }> {
    const settings = this.store.getSettings();
    return {
      username: settings.adminUsername || 'smaran',
      password: settings.adminPassword || 'smaran',
    };
  }

  async setAdminCredentials(creds: {
    username: string;
    password: string;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.updateSettings({
        adminUsername: creds.username,
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
        const defaultSettings: FileServerSettings = {
          enabled: true,
          port: 5901,
          rootDir: defaultDir,
          autoStart: true,
          autoOpenAdminOnStart: false,
          adminUsername: 'smaran',
          adminPassword: 'smaran',
        };

        this.store.updateSettings(defaultSettings);

        const yaml = generateHfsConfigYaml({
          settings: defaultSettings,
          users: [],
          adminPassword: 'smaran',
        });

        fs.writeFileSync(this.supervisor.getConfigYamlPath(), yaml, 'utf8');

        const engineInfo = this.supervisor.resolveEngineScript();
        this.supervisor.ensureBundledPlugins(engineInfo.engineDir);

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

    const drive = (payload?.driveLetter || 'Z:').toUpperCase().replace(/:?$/, ':');
    const settings = this.store.getSettings();
    const port = settings.port || 5901;
    const url = `http://127.0.0.1:${port}/`;
    const uncPath = `\\\\127.0.0.1@${port}\\DavWWWRoot`;
    const user = payload?.username || settings.adminUsername || 'smaran';
    const pwd = payload?.password || settings.adminPassword || 'smaran';

    try {
      // 1. Delete previous mapping on this drive letter if any
      try {
        await execAsync(`net use ${drive} /delete /yes`);
      } catch {
        // Ignored
      }

      // 2. Ensure WebClient service is running without throwing
      try {
        await execAsync(
          'powershell -NoProfile -Command "Get-Service WebClient -ErrorAction SilentlyContinue | Where-Object {$_.Status -ne \'Running\'} | Start-Service"',
        );
      } catch {
        // Ignored
      }

      // 3. Attempt mapping: try URL first, then UNC path fallback
      let lastErr: unknown = null;
      try {
        await execAsync(`net use ${drive} "${url}" "${pwd}" /user:"${user}" /persistent:yes`);
      } catch (err1) {
        lastErr = err1;
        try {
          await execAsync(`net use ${drive} "${uncPath}" "${pwd}" /user:"${user}" /persistent:yes`);
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
        await execAsync(`net use ${drive} /delete /yes`);
      } catch {
        // Ignored
      }

      const rawMsg = lastErr instanceof Error ? lastErr.message : String(lastErr || 'Drive not mounted');
      let friendlyError = rawMsg;
      if (rawMsg.includes('1244') || rawMsg.includes('authenticated') || rawMsg.includes('BasicAuth')) {
        friendlyError = `Windows WebClient rejected unencrypted HTTP authentication (Windows requires BasicAuthLevel=2 in registry for HTTP WebDAV). You can open WebDAV at ${url} directly in Windows Explorer ("Add a network location") or via Cyberduck/WinSCP.`;
      } else if (rawMsg.includes('85') || rawMsg.includes('already in use')) {
        friendlyError = `Drive letter ${drive} is already assigned to another network location.`;
      } else if (rawMsg.includes('67') || rawMsg.includes('network name cannot be found')) {
        friendlyError = `Windows could not reach the WebDAV endpoint on port ${port}. Ensure the WebClient Windows service is enabled.`;
      }

      return { ok: false, error: friendlyError };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  async unmountLocalDrive(driveLetter = 'Z:'): Promise<{ ok: boolean; error?: string }> {
    const drive = driveLetter.toUpperCase().replace(/:?$/, ':');
    try {
      await execAsync(`net use ${drive} /delete /yes`);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }
}
