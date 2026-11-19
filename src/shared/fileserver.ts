import { z } from 'zod';

export type LogLevel = 'info' | 'warn' | 'error' | 'access';

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  ip?: string;
}

export interface ServerStatus {
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
  autoStart: z.boolean().default(true),
  autoOpenAdminOnStart: z.boolean().default(false),
  adminUsername: z.string().default('admin'),
  adminPassword: z.string().default(''),
});

export type FileServerSettings = z.infer<typeof FileServerSettingsSchema>;

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
