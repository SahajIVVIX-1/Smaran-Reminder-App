import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppNotificationSchema, type AppNotification } from '@shared/notifications';

export const NOTIFICATIONS_FILE = 'notifications.json';
export const MAX_NOTIFICATIONS = 500;

export type NotificationListener = (notifications: AppNotification[]) => void;

export class NotificationStore {
  readonly filePath: string;
  private notifications: AppNotification[] = [];
  private readonly listeners = new Set<NotificationListener>();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, NOTIFICATIONS_FILE);
    this.load();
  }

  load(): AppNotification[] {
    if (!fs.existsSync(this.filePath)) {
      this.notifications = [];
      return this.notifications;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid: AppNotification[] = [];
        for (const item of parsed) {
          const res = AppNotificationSchema.safeParse(item);
          if (res.success) {
            valid.push(res.data);
          }
        }
        this.notifications = valid;
      } else {
        this.notifications = [];
      }
    } catch {
      this.notifications = [];
    }

    return this.notifications;
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.notifications, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed writing notifications.json:', err);
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
