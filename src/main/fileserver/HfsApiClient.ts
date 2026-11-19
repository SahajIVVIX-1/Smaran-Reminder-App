export interface HfsStatusResponse {
  started?: string;
  build?: string;
  version?: string;
  apiVersion?: number;
  compatibleApiVersion?: number;
  http?: {
    listening?: boolean;
    port?: number;
    error?: string;
  };
  https?: {
    listening?: boolean;
    port?: number;
    error?: string;
  };
  platform?: string;
  cwd?: string;
  configFile?: string;
  urls?: string[];
  ips?: string[];
  connectionAddress?: string;
  baseUrl?: string;
}

export interface HfsFileListEntry {
  n: string;
  s?: number;
  m?: string;
  c?: string;
  web?: boolean;
}

export interface HfsFileListResponse {
  list: HfsFileListEntry[];
  can_archive?: boolean;
  can_upload?: boolean;
  can_delete?: boolean;
  can_delete_children?: boolean;
  can_overwrite?: boolean;
  can_comment?: boolean;
}

export interface HfsConnectionItem {
  id?: string;
  ip: string;
  port?: number;
  user?: string;
  path?: string;
  inSpeed?: number;
  outSpeed?: number;
  sent?: number;
  received?: number;
  created?: string;
}

export class HfsApiClient {
  constructor(
    private readonly getPort: () => number,
    private readonly getToken: () => string,
  ) {}

  private get baseUrl(): string {
    return `http://127.0.0.1:${this.getPort()}/~/api`;
  }

  private async callApi<T>(cmd: string, params?: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/${cmd}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hfs-anti-csrf': '1',
          'x-smaran-internal-token': this.getToken(),
        },
        signal: controller.signal,
        body: params ? JSON.stringify(params) : undefined,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HFS API ${cmd} failed with status ${res.status}: ${text}`);
      }

      const json = (await res.json()) as T;
      return json;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getStatus(): Promise<HfsStatusResponse> {
    return this.callApi<HfsStatusResponse>('get_status', undefined, 5000);
  }

  async getFileList(uri = '/'): Promise<HfsFileListResponse> {
    return this.callApi<HfsFileListResponse>('get_file_list', { uri });
  }

  async getConnections(): Promise<{ connections?: HfsConnectionItem[] }> {
    return this.callApi<{ connections?: HfsConnectionItem[] }>('get_connections');
  }

  async disconnect(ip: string, port?: number): Promise<{ result: number }> {
    return this.callApi<{ result: number }>('disconnect', { ip, port });
  }

  async quit(): Promise<void> {
    try {
      await this.callApi<Record<string, unknown>>('quit', undefined, 2000);
    } catch {
      // Server may terminate socket before sending full response on quit
    }
  }

  async setConfig(values: Record<string, unknown>): Promise<void> {
    await this.callApi<Record<string, unknown>>('set_config', { values });
  }

  async getVfs(): Promise<Record<string, unknown>> {
    return this.callApi<Record<string, unknown>>('get_vfs');
  }

  async setVfs(vfs: unknown): Promise<void> {
    await this.callApi<Record<string, unknown>>('set_vfs', { vfs });
  }

  async getAccounts(): Promise<Record<string, unknown>> {
    return this.callApi<Record<string, unknown>>('get_accounts');
  }

  async setAccounts(accounts: unknown): Promise<void> {
    await this.callApi<Record<string, unknown>>('set_accounts', { accounts });
  }
}
