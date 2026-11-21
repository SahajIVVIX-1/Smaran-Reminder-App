import { BrowserWindow } from 'electron';
import { IPC } from '@shared/channels';
import type {
  RemoteHubLogEntry,
  RemoteHubOverview,
  RemoteHubSettings,
  RemoteHubStream,
  RemoteHubUser,
  AvailableScreenSource,
  RemoteHubDevice,
  UserRole,
} from '@shared/remotehub';
import { RemoteHubConfigStore } from './RemoteHubConfigStore';
import { RemoteHubDeviceManager } from './RemoteHubDeviceManager';
import { RemoteHubInputControl } from './RemoteHubInputControl';
import { RemoteHubLogger } from './RemoteHubLogger';
import { RemoteHubServer } from './RemoteHubServer';
import { RemoteHubSrtManager } from './RemoteHubSrtManager';
import { RemoteHubStreamManager } from './RemoteHubStreamManager';
import { RemoteHubUserStore } from './RemoteHubUserStore';

export class RemoteHubManager {
  readonly configStore: RemoteHubConfigStore;
  readonly logger: RemoteHubLogger;
  readonly userStore: RemoteHubUserStore;
  readonly deviceManager: RemoteHubDeviceManager;
  readonly srtManager: RemoteHubSrtManager;
  readonly streamManager: RemoteHubStreamManager;
  readonly inputControl: RemoteHubInputControl;
  private server: RemoteHubServer;

  private onEventNotice?: (title: string, body: string, category?: string) => void;
  private onRecordHistory?: (title: string, detail?: string) => void;

  constructor(dataDir: string) {
    this.configStore = new RemoteHubConfigStore(dataDir);
    this.logger = new RemoteHubLogger();
    this.userStore = new RemoteHubUserStore(dataDir);
    this.deviceManager = new RemoteHubDeviceManager(dataDir);

    const settings = this.configStore.get();
    this.srtManager = new RemoteHubSrtManager(
      settings.srtBasePort,
      settings.srtDefaultLatencyMs,
      settings.bindAddress === '0.0.0.0' ? '127.0.0.1' : settings.bindAddress,
    );

    this.streamManager = new RemoteHubStreamManager(
      this.srtManager,
      () => this.server?.getLanIp() || '127.0.0.1',
    );

    this.inputControl = new RemoteHubInputControl(this.logger, settings.requireControlApproval);

    this.server = this.createServer(settings);

    // Watch logs and broadcast
    this.logger.onLog((entry) => {
      this.broadcast(IPC.remotehubLogAdded, entry);
    });

    // Auto-health check for devices
    setInterval(() => {
      this.deviceManager.checkDeviceHealth();
    }, 30_000);
  }

  setNoticeListener(
    notice: (title: string, body: string, category?: string) => void,
    recordHistory: (title: string, detail?: string) => void,
  ): void {
    this.onEventNotice = notice;
    this.onRecordHistory = recordHistory;
  }

  private createServer(settings: RemoteHubSettings): RemoteHubServer {
    return new RemoteHubServer({
      port: settings.port,
      bindAddress: settings.bindAddress,
      allowLan: settings.allowLan,
      userStore: this.userStore,
      deviceManager: this.deviceManager,
      streamManager: this.streamManager,
      inputControl: this.inputControl,
      logger: this.logger,
    });
  }

  getOverview(): RemoteHubOverview {
    const settings = this.configStore.get();
    const serverStatus = this.server.getStatus();
    const memUsage = process.memoryUsage();

    return {
      status: serverStatus,
      port: settings.port,
      bindAddress: settings.bindAddress,
      lanUrl: this.server.getLanUrl(),
      connectedUsers: this.server.getConnectedUsersCount(),
      connectedDevices: this.deviceManager.listDevices().length,
      activeStreams: this.streamManager.getStreamCount(),
      activeSessions: this.inputControl.getActiveSession() ? 1 : 0,
      cpuUsage: 0,
      ramUsageMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      uptimeSec: this.server.getUptime(),
      adminCreated: this.userStore.hasOwner(),
    };
  }

  async start(): Promise<{ ok: boolean; error?: string }> {
    const res = await this.server.start();
    this.notifyOverviewChanged();

    if (res.ok) {
      const lanUrl = this.server.getLanUrl();
      this.onEventNotice?.(
        'Remote Hub Server Started',
        `Remote Hub listening on port ${this.configStore.get().port} (${lanUrl})`,
        'fileserver',
      );
      this.onRecordHistory?.(
        'Remote Hub Started',
        `Web/Control Port ${this.configStore.get().port}`,
      );
    } else {
      this.onEventNotice?.(
        'Remote Hub Startup Failed',
        res.error || 'Port conflict or startup error.',
        'fileserver',
      );
    }

    return res;
  }

  async stop(): Promise<void> {
    await this.server.stop();
    this.streamManager.stopAllStreams();
    this.notifyOverviewChanged();

    this.onEventNotice?.(
      'Remote Hub Stopped',
      'Remote Hub Server terminated cleanly.',
      'fileserver',
    );
    this.onRecordHistory?.('Remote Hub Stopped');
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    await this.stop();
    return this.start();
  }

