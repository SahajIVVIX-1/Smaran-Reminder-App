import { Client } from '@rejetto/nat-upnp';

export interface NatStatus {
  enabled: boolean;
  mapped: boolean;
  publicIp: string;
  mappedPort: number;
  error?: string;
}

export class NatManager {
  private client: Client | null = null;
  private mappedPort = 0;
  private publicIp = '';
  private isMapped = false;
  private lastError?: string;

  private getClient(): Client {
    if (!this.client) {
      this.client = new Client();
    }
    return this.client;
  }

  async mapPort(port: number, description = 'Smaran HFS'): Promise<NatStatus> {
    this.mappedPort = port;
    this.lastError = undefined;

    try {
      const client = this.getClient();

      // Fetch public IP with timeout
      try {
        const ipPromise = client.getPublicIp();
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('UPnP public IP timeout')), 4000),
        );
        this.publicIp = await Promise.race([ipPromise, timeoutPromise]);
      } catch {
        // Continue even if public IP lookup timed out
      }

      // Map port
      const mapPromise = client.createMapping({
        private: port,
        public: { host: '', port },
        description,
        ttl: 0,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('UPnP router response timeout')), 5000),
      );

      await Promise.race([mapPromise, timeoutPromise]);
      this.isMapped = true;

      return {
        enabled: true,
        mapped: true,
        publicIp: this.publicIp,
        mappedPort: port,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.isMapped = false;
      return {
        enabled: true,
        mapped: false,
        publicIp: this.publicIp,
        mappedPort: port,
        error: msg,
      };
    }
  }

  async unmapPort(port?: number): Promise<void> {
    const targetPort = port || this.mappedPort;
    if (!targetPort || !this.isMapped) return;

    try {
      const client = this.getClient();
      await client.removeMapping({ public: targetPort });
      this.isMapped = false;
    } catch {
      // Ignore unmapping errors on shutdown
    }
  }

  getStatus(): NatStatus {
    return {
      enabled: this.isMapped,
      mapped: this.isMapped,
      publicIp: this.publicIp,
      mappedPort: this.mappedPort,
      error: this.lastError,
    };
  }
}
