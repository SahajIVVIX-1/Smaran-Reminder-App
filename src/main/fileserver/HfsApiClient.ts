import http from 'node:http';

export interface HfsApiStatusResponse {
  version?: string;
  uptime?: number;
  connections?: number;
  bytesSent?: number;
  bytesReceived?: number;
}

export interface HealthCheckDetail {
  ok: boolean;
  statusCode?: number;
  durationMs: number;
  error?: string;
}

export class HfsApiClient {
  constructor(
    private readonly port: number,
    private readonly token: string,
  ) {}

  public async callApi<T = unknown>(
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(params);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path: `/~/api/${endpoint}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'x-smaran-internal-token': this.token,
            'x-hfs-anti-csrf': '1',
            'User-Agent': 'Smaran-HFS-Bridge/3.4.6',
          },
          timeout: 4000,
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed as T);
              } catch {
                resolve({} as T);
              }
            } else {
              reject(
                new Error(`HFS API /~/api/${endpoint} returned HTTP ${res.statusCode}: ${data}`),
              );
            }
          });
        },
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`HFS API /~/api/${endpoint} timed out after 4000ms`));
      });

      req.write(payload);
      req.end();
    });
  }

  public getPort(): number {
    return this.port;
  }

  public async checkDetailedHealth(timeoutMs = 1500): Promise<HealthCheckDetail> {
    const start = Date.now();
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path: '/',
          method: 'GET',
          headers: {
            'User-Agent': 'Smaran-HFS-Bridge/3.4.6',
          },
          timeout: timeoutMs,
        },
        (res) => {
          const durationMs = Date.now() - start;
          const ok = Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
          resolve({ ok, statusCode: res.statusCode, durationMs });
        },
      );
      req.on('error', (err) => {
        const durationMs = Date.now() - start;
        resolve({ ok: false, durationMs, error: err.message });
      });
      req.on('timeout', () => {
        req.destroy();
        const durationMs = Date.now() - start;
        resolve({ ok: false, durationMs, error: `Probe timed out after ${timeoutMs}ms` });
      });
      req.end();
    });
  }

  public async checkHttpHealth(): Promise<boolean> {
    const detail = await this.checkDetailedHealth(2000);
    return detail.ok;
  }

  async getStatus(): Promise<HfsApiStatusResponse> {
    return this.callApi<HfsApiStatusResponse>('get_status');
  }

  async getConnections(): Promise<{
    connections: Array<{ id: string; ip: string; speed?: number }>;
  }> {
    return this.callApi<{ connections: Array<{ id: string; ip: string; speed?: number }> }>(
      'get_connections',
    );
  }

  async disconnect(id: string): Promise<{ ok: boolean }> {
    return this.callApi<{ ok: boolean }>('disconnect', { id });
  }

  async addAccount(account: {
    username: string;
    password?: string;
    admin?: boolean;
    srp?: unknown;
  }): Promise<{ ok: boolean }> {
    return this.callApi<{ ok: boolean }>('add_account', account);
  }

  async setConfig(patch: Record<string, unknown>): Promise<{ ok: boolean }> {
    return this.callApi<{ ok: boolean }>('set_config', patch);
  }

  async reload(): Promise<{ ok: boolean }> {
    return this.callApi<{ ok: boolean }>('reload');
  }

  async quit(): Promise<{ ok: boolean }> {
    return this.callApi<{ ok: boolean }>('quit');
  }
}
