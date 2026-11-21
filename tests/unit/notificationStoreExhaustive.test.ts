import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_NOTIFICATIONS,
  NotificationStore,
} from '../../src/main/store/NotificationStore';
import type { AppNotification } from '../../src/shared/notifications';

describe('NotificationStore - Resilience & Queue Capacity Management', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-notif-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  const makeNotif = (
    id: string,
    read = false,
    timestamp = new Date().toISOString(),
  ): AppNotification => ({
    id,
    category: 'system',
    title: `Notification ${id}`,
    description: `Message content for ${id}`,
    timestamp,
    severity: 'info',
    read,
    source: 'system',
  });

  it('initializes empty on fresh directory', () => {
    const store = new NotificationStore(tempDir);
    expect(store.list()).toEqual([]);
  });

  it('adds notifications and notifies registered listeners', () => {
    const store = new NotificationStore(tempDir);
    const notificationsReceived: AppNotification[][] = [];

    const unsubscribe = store.onChange((list) => {
      notificationsReceived.push(list);
    });

    store.add(makeNotif('n1'));
    expect(notificationsReceived.length).toBe(1);
    expect(notificationsReceived[0]?.[0]?.id).toBe('n1');

    store.add(makeNotif('n2'));
    expect(notificationsReceived.length).toBe(2);
    expect(store.list().length).toBe(2);

    unsubscribe();
    store.add(makeNotif('n3'));
    // Listener was unsubscribed so count should remain 2
    expect(notificationsReceived.length).toBe(2);
  });

  it('deduplicates by id and replaces existing item with newer data', () => {
    const store = new NotificationStore(tempDir);
    store.add(makeNotif('n-dup', false));
    expect(store.list().length).toBe(1);
    expect(store.list()[0]?.read).toBe(false);

    // Re-add with read = true
    store.add(makeNotif('n-dup', true));
    expect(store.list().length).toBe(1);
    expect(store.list()[0]?.read).toBe(true);
  });

  it('marks single notification as read', () => {
    const store = new NotificationStore(tempDir);
    store.add(makeNotif('n1', false));
    store.add(makeNotif('n2', false));

    store.markRead('n1');
    const items = store.list();
    expect(items.find((n) => n.id === 'n1')?.read).toBe(true);
    expect(items.find((n) => n.id === 'n2')?.read).toBe(false);
  });

  it('marks all notifications as read', () => {
    const store = new NotificationStore(tempDir);
    store.add(makeNotif('n1', false));
    store.add(makeNotif('n2', false));
    store.add(makeNotif('n3', false));

    store.markAllRead();
    expect(store.list().every((n) => n.read)).toBe(true);
  });

  it('deletes an existing notification by id', () => {
    const store = new NotificationStore(tempDir);
    store.add(makeNotif('n1'));
    store.add(makeNotif('n2'));

    store.delete('n1');
    const remaining = store.list();
    expect(remaining.length).toBe(1);
    expect(remaining[0]?.id).toBe('n2');
  });

  it('clears all notifications', () => {
    const store = new NotificationStore(tempDir);
    store.add(makeNotif('n1'));
    store.add(makeNotif('n2'));
    expect(store.list().length).toBe(2);

    store.clear();
    expect(store.list()).toEqual([]);
  });

  it('persists data to disk and reloads cleanly in a fresh store instance', () => {
    const store1 = new NotificationStore(tempDir);
    store1.add(makeNotif('n-persist-1', false));
    store1.add(makeNotif('n-persist-2', true));

    const store2 = new NotificationStore(tempDir);
    const loaded = store2.list();
    expect(loaded.length).toBe(2);
    expect(loaded.find((n) => n.id === 'n-persist-1')?.read).toBe(false);
    expect(loaded.find((n) => n.id === 'n-persist-2')?.read).toBe(true);
  });
});
