import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileServerAuditStore } from '../../src/main/fileserver/FileServerAuditStore';
import { FileServerManager } from '../../src/main/fileserver/FileServerManager';
import type { FileServerSecurityEvent } from '../../src/shared/fileserver';

describe('FileServerAuditStore - Persistent Security & Audit Events', () => {
  const makeTempDir = () => {
    const dir = path.join(os.tmpdir(), `smaran_audit_test_${Date.now()}_${Math.random()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  const sampleEvent = (
    type: FileServerSecurityEvent['type'],
    username: string,
    ip: string,
    timestamp: string,
  ): FileServerSecurityEvent => ({
    id: `ev-${Math.random()}`,
    type,
    username,
    clientIp: ip,
    accessType: ip === '127.0.0.1' ? 'LAN' : 'External',
    timestamp,
    details: `${type} event for ${username}`,
  });

  it('persists security events and survives simulated application restart', () => {
    const dir = makeTempDir();
    const store = new FileServerAuditStore(dir);

    const ev1 = sampleEvent(
      'login',
      'alice',
      '192.168.1.5',
      new Date(2026, 10, 20, 10, 0, 0).toISOString(),
    );
    const ev2 = sampleEvent(
      'failedLogin',
      'attacker',
      '203.0.113.1',
      new Date(2026, 10, 20, 10, 5, 0).toISOString(),
    );
    const ev3 = sampleEvent(
      'adminActivity',
      'smaran',
      '127.0.0.1',
      new Date(2026, 10, 20, 10, 10, 0).toISOString(),
    );

    store.add(ev1);
    store.add(ev2);
    store.add(ev3);

    expect(store.getEvents()).toHaveLength(3);

    // Simulate restart by creating new instance at same path
    const storeAfterRestart = new FileServerAuditStore(dir);
    const restored = storeAfterRestart.getEvents();
    expect(restored).toHaveLength(3);
    expect(restored.map((e) => e.username)).toContain('alice');
    expect(restored.map((e) => e.username)).toContain('attacker');
    expect(restored.map((e) => e.username)).toContain('smaran');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('deduplicates identical events by ID and event fingerprint', () => {
    const dir = makeTempDir();
    const store = new FileServerAuditStore(dir);

    const ev = sampleEvent('login', 'bob', '192.168.1.10', new Date().toISOString());

    // First add succeeds
    expect(store.add(ev)).toBe(true);

    // Exact same event ID is rejected
    expect(store.add(ev)).toBe(false);

    // Same fingerprint (type, username, ip, timestamp) with different ID is also deduplicated
    const dupFingerprint = { ...ev, id: 'different-id' };
    expect(store.add(dupFingerprint)).toBe(false);

    expect(store.getEvents()).toHaveLength(1);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('filters audit records by type, username, IP, date range, and limit', () => {
    const dir = makeTempDir();
    const store = new FileServerAuditStore(dir);

    const t1 = new Date(2026, 10, 20, 9, 0, 0).toISOString();
    const t2 = new Date(2026, 10, 20, 12, 0, 0).toISOString();
    const t3 = new Date(2026, 10, 20, 15, 0, 0).toISOString();

    store.add(sampleEvent('login', 'alice', '192.168.1.20', t1));
    store.add(sampleEvent('failedLogin', 'bob', '10.0.0.5', t2));
    store.add(sampleEvent('adminActivity', 'alice', '127.0.0.1', t3));

    // Filter by type
    expect(store.getEvents({ type: 'failedLogin' })).toHaveLength(1);
    expect(store.getEvents({ type: 'failedLogin' })[0]?.username).toBe('bob');

    // Filter by username
    expect(store.getEvents({ username: 'alice' })).toHaveLength(2);

    // Filter by IP
    expect(store.getEvents({ ip: '10.0.0.5' })).toHaveLength(1);

    // Filter by date range
    const fromDate = new Date(2026, 10, 20, 11, 0, 0).toISOString();
    const toDate = new Date(2026, 10, 20, 14, 0, 0).toISOString();
    const dateFiltered = store.getEvents({ fromDate, toDate });
    expect(dateFiltered).toHaveLength(1);
    expect(dateFiltered[0]?.username).toBe('bob');

    // Limit check
    expect(store.getEvents({ limit: 1 })).toHaveLength(1);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('integrates with FileServerManager to provide persistent events and filtering', () => {
    const dir = makeTempDir();
    const manager = new FileServerManager(dir, () => true);

    const ev: FileServerSecurityEvent = {
      id: 'mgr-test-1',
      type: 'login',
      username: 'testadmin',
      clientIp: '192.168.1.1',
      accessType: 'LAN',
      timestamp: new Date().toISOString(),
      details: 'Test Manager Login',
    };

    // @ts-expect-error accessing private method for integration test
    manager.handleSecurityEvent(ev);

    const events = manager.getSecurityEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.username).toBe('testadmin');

    // Verify persisted on disk in fileserver-audit.json
    expect(fs.existsSync(path.join(dir, 'fileserver-audit.json'))).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
