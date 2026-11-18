import { Transform, type TransformCallback } from 'node:stream';

export interface ThrottlerConfig {
  maxKbpsDown: number; // 0 = unlimited
  maxKbpsUp: number; // 0 = unlimited
  maxKbpsPerIp: number; // 0 = unlimited
  maxDownloads: number; // 0 = unlimited
}

/**
 * Token-bucket stream transformer for rate-limiting downloads and uploads.
 */
export class ThrottledStream extends Transform {
  private bytesSent = 0;
  private tokens = 0;
  private lastRefill = Date.now();
  private maxBytesPerSec: number;

  constructor(maxKbps: number) {
    super();
    this.maxBytesPerSec = maxKbps > 0 ? maxKbps * 1024 : 0;
    this.tokens = this.maxBytesPerSec; // start full
  }

  updateLimit(maxKbps: number): void {
    this.maxBytesPerSec = maxKbps > 0 ? maxKbps * 1024 : 0;
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.maxBytesPerSec <= 0) {
      // Unlimited
      this.bytesSent += chunk.length;
      this.push(chunk);
      callback();
      return;
    }

    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxBytesPerSec, this.tokens + elapsed * this.maxBytesPerSec);
    this.lastRefill = now;

    if (this.tokens >= chunk.length) {
      this.tokens -= chunk.length;
      this.bytesSent += chunk.length;
      this.push(chunk);
      callback();
    } else {
      // Need to wait until enough tokens accumulate
      const deficit = chunk.length - this.tokens;
      const waitMs = Math.ceil((deficit / this.maxBytesPerSec) * 1000);
      setTimeout(() => {
        this.tokens = 0;
        this.lastRefill = Date.now();
        this.bytesSent += chunk.length;
        this.push(chunk);
        callback();
      }, waitMs);
    }
  }

  getBytesTransferred(): number {
    return this.bytesSent;
  }
}

export class BandwidthManager {
  private activeDownloadsCount = 0;
  private ipDownloadCounts = new Map<string, number>();

  canStartDownload(clientIp: string, maxDownloads: number): boolean {
    if (maxDownloads > 0 && this.activeDownloadsCount >= maxDownloads) {
      return false;
    }
    return true;
  }

  startDownload(clientIp: string): void {
    this.activeDownloadsCount++;
    const count = this.ipDownloadCounts.get(clientIp) || 0;
    this.ipDownloadCounts.set(clientIp, count + 1);
  }

  endDownload(clientIp: string): void {
    this.activeDownloadsCount = Math.max(0, this.activeDownloadsCount - 1);
    const count = this.ipDownloadCounts.get(clientIp) || 0;
    if (count <= 1) {
      this.ipDownloadCounts.delete(clientIp);
    } else {
      this.ipDownloadCounts.set(clientIp, count - 1);
    }
  }

  createDownloadThrottler(clientIp: string, config: ThrottlerConfig): ThrottledStream | null {
    // Determine effective limit (minimum of global download limit and per-IP limit)
    let effectiveLimit = 0;
    if (config.maxKbpsDown > 0 && config.maxKbpsPerIp > 0) {
      effectiveLimit = Math.min(config.maxKbpsDown, config.maxKbpsPerIp);
    } else if (config.maxKbpsDown > 0) {
      effectiveLimit = config.maxKbpsDown;
    } else if (config.maxKbpsPerIp > 0) {
      effectiveLimit = config.maxKbpsPerIp;
    }

    if (effectiveLimit > 0) {
      return new ThrottledStream(effectiveLimit);
    }
    return null;
  }

  createUploadThrottler(clientIp: string, config: ThrottlerConfig): ThrottledStream | null {
    if (config.maxKbpsUp > 0) {
      return new ThrottledStream(config.maxKbpsUp);
    }
    return null;
  }
}
