import * as path from 'node:path';
import { z } from 'zod';
import { AppNotificationSchema, type AppNotification } from '@shared/notifications';
import { cleanupStaleTempFiles, readValidatedJson, writeAtomicFile } from './atomicFile';

export const NOTIFICATIONS_FILE = 'notifications.json';
export const MAX_NOTIFICATIONS = 500;

export type NotificationListener = (notifications: AppNotification[]) => void;

export class NotificationStore {
  readonly filePath: string;
  private notifications: AppNotification[] = [];
  private readonly listeners = new Set<NotificationListener>();

  constructor(readonly dataDir: string) {
    this.filePath = path.join(dataDir, NOTIFICATIONS_FILE);
    cleanupStaleTempFiles(dataDir, NOTIFICATIONS_FILE);
    this.load();
  }

  load(): AppNotification[] {
    const res = readValidatedJson(this.filePath, z.array(z.unknown()), [], {
      onRecovered: (msg) => console.log(`[NotificationStore] ${msg}`),
      onCorrupt: (err, preservedPath) =>
        console.warn(
          `[NotificationStore] Corrupt notifications preserved to ${preservedPath}:`,
          err,
        ),
    });

    const valid: AppNotification[] = [];
    for (const item of res.data) {
      const parsed = AppNotificationSchema.safeParse(item);
      if (parsed.success) {
        valid.push(parsed.data);
      }
    }

    this.notifications = valid.slice(0, MAX_NOTIFICATIONS);
    return this.notifications;
  }

  private save(): void {
    try {
      writeAtomicFile(this.filePath, JSON.stringify(this.notifications, null, 2), {
        backup: true,
        maxRetries: 5,
      });
    } catch (err) {
      console.error('[NotificationStore] Failed writing notifications.json atomically:', err);
    }
  }

  list(): AppNotification[] {
    return [...this.notifications];
  }

  add(item: AppNotification): void {
    // Avoid exact duplicate IDs
    this.notifications = [item, ...this.notifications.filter((n) => n.id !== item.id)];

    // Enforce storage limits (max 500)
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      // Prefer removing older read items first
      const unread = this.notifications.filter((n) => !n.read);
      const read = this.notifications.filter((n) => n.read);
      if (read.length > 0) {
        read.splice(MAX_NOTIFICATIONS - unread.length);
        this.notifications = [...unread, ...read].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
      }
      if (this.notifications.length > MAX_NOTIFICATIONS) {
        this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS);
      }
    }

    this.save();
    this.broadcast();
  }

  markRead(id: string): void {
    let changed = false;
    for (const notif of this.notifications) {
      if (notif.id === id && !notif.read) {
        notif.read = true;
        changed = true;
      }
    }
    if (changed) {
      this.save();
      this.broadcast();
    }
  }

  markAllRead(): void {
    let changed = false;
    for (const notif of this.notifications) {
      if (!notif.read) {
        notif.read = true;
        changed = true;
      }
    }
    if (changed) {
      this.save();
      this.broadcast();
    }
  }

  delete(id: string): void {
    const prevLen = this.notifications.length;
    this.notifications = this.notifications.filter((n) => n.id !== id);
    if (this.notifications.length !== prevLen) {
      this.save();
      this.broadcast();
    }
  }

  clear(): void {
    this.notifications = [];
    this.save();
    this.broadcast();
  }

  onChange(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private broadcast(): void {
    const list = this.list();
    for (const listener of this.listeners) {
      try {
        listener(list);
      } catch (err) {
        console.error('Error in NotificationStore listener:', err);
      }
    }
  }
}
