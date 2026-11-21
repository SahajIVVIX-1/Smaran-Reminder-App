import net from 'node:net';
import type { RemoteHubSrtConfig, SrtMode } from '@shared/remotehub';

export interface SrtStreamRequest {
  streamId: string;
  name: string;
  mode?: SrtMode;
  port?: number;
  latencyMs?: number;
  passphrase?: string;
}

export class RemoteHubSrtManager {
  private readonly streamSrtConfigs = new Map<string, RemoteHubSrtConfig>();
  private allocatedPorts = new Set<number>();

  constructor(
    private readonly basePort = 6000,
    private readonly defaultLatencyMs = 120,
    private readonly hostIp = '127.0.0.1',
  ) {}

  /**
   * Allocates a non-conflicting port for a new SRT stream.
   */
  async allocatePort(preferredPort?: number): Promise<number> {
    if (preferredPort && !this.allocatedPorts.has(preferredPort)) {
      const isAvailable = await this.probePortAvailable(preferredPort);
      if (isAvailable) {
        this.allocatedPorts.add(preferredPort);
        return preferredPort;
      }
    }

    let candidate = this.basePort;
    while (candidate < 65000) {
      if (!this.allocatedPorts.has(candidate)) {
        const isAvailable = await this.probePortAvailable(candidate);
        if (isAvailable) {
          this.allocatedPorts.add(candidate);
          return candidate;
        }
      }
      candidate += 2; // Step by 2
    }

    throw new Error('Unable to allocate an available SRT port.');
  }

  releasePort(port: number): void {
    this.allocatedPorts.delete(port);
  }

  async createOrUpdateSrt(
    req: SrtStreamRequest,
    currentHostIp: string = this.hostIp,
  ): Promise<RemoteHubSrtConfig> {
    const existing = this.streamSrtConfigs.get(req.streamId);
    let port = req.port ?? existing?.port;

    if (!port) {
      port = await this.allocatePort();
    } else if (port !== existing?.port) {
      if (existing?.port) this.releasePort(existing.port);
      port = await this.allocatePort(port);
    }

    const mode = req.mode ?? existing?.mode ?? 'listener';
    const latencyMs = req.latencyMs ?? existing?.latencyMs ?? this.defaultLatencyMs;
    const passphrase = req.passphrase ?? existing?.passphrase ?? '';

    const passParam = passphrase ? `&passphrase=${encodeURIComponent(passphrase)}` : '';
    const srtUrl =
      mode === 'listener'
        ? `srt://${currentHostIp}:${port}?mode=listener&latency=${latencyMs}${passParam}`
        : `srt://${currentHostIp}:${port}?mode=caller&latency=${latencyMs}${passParam}`;

    const obsSourceString =
      mode === 'listener'
        ? `srt://${currentHostIp}:${port}?mode=caller&latency=${latencyMs}${passParam}`
        : `srt://${currentHostIp}:${port}?mode=listener&latency=${latencyMs}${passParam}`;

    const vMixString = `SRT ${mode.toUpperCase()} on Port ${port} (Latency: ${latencyMs}ms)`;

    const config: RemoteHubSrtConfig = {
      enabled: true,
      mode,
      port,
      latencyMs,
      passphrase,
      url: srtUrl,
      status: 'listening',
      obsSourceString,
      vMixString,
    };

    this.streamSrtConfigs.set(req.streamId, config);
    return config;
  }

  getSrtConfig(streamId: string): RemoteHubSrtConfig | undefined {
    return this.streamSrtConfigs.get(streamId);
  }

  stopSrt(streamId: string): void {
    const existing = this.streamSrtConfigs.get(streamId);
    if (existing) {
      this.releasePort(existing.port);
      existing.status = 'idle';
      existing.enabled = false;
      this.streamSrtConfigs.delete(streamId);
    }
  }

  stopAll(): void {
    for (const [, cfg] of this.streamSrtConfigs) {
      this.releasePort(cfg.port);
      cfg.status = 'idle';
      cfg.enabled = false;
    }
    this.streamSrtConfigs.clear();
    this.allocatedPorts.clear();
  }

  private probePortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const srv = net.createServer();
      srv.unref();
      srv.once('error', () => resolve(false));
      srv.listen({ port, host: '0.0.0.0' }, () => {
        srv.close(() => resolve(true));
      });
    });
  }
}
