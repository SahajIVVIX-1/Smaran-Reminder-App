import crypto from 'node:crypto';
import { desktopCapturer } from 'electron';
import type {
  AvailableScreenSource,
  RemoteHubStream,
  RemoteHubSrtConfig,
  StreamSourceType,
} from '@shared/remotehub';
import { RemoteHubSrtManager } from './RemoteHubSrtManager';

export class RemoteHubStreamManager {
  private readonly streams = new Map<string, RemoteHubStream>();

  constructor(
    private readonly srtManager: RemoteHubSrtManager,
    private readonly getHostIp: () => string,
  ) {}

  /**
   * Discovers physical screens and application windows available for sharing on this PC.
   */
  async getAvailableSources(): Promise<AvailableScreenSource[]> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });

      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: (s.id.startsWith('screen') ? 'display' : 'window') as StreamSourceType,
        thumbnailUrl: s.thumbnail.toDataURL(),
        displayId: s.display_id,
      }));
    } catch (err) {
      console.warn('[RemoteHubStreamManager] Error fetching desktopCapturer sources:', err);
      return [];
    }
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
    const streamId = `stream-${crypto.randomBytes(4).toString('hex')}`;
    const sources = await this.getAvailableSources();
    const source = sources.find((s) => s.id === params.sourceId);

    const streamName = params.name?.trim() || source?.name || `Stream ${this.streams.size + 1}`;

    const sourceType: StreamSourceType = params.sourceId.startsWith('screen')
      ? 'display'
      : 'window';

    // Initialize SRT output if requested
    let srtConfig: RemoteHubSrtConfig;
    if (params.enableSrt !== false) {
      srtConfig = await this.srtManager.createOrUpdateSrt(
        {
          streamId,
          name: streamName,
          mode: params.srtMode ?? 'listener',
          port: params.srtPort,
          latencyMs: params.srtLatencyMs,
          passphrase: params.srtPassphrase,
        },
        this.getHostIp(),
      );
    } else {
      srtConfig = {
        enabled: false,
        mode: 'listener',
        port: 0,
        latencyMs: 120,
        url: '',
        status: 'idle',
        obsSourceString: '',
        vMixString: '',
      };
    }

    const stream: RemoteHubStream = {
      id: streamId,
      name: streamName,
      sourceType,
      sourceId: params.sourceId,
      sourceTitle: source?.name || streamName,
      ownerDeviceId: 'host-local',
      ownerDeviceName: 'This PC (Smaran Host)',
      status: 'streaming',
      resolution: params.resolution || '1080p',
      fps: params.fps || 30,
      bitrateKbps: params.bitrateKbps || 4000,
      thumbnailUrl: source?.thumbnailUrl,
      startedAt: new Date().toISOString(),
      viewersCount: 0,
      srt: srtConfig,
    };

    this.streams.set(streamId, stream);
    return stream;
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
    const stream = this.streams.get(streamId);
    if (!stream) throw new Error('Stream not found.');

    const updatedSrt = await this.srtManager.createOrUpdateSrt(
      {
        streamId,
        name: stream.name,
        mode: params.mode,
        port: params.port,
        latencyMs: params.latencyMs,
        passphrase: params.passphrase,
      },
      this.getHostIp(),
    );

    stream.srt = updatedSrt;
    return stream;
  }

  stopStream(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (!stream) return false;

    this.srtManager.stopSrt(streamId);
    stream.status = 'idle';
    this.streams.delete(streamId);
    return true;
  }

  stopAllStreams(): void {
    for (const [id] of this.streams) {
      this.srtManager.stopSrt(id);
    }
    this.streams.clear();
  }

  listStreams(): RemoteHubStream[] {
    return Array.from(this.streams.values());
  }

  getStream(id: string): RemoteHubStream | undefined {
    return this.streams.get(id);
  }

  getStreamCount(): number {
    return this.streams.size;
  }
}
