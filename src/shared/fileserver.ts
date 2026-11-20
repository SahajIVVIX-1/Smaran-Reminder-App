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

export const FileServerSecurityEventSchema = z.object({
  id: z.string(),
  type: z.enum(['login', 'failedLogin', 'logout', 'adminActivity']),
  username: z.string(),
  clientIp: z.string(),
  userAgent: z.string().optional(),
  accessType: z.enum(['LAN', 'External']).optional(),
  reason: z.string().optional(),
  repeatCount: z.number().optional(),
  timestamp: z.string(),
  details: z.string().optional(),
});

export type FileServerSecurityEvent = z.infer<typeof FileServerSecurityEventSchema>;

export interface FileServerAuditFilter {
  type?: 'login' | 'failedLogin' | 'logout' | 'adminActivity';
  username?: string;
  ip?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export const FailedLoginRecordSchema = z.object({
  ip: z.string(),
  count: z.number().int().min(1),
  lastTime: z.number().min(0),
});

export type FailedLoginRecord = z.infer<typeof FailedLoginRecordSchema>;

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
