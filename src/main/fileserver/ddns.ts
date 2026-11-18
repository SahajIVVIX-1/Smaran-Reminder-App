import * as http from 'node:http';
import * as https from 'node:https';

export interface DdnsResult {
  lastUpdated?: string;
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export class DdnsManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private result: DdnsResult = { status: 'idle' };

  constructor(
    private readonly onLog?: (level: 'info' | 'warn' | 'error', message: string) => void,
  ) {}

  start(ddnsUrl: string, intervalMinutes: number, publicIp: string): void {
    this.stop();
    if (!ddnsUrl.trim()) return;

    // Trigger initial update
    this.update(ddnsUrl, publicIp);

    const ms = Math.max(5, intervalMinutes) * 60 * 1000;
    this.timer = setInterval(() => {
      this.update(ddnsUrl, publicIp);
    }, ms);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async update(ddnsUrl: string, publicIp: string): Promise<DdnsResult> {
    if (!ddnsUrl.trim()) {
      this.result = { status: 'idle' };
      return this.result;
    }

    const resolvedUrl = ddnsUrl
      .replace(/{ip}/g, publicIp || '')
      .replace(/\$ip/g, publicIp || '')
      .replace(/\$IP/g, publicIp || '');

    try {
      const parsed = new URL(resolvedUrl);
      const client = parsed.protocol === 'https:' ? https : http;

      return new Promise((resolve) => {
        const req = client.get(
          resolvedUrl,
          {
            headers: { 'User-Agent': 'Smaran-HFS/3.2.0' },
            timeout: 10000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                this.result = {
                  status: 'success',
                  lastUpdated: new Date().toISOString(),
                  message: `DDNS updated successfully (${res.statusCode})`,
                };
                this.onLog?.('info', `DDNS update succeeded: ${this.result.message}`);
              } else {
                this.result = {
                  status: 'error',
                  lastUpdated: new Date().toISOString(),
                  message: `DDNS server responded with HTTP ${res.statusCode}: ${data.slice(0, 100)}`,
                };
                this.onLog?.('warn', `DDNS update failed: ${this.result.message}`);
              }
              resolve(this.result);
            });
          },
        );

        req.on('error', (err) => {
          this.result = {
            status: 'error',
            lastUpdated: new Date().toISOString(),
            message: err.message,
          };
          this.onLog?.('warn', `DDNS update error: ${err.message}`);
          resolve(this.result);
        });

        req.on('timeout', () => {
          req.destroy();
          this.result = {
            status: 'error',
            lastUpdated: new Date().toISOString(),
            message: 'DDNS update timed out',
          };
          this.onLog?.('warn', 'DDNS update timed out');
          resolve(this.result);
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.result = {
        status: 'error',
        lastUpdated: new Date().toISOString(),
        message: msg,
      };
      return this.result;
    }
  }

  getResult(): DdnsResult {
    return { ...this.result };
  }
}
