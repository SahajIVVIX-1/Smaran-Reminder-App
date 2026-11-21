import { z } from 'zod';

export type RemoteHubServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
export type UserRole = 'owner' | 'operator' | 'viewer';
export type StreamSourceType = 'display' | 'window';
export type SrtMode = 'caller' | 'listener';
export type StreamStatus = 'idle' | 'capturing' | 'streaming' | 'error';
export type RemoteControlStatus =
  'none' | 'requested' | 'granted' | 'denied' | 'active' | 'revoked';

export interface RemoteHubOverview {
  status: RemoteHubServerStatus;
  port: number;
  bindAddress: string;
  lanUrl: string;
  connectedUsers: number;
  connectedDevices: number;
  activeStreams: number;
  activeSessions: number;
  cpuUsage: number;
  ramUsageMb: number;
  uptimeSec: number;
  error?: string;
  adminCreated: boolean;
}

export const RemoteHubSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().int().min(1024).max(65535).default(5902),
  bindAddress: z.string().default('0.0.0.0'),
  allowLan: z.boolean().default(true),
  autoStart: z.boolean().default(false),
  httpsEnabled: z.boolean().default(false),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).default(120),
  maxLoginAttempts: z.number().int().min(3).max(20).default(5),
  autoApproveTrustedDevices: z.boolean().default(false),
  requireControlApproval: z.boolean().default(true),
  defaultResolution: z.enum(['720p', '1080p', '1440p', '4k']).default('1080p'),
  defaultFps: z.number().int().min(15).max(60).default(30),
  defaultBitrateKbps: z.number().int().min(500).max(25000).default(4000),
  hardwareAcceleration: z.boolean().default(true),
  maxSimultaneousStreams: z.number().int().min(1).max(32).default(8),
  srtBasePort: z.number().int().min(1024).max(65000).default(6000),
  srtDefaultLatencyMs: z.number().int().min(20).max(8000).default(120),
  srtEncryptionPassphrase: z.string().max(100).optional(),
  notifyOnLogin: z.boolean().default(true),
  notifyOnDevicePair: z.boolean().default(true),
  notifyOnStreamStart: z.boolean().default(true),
  notifyOnControlRequest: z.boolean().default(true),
  logsRetentionDays: z.number().int().min(1).max(90).default(14),
});

export type RemoteHubSettings = z.infer<typeof RemoteHubSettingsSchema>;

export const DEFAULT_REMOTE_HUB_SETTINGS: RemoteHubSettings = {
  enabled: false,
  port: 5902,
  bindAddress: '0.0.0.0',
  allowLan: true,
  autoStart: false,
  httpsEnabled: false,
  sessionTimeoutMinutes: 120,
  maxLoginAttempts: 5,
  autoApproveTrustedDevices: false,
  requireControlApproval: true,
  defaultResolution: '1080p',
  defaultFps: 30,
  defaultBitrateKbps: 4000,
  hardwareAcceleration: true,
  maxSimultaneousStreams: 8,
  srtBasePort: 6000,
  srtDefaultLatencyMs: 120,
  srtEncryptionPassphrase: '',
  notifyOnLogin: true,
  notifyOnDevicePair: true,
  notifyOnStreamStart: true,
  notifyOnControlRequest: true,
  logsRetentionDays: 14,
};

export const RemoteHubUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(3).max(32),
  displayName: z.string().min(1).max(50),
  role: z.enum(['owner', 'operator', 'viewer']),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  lastLoginAt: z.string().optional(),
  loginCount: z.number().int().default(0),
});

export type RemoteHubUser = z.infer<typeof RemoteHubUserSchema>;

export interface RemoteHubDevice {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  os: string;
  isSmaranInstalled: boolean;
  agentVersion?: string;
  status: 'online' | 'offline' | 'pending';
  lastSeenAt: string;
  pairedAt: string;
  canRemoteControl: boolean;
  activeSessionsCount: number;
}

export interface RemoteHubSrtConfig {
  enabled: boolean;
  mode: SrtMode;
  port: number;
  latencyMs: number;
  passphrase?: string;
  url: string;
  status: 'idle' | 'listening' | 'connected' | 'error';
  obsSourceString: string;
  vMixString: string;
}

export interface RemoteHubStream {
  id: string;
  name: string;
  sourceType: StreamSourceType;
  sourceId: string;
  sourceTitle: string;
  ownerDeviceId: string;
  ownerDeviceName: string;
  status: StreamStatus;
  resolution: string;
  fps: number;
  bitrateKbps: number;
  thumbnailUrl?: string;
  startedAt?: string;
  viewersCount: number;
  srt: RemoteHubSrtConfig;
}

export interface AvailableScreenSource {
  id: string;
  name: string;
  type: StreamSourceType;
  thumbnailUrl: string;
  displayId?: string;
}

export interface RemoteControlSession {
  id: string;
  deviceId: string;
  deviceName: string;
  userId: string;
  username: string;
  status: RemoteControlStatus;
  startedAt: string;
  lastInputAt: string;
  clipboardSync: boolean;
}

export interface RemoteHubLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'security';
  category: 'server' | 'auth' | 'device' | 'stream' | 'control';
  message: string;
  details?: Record<string, string | number | boolean | undefined>;
}
