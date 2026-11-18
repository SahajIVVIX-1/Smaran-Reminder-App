import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'user', 'guest']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const PermissionsSchema = z.object({
  read: z.boolean().default(true),
  upload: z.boolean().default(false),
  delete: z.boolean().default(false),
  rename: z.boolean().default(false),
  mkdir: z.boolean().default(false),
});
export type Permissions = z.infer<typeof PermissionsSchema>;

export const UserAccountSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1).max(50),
  passwordHash: z.string(),
  role: UserRoleSchema,
  permissions: PermissionsSchema,
  allowedFolders: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type UserAccount = z.infer<typeof UserAccountSchema>;

export const ShareLinkPermissionSchema = z.enum(['read', 'upload', 'download', 'full']);
export type ShareLinkPermission = z.infer<typeof ShareLinkPermissionSchema>;

export const ShareLinkSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  name: z.string(),
  relativePath: z.string(),
  isFolder: z.boolean(),
  permission: ShareLinkPermissionSchema.default('download'),
  passwordProtected: z.boolean().default(false),
  passwordHash: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(), // ISO string or null
  maxDownloads: z.number().int().positive().nullable().optional(),
  downloadCount: z.number().int().default(0),
  createdAt: z.string(),
});
export type ShareLink = z.infer<typeof ShareLinkSchema>;

export const VirtualFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  physicalPath: z.string().min(1),
  readOnly: z.boolean().default(false),
  authRequired: z.boolean().default(false),
});
export type VirtualFolder = z.infer<typeof VirtualFolderSchema>;

export const FileServerSettingsSchema = z.object({
  enabled: z.boolean().default(true), // auto-start on app launch
  serverName: z.string().default('Smaran File Server'),
  port: z.number().int().min(1).max(65535).default(5900),
  bindAddress: z.string().default('0.0.0.0'),
  rootDir: z.string(),
  maxConnections: z.number().int().min(1).max(1000).default(50),
  uploadLimitMb: z.number().int().min(1).max(102400).default(4096), // 4GB default
  rateLimitPerMin: z.number().int().min(10).max(10000).default(600),
  authEnabled: z.boolean().default(false),
  guestAccess: z.boolean().default(true),
  allowPublicUploads: z.boolean().default(false),
  enableRangeRequests: z.boolean().default(true),
  httpsEnabled: z.boolean().default(false),
  httpsCertPath: z.string().default(''),
  httpsKeyPath: z.string().default(''),
});
export type FileServerSettings = z.infer<typeof FileServerSettingsSchema>;

export interface FileItem {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  mimeType: string;
  extension: string;
}

export interface DirectoryListing {
  currentPath: string;
  breadcrumbs: { name: string; path: string }[];
  items: FileItem[];
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  writable: boolean;
}

export type TransferDirection = 'upload' | 'download';
export type TransferStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export interface ActiveTransfer {
  id: string;
  fileName: string;
  direction: TransferDirection;
  clientIp: string;
  bytesTransferred: number;
  totalBytes: number;
  speedBps: number;
  percent: number;
  startedAt: string;
}

export interface TransferHistoryEntry {
  id: string;
  fileName: string;
  direction: TransferDirection;
  clientIp: string;
  totalBytes: number;
  status: TransferStatus;
  error?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  clientIp: string;
  method?: string;
  url?: string;
  status?: number;
  message: string;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  bindAddress: string;
  serverName: string;
  rootDir: string;
  uptimeSeconds: number;
  lanIps: string[];
  localUrl: string;
  lanUrls: string[];
  connectedClients: number;
  activeTransfers: ActiveTransfer[];
  totalBytesUploaded: number;
  totalBytesDownloaded: number;
  currentUploadSpeedBps: number;
  currentDownloadSpeedBps: number;
  authEnabled: boolean;
  guestAccess: boolean;
  error?: string;
}

export interface ReminderAttachment {
  id: string;
  name: string;
  size: number;
  relativePath: string;
  mimeType: string;
  addedAt: string;
}
