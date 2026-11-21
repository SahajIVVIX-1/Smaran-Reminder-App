import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import type { RemoteHubDevice } from '@shared/remotehub';
import { readValidatedJson, writeAtomicFile } from '../store/atomicFile';

interface PairingRequest {
  code: string;
  expiresAt: number;
  deviceName?: string;
  hostname?: string;
  ip?: string;
  os?: string;
  isSmaranInstalled?: boolean;
  agentVersion?: string;
}

const StoredDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  hostname: z.string(),
  ip: z.string(),
  os: z.string(),
  isSmaranInstalled: z.boolean(),
  agentVersion: z.string().optional(),
  status: z.enum(['online', 'offline', 'pending']),
  lastSeenAt: z.string(),
  pairedAt: z.string(),
  canRemoteControl: z.boolean(),
  activeSessionsCount: z.number().int().default(0),
  deviceToken: z.string().optional(),
});

type StoredDevice = z.infer<typeof StoredDeviceSchema>;

export class RemoteHubDeviceManager {
  private devices: StoredDevice[] = [];
  private activePairingCode: PairingRequest | null = null;
  private readonly devicesFilePath: string;

  constructor(dataDir: string) {
    this.devicesFilePath = path.join(dataDir, 'remotehub-devices.json');
    this.devices = this.load();

    // Register host PC as the primary Smaran device if not present
    this.ensureHostDevice();
  }

  private load(): StoredDevice[] {
    const result = readValidatedJson<StoredDevice[]>(
      this.devicesFilePath,
      z.array(StoredDeviceSchema),
      [],
      {
        onRecovered: (msg) => console.log(`[RemoteHubDeviceManager] ${msg}`),
        onCorrupt: (err, p) =>
          console.warn(`[RemoteHubDeviceManager] Corrupt devices preserved to ${p}:`, err),
      },
    );
    return result.data;
  }

  private persist(): void {
    writeAtomicFile(this.devicesFilePath, JSON.stringify(this.devices, null, 2), { backup: true });
  }

  private ensureHostDevice(): void {
    const hasHost = this.devices.some((d) => d.id === 'host-local');
    if (!hasHost) {
      const hostDevice: StoredDevice = {
        id: 'host-local',
        name: 'This PC (Smaran Host)',
        hostname: process.env['COMPUTERNAME'] || 'localhost',
        ip: '127.0.0.1',
        os: 'Windows (Host)',
        isSmaranInstalled: true, // Host is full Smaran PC!
        status: 'online',
        lastSeenAt: new Date().toISOString(),
        pairedAt: new Date().toISOString(),
        canRemoteControl: true, // Only Smaran-installed PC can be remotely controlled!
        activeSessionsCount: 0,
        deviceToken: crypto.randomBytes(32).toString('hex'),
      };
      this.devices.unshift(hostDevice);
      this.persist();
    }
  }

  /**
   * Generates a 6-digit one-time pairing code valid for 5 minutes.
   */
  generatePairingCode(): { code: string; expiresAt: number } {
    const num = Math.floor(100000 + Math.random() * 900000);
    const code = String(num);
    const expiresAt = Date.now() + 5 * 60_000;

    this.activePairingCode = { code, expiresAt };
    return { code, expiresAt };
  }

  getActivePairingCode(): { code: string; expiresAt: number } | null {
    if (this.activePairingCode && Date.now() < this.activePairingCode.expiresAt) {
      return this.activePairingCode;
    }
    this.activePairingCode = null;
    return null;
  }

  /**
   * Validates pairing code submitted by a remote device/agent and approves pairing.
   */
  pairDevice(
    code: string,
    info: {
      name: string;
      hostname: string;
      ip: string;
      os: string;
      isSmaranInstalled?: boolean;
      agentVersion?: string;
    },
  ): { ok: boolean; device?: RemoteHubDevice; deviceToken?: string; error?: string } {
    const active = this.getActivePairingCode();
    if (!active || active.code !== code.trim()) {
      return { ok: false, error: 'Invalid or expired pairing code.' };
    }

    // Invalidate pairing code once used
    this.activePairingCode = null;

    const deviceId = `dev-${crypto.randomBytes(6).toString('hex')}`;
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const isSmaranInstalled = Boolean(info.isSmaranInstalled);

    const newDevice: StoredDevice = {
      id: deviceId,
      name: info.name.trim() || info.hostname || 'Remote Device',
      hostname: info.hostname,
      ip: info.ip,
      os: info.os || 'Windows',
      isSmaranInstalled,
      agentVersion: info.agentVersion,
      status: 'online',
      lastSeenAt: new Date().toISOString(),
      pairedAt: new Date().toISOString(),
      // CRITICAL SECURITY RULE: Only Smaran-installed PC can ever be eligible for remote desktop control!
      canRemoteControl: isSmaranInstalled,
      activeSessionsCount: 0,
      deviceToken,
    };

    this.devices.push(newDevice);
    this.persist();

    return {
      ok: true,
      device: this.toPublicDevice(newDevice),
      deviceToken,
    };
  }

  recordHeartbeat(deviceToken: string): boolean {
    const dev = this.devices.find((d) => d.deviceToken === deviceToken);
    if (!dev) return false;

    dev.status = 'online';
    dev.lastSeenAt = new Date().toISOString();
    return true;
  }

  checkDeviceHealth(): void {
    const now = Date.now();
    let changed = false;

    for (const dev of this.devices) {
      if (dev.id === 'host-local') continue;
      const lastSeen = new Date(dev.lastSeenAt).getTime();
      if (now - lastSeen > 60_000 && dev.status === 'online') {
        dev.status = 'offline';
        changed = true;
      }
    }

    if (changed) {
      this.persist();
    }
  }

  revokeDevice(deviceId: string): boolean {
    if (deviceId === 'host-local') {
      throw new Error('Cannot revoke the primary Smaran Host PC.');
    }
    const initialLen = this.devices.length;
    this.devices = this.devices.filter((d) => d.id !== deviceId);
    if (this.devices.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  listDevices(): RemoteHubDevice[] {
    return this.devices.map((d) => this.toPublicDevice(d));
  }

  getDevice(id: string): RemoteHubDevice | undefined {
    const dev = this.devices.find((d) => d.id === id);
    return dev ? this.toPublicDevice(dev) : undefined;
  }

  getDeviceByToken(token: string): RemoteHubDevice | undefined {
    const dev = this.devices.find((d) => d.deviceToken === token);
    return dev ? this.toPublicDevice(dev) : undefined;
  }

  private toPublicDevice(d: StoredDevice): RemoteHubDevice {
    return {
      id: d.id,
      name: d.name,
      hostname: d.hostname,
      ip: d.ip,
      os: d.os,
      isSmaranInstalled: d.isSmaranInstalled,
      agentVersion: d.agentVersion,
      status: d.status,
      lastSeenAt: d.lastSeenAt,
      pairedAt: d.pairedAt,
      canRemoteControl: d.canRemoteControl,
      activeSessionsCount: d.activeSessionsCount,
    };
  }
}