  getSettings(): RemoteHubSettings {
    return this.configStore.get();
  }

  updateSettings(patch: Partial<RemoteHubSettings>): RemoteHubSettings {
    const updated = this.configStore.update(patch);
    const wasRunning = this.server.getStatus() === 'running';

    // If port or binding changed, re-create server instance
    if (
      patch.port !== undefined ||
      patch.bindAddress !== undefined ||
      patch.allowLan !== undefined
    ) {
      if (wasRunning) {
        void this.server.stop().then(() => {
          this.server = this.createServer(updated);
          void this.server.start();
          this.notifyOverviewChanged();
        });
      } else {
        this.server = this.createServer(updated);
        this.notifyOverviewChanged();
      }
    }

    return updated;
  }

  createAdmin(username: string, pass: string, displayName: string): RemoteHubUser {
    const user = this.userStore.createOwner(username, pass, displayName);
    this.logger.info('auth', `Administrator account "${user.username}" created.`);
    this.onEventNotice?.('Admin Initialized', `Administrator account "${user.username}" created.`);
    this.notifyOverviewChanged();
    return user;
  }

  listUsers(): RemoteHubUser[] {
    return this.userStore.listUsers();
  }

  createUser(username: string, pass: string, displayName: string, role: UserRole): RemoteHubUser {
    const user = this.userStore.createUser(username, pass, displayName, role);
    this.logger.info('auth', `User "${user.username}" (${user.role}) created.`);
    return user;
  }

  updateUser(
    id: string,
    patch: { displayName?: string; role?: UserRole; enabled?: boolean; password?: string },
  ): RemoteHubUser {
    const user = this.userStore.updateUser(id, patch);
    this.logger.info('auth', `User "${user.username}" updated.`);
    return user;
  }

  deleteUser(id: string): boolean {
    const user = this.userStore.getUser(id);
    const success = this.userStore.deleteUser(id);
    if (success && user) {
      this.logger.info('auth', `User "${user.username}" deleted.`);
    }
    return success;
  }

  listDevices(): RemoteHubDevice[] {
    return this.deviceManager.listDevices();
  }

  generatePairingCode(): { code: string; expiresAt: number } {
    const pair = this.deviceManager.generatePairingCode();
    this.logger.info('device', `New 6-digit device pairing code generated: ${pair.code}`);
    return pair;
  }

  revokeDevice(deviceId: string): boolean {
    const res = this.deviceManager.revokeDevice(deviceId);
    if (res) {
      this.logger.security('device', `Device "${deviceId}" revoked.`);
      this.notifyOverviewChanged();
    }
    return res;
  }

  getAvailableSources(): Promise<AvailableScreenSource[]> {
    return this.streamManager.getAvailableSources();
  }

  listStreams(): RemoteHubStream[] {
    return this.streamManager.listStreams();
  }

  async startStream(params: {
    sourceId: string;
    name?: string;
    resolution?: string;
    fps?: number;
    bitrateKbps?: number;
    enableSrt?: boolean;
    srtMode?: 'caller' | 'listener';
    srtPort?: number;
    srtLatencyMs?: number;
    srtPassphrase?: string;
  }): Promise<RemoteHubStream> {
    const stream = await this.streamManager.startStream(params);
    this.logger.info(
      'stream',
      `Stream "${stream.name}" started (SRT Port: ${stream.srt.port || 'N/A'})`,
    );
    this.onEventNotice?.(
      'Stream Broadcast Started',
      `"${stream.name}" is now streaming via SRT on port ${stream.srt.port}`,
      'reminders',
    );
    this.notifyOverviewChanged();
    return stream;
  }

  stopStream(streamId: string): boolean {
    const stream = this.streamManager.getStream(streamId);
    const res = this.streamManager.stopStream(streamId);
    if (res && stream) {
      this.logger.info('stream', `Stream "${stream.name}" stopped.`);
      this.notifyOverviewChanged();
    }
    return res;
  }

  async updateStreamSrt(
    streamId: string,
    params: {
      mode?: 'caller' | 'listener';
      port?: number;
      latencyMs?: number;
      passphrase?: string;
    },
  ): Promise<RemoteHubStream> {
    const updated = await this.streamManager.updateStreamSrt(streamId, params);
    this.logger.info(
      'stream',
      `Stream "${updated.name}" SRT configuration updated (Port: ${updated.srt.port})`,
    );
    this.notifyOverviewChanged();
    return updated;
  }

  approveRemoteControl(sessionId: string): boolean {
    return this.inputControl.approveControl(sessionId);
  }

  revokeRemoteControl(): boolean {
    return this.inputControl.revokeControl();
  }

  getLogs(): RemoteHubLogEntry[] {
    return this.logger.getLogs();
  }

  clearLogs(): void {
    this.logger.clear();
  }

  stopSync(): void {
    try {
      this.streamManager.stopAllStreams();
      void this.server.stop();
    } catch {
      // ignore
    }
  }

  private notifyOverviewChanged(): void {
    this.broadcast(IPC.remotehubOverviewChanged, this.getOverview());
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send(channel, payload);
        } catch {
          // ignore
        }
      }
    }
  }
}
