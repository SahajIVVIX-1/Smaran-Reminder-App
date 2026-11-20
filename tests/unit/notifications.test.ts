import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLanIp, normalizeClientIp } from '../../src/main/fileserver/ipUtils';
import { NotificationStore } from '../../src/main/store/NotificationStore';
import type { AppNotification } from '../../src/shared/notifications';

describe('NotificationStore', () => {
  it('adds, lists, and persists notifications', () => {
    const tmp = path.join(os.tmpdir(), `notif-test-${Date.now()}`);
    const store = new NotificationStore(tmp);

    expect(store.list()).toEqual([]);

    const item: AppNotification = {
      id: 'n-1',
      category: 'security',
      title: 'Failed Login Alert',
      description: 'Attempt rejected for user admin from 192.168.1.100',
      timestamp: new Date().toISOString(),
      severity: 'warning',
      read: false,
      source: 'fileserver',
      metadata: { username: 'admin', clientIp: '192.168.1.100' },
    };

    store.add(item);
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]?.title).toBe('Failed Login Alert');
    expect(store.list()[0]?.read).toBe(false);

    // Test markRead
    store.markRead('n-1');
    expect(store.list()[0]?.read).toBe(true);

    // Test reload from disk
    const store2 = new NotificationStore(tmp);
    expect(store2.list()).toHaveLength(1);
    expect(store2.list()[0]?.read).toBe(true);

    // Test delete
    store2.delete('n-1');
    expect(store2.list()).toHaveLength(0);

    // Cleanup
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('marks all as read and clears inbox without errors', () => {
    const tmp = path.join(os.tmpdir(), `notif-test-${Date.now()}`);
    const store = new NotificationStore(tmp);

    for (let i = 1; i <= 5; i++) {
      store.add({
        id: `n-${i}`,
        category: 'automations',
        title: `Automation #${i}`,
        description: 'Ran step',
        timestamp: new Date().toISOString(),
        severity: 'info',
        read: false,
        source: 'automations',
      });
    }

    expect(store.list()).toHaveLength(5);
    expect(store.list().filter((n) => !n.read)).toHaveLength(5);

    store.markAllRead();
    expect(store.list().filter((n) => !n.read)).toHaveLength(0);

    store.clear();
    expect(store.list()).toHaveLength(0);

    // Cleanup
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('recovers from corrupt JSON via backup and isolates throwing listeners', () => {
    const tmp = path.join(os.tmpdir(), `notif-test-${Date.now()}`);
    const store = new NotificationStore(tmp);

    const item: AppNotification = {
      id: 'valid-1',
      category: 'fileserver',
      title: 'Server Started',
      description: 'Listening on port 5901',
      timestamp: new Date().toISOString(),
      severity: 'success',
      read: false,
      source: 'fileserver',
    };
    store.add(item);
    // Add second to ensure .bak exists
    store.add({ ...item, id: 'valid-2', title: 'Second Notif' });

    // Corrupt notifications.json
    fs.writeFileSync(store.filePath, '{ damaged json data !!!', 'utf8');

    // Load store again - should recover from backup
    const recoveredStore = new NotificationStore(tmp);
    expect(recoveredStore.list().length).toBeGreaterThanOrEqual(1);
    expect(recoveredStore.list().some((n) => n.id === 'valid-1')).toBe(true);

    // Verify .corrupt file exists
    const files = fs.readdirSync(tmp);
    expect(files.some((f) => f.includes('notifications.json.corrupt.'))).toBe(true);

    // Test listener error isolation
    let normalListenerCalled = false;
    recoveredStore.onChange(() => {
      throw new Error('Exploding notification listener');
    });
    recoveredStore.onChange(() => {
      normalListenerCalled = true;
    });

    // Adding an item should not throw despite throwing listener
    expect(() => {
      recoveredStore.add({ ...item, id: 'valid-3' });
    }).not.toThrow();
    expect(normalListenerCalled).toBe(true);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('enforces maximum 500 notification storage limit', () => {
    const tmp = path.join(os.tmpdir(), `notif-test-${Date.now()}`);
    const store = new NotificationStore(tmp);

    for (let i = 0; i < 550; i++) {
      store.add({
        id: `bulk-${i}`,
        category: 'fileserver',
        title: `Event ${i}`,
        description: `Description ${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        severity: 'info',
        read: i % 2 === 0,
        source: 'fileserver',
      });
    }

    expect(store.list().length).toBe(500);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('ipUtils', () => {
  it('normalizes IPv4, IPv6 and IPv4-mapped IPv6 addresses', () => {
    expect(normalizeClientIp('::ffff:192.168.1.50')).toBe('192.168.1.50');
    expect(normalizeClientIp('::1')).toBe('127.0.0.1');
    expect(normalizeClientIp('localhost')).toBe('127.0.0.1');
    expect(normalizeClientIp('10.0.0.1')).toBe('10.0.0.1');
    expect(normalizeClientIp('')).toBe('127.0.0.1');
    expect(normalizeClientIp(null)).toBe('127.0.0.1');
  });

  it('accurately distinguishes LAN and External addresses', () => {
    expect(isLanIp('127.0.0.1')).toBe(true);
    expect(isLanIp('192.168.0.1')).toBe(true);
    expect(isLanIp('10.1.2.3')).toBe(true);
    expect(isLanIp('172.16.0.5')).toBe(true);
    expect(isLanIp('::ffff:192.168.1.1')).toBe(true);

    // Public / External
    expect(isLanIp('8.8.8.8')).toBe(false);
    expect(isLanIp('142.250.190.46')).toBe(false);
    expect(isLanIp('203.0.113.195')).toBe(false);
  });
});
