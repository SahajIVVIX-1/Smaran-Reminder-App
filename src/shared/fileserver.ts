import { z } from 'zod';

export type LogLevel = 'info' | 'warn' | 'error' | 'access';

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  ip?: string;
}

export type ServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface ServerStatus {
  state: ServerState;
  running: boolean;
  port: number;
  localUrl: string;
  lanUrls: string[];
  liveConnections: number;
  rootDir: string;
  error?: string;
}

export const FileServerSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().int().min(1024).max(65535).default(5901),
  rootDir: z.string().default(''),
  autoStart: z.boolean().default(false),
  autoStartConfigured: z.boolean().optional(),
  autoOpenAdminOnStart: z.boolean().default(false),
  adminUsername: z.string().default('admin'),
  adminPassword: z.string().default(''),
  notifyOnLogin: z.boolean().default(true),
  notifyOnFailedLogin: z.boolean().default(true),
  notifyOnAdminActivity: z.boolean().default(true),
});

export type FileServerSettings = z.infer<typeof FileServerSettingsSchema>;

export interface FileServerSecurityEvent {
  id: string;
  type: 'login' | 'failedLogin' | 'logout' | 'adminActivity';
  username: string;
  clientIp: string;
  userAgent?: string;
  accessType?: 'LAN' | 'External';
  reason?: string;
  repeatCount?: number;
  timestamp: string;
  details?: string;
}

export interface ActiveSession {
  id: string;
  username?: string;
  ip: string;
  speed?: number;
  connectedAt?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  role: 'admin' | 'user' | 'guest';
  isSystem?: boolean;
}

export interface VfsNode {
  id: string;
  name: string;
  vfsPath: string;
  physicalPath?: string;
  type: 'directory' | 'file' | 'link' | 'virtual';
}
