import path from 'node:path';
import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';

export type WindowRole =
  | 'app'
  | 'notification'
  | 'menu'
  | 'license'
  | 'setup'
  | 'screenborder'
  | 'trayart';

export class IpcSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcSecurityError';
  }
}

/**
 * Extracts and verifies the role of the sender from its verified webContents and frame URL.
 */
export function getSenderRole(event: IpcMainInvokeEvent | IpcMainEvent): WindowRole | null {
  const frame = event.senderFrame;
  const webContents = event.sender;
  if (!webContents || webContents.isDestroyed()) {
    return null;
  }

  const rawUrl = frame?.url || webContents.getURL();
  if (!rawUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  // Packaged app: must be file:// protocol loading from renderer folder
  if (parsed.protocol === 'file:') {
    const normalizedPath = path.normalize(decodeURIComponent(parsed.pathname)).toLowerCase();
    if (normalizedPath.includes(path.normalize('/renderer/app/')) || normalizedPath.endsWith('/app/index.html')) {
      return 'app';
    }
    if (normalizedPath.includes(path.normalize('/renderer/notification/')) || normalizedPath.endsWith('/notification/index.html')) {
      return 'notification';
    }
    if (normalizedPath.includes(path.normalize('/renderer/menu/')) || normalizedPath.endsWith('/menu/index.html')) {
      return 'menu';
    }
    if (normalizedPath.includes(path.normalize('/renderer/license/')) || normalizedPath.endsWith('/license/index.html')) {
      return 'license';
    }
    if (normalizedPath.includes(path.normalize('/renderer/setup/')) || normalizedPath.endsWith('/setup/index.html')) {
      return 'setup';
    }
    if (normalizedPath.includes(path.normalize('/renderer/screenborder/')) || normalizedPath.endsWith('/screenborder/index.html')) {
      return 'screenborder';
    }
    if (normalizedPath.includes(path.normalize('/renderer/trayart/')) || normalizedPath.endsWith('/trayart/index.html')) {
      return 'trayart';
    }
    return null;
  }

  // Development mode: verify host is loopback dev server
  const isLoopback =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';

  if (!isLoopback) {
    return null;
  }

  const pathname = parsed.pathname;
  if (pathname.includes('/app/')) return 'app';
  if (pathname.includes('/notification/')) return 'notification';
  if (pathname.includes('/menu/')) return 'menu';
  if (pathname.includes('/license/')) return 'license';
  if (pathname.includes('/setup/')) return 'setup';
  if (pathname.includes('/screenborder/')) return 'screenborder';
  if (pathname.includes('/trayart/')) return 'trayart';

  return null;
}

/**
 * Validates that an IPC event originates from an authorized window role.
 */
export function assertAuthorizedSender(
  event: IpcMainInvokeEvent | IpcMainEvent,
  allowedRoles: WindowRole[],
  channel: string,
): WindowRole {
  const role = getSenderRole(event);
  if (!role || !allowedRoles.includes(role)) {
    const errorMsg = `Security violation: Unauthorized IPC request on channel "${channel}" from sender with role "${role || 'unknown'}"`;
    console.error(`[IPC Security] ${errorMsg}`);
    throw new IpcSecurityError(errorMsg);
  }
  return role;
}

/**
 * Type-safe wrapper for ipcMain.handle with sender role authorization.
 */
export function registerSafeHandle<T>(
  channel: string,
  allowedRoles: WindowRole[],
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T> | T,
): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, ...args) => {
    assertAuthorizedSender(event, allowedRoles, channel);
    return handler(event, ...args);
  });
}

/**
 * Type-safe wrapper for ipcMain.on with sender role authorization.
 */
export function registerSafeOn(
  channel: string,
  allowedRoles: WindowRole[],
  listener: (event: IpcMainEvent, ...args: unknown[]) => void,
): void {
  ipcMain.removeAllListeners(channel);
  ipcMain.on(channel, (event, ...args) => {
    assertAuthorizedSender(event, allowedRoles, channel);
    listener(event, ...args);
  });
}
