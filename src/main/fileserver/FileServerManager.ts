import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BrowserWindow, dialog, shell } from 'electron';
import * as QRCode from 'qrcode';
import { IPC } from '@shared/channels';
import type { FileServerSettings, ServerLogEntry, ServerStatus } from '@shared/fileserver';
import { FileServerStore } from './FileServerStore';
import { HfsProcessSupervisor } from './HfsProcessSupervisor';

const execAsync = promisify(exec);

export class FileServerManager {
  readonly store: FileServerStore;
  readonly supervisor: HfsProcessSupervisor;

  constructor(dataDir: string, isLicenseValid?: () => boolean) {
    this.store = new FileServerStore(dataDir);
    this.supervisor = new HfsProcessSupervisor(dataDir, this.store, {
      onStatusChanged: (status) => this.broadcast(IPC.fileserverStatusChanged, status),
      onLogAdded: (log) => this.broadcast(IPC.fileserverLogAdded, log),
      isLicenseValid,
    });
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
    const updated = this.store.updateSettings(patch);
    if (patch.port !== undefined && this.getStatus().running) {
      await this.supervisor.restart();
    }
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    return updated;
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    const res = await this.supervisor.start();
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    return res;
  }

  async stop(): Promise<void> {
    await this.supervisor.stop();
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    const res = await this.supervisor.restart();
    this.broadcast(IPC.fileserverStatusChanged, this.getStatus());
    return res;
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
    const target = folderPath ? folderPath : settings.rootDir;
    if (target) {
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
    return this.supervisor.updateAdminAccount(creds);
  }

  async mountLocalDrive(payload?: {
    driveLetter?: string;
    username?: string;
    password?: string;
  }): Promise<{ ok: boolean; driveLetter?: string; error?: string }> {
    const drive = (payload?.driveLetter || 'Z:').toUpperCase().replace(/:?$/, ':');
    const settings = this.store.getSettings();
    const port = settings.port || 5901;
    const url = `http://127.0.0.1:${port}/`;
    const user = payload?.username || settings.adminUsername || 'smaran';
    const pwd = payload?.password || settings.adminPassword || 'smaran';

    try {
      try {
        await execAsync(`net use ${drive} /delete /yes`);
      } catch {
        // Ignored if drive wasn't mounted
      }

      await execAsync('sc config WebClient start= auto');
      await execAsync('net start WebClient');

      await execAsync(`net use ${drive} "${url}" "${pwd}" /user:"${user}" /persistent:yes`);
      void shell.openPath(`${drive}\\`);

      return { ok: true, driveLetter: drive };
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
