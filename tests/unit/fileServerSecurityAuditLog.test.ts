import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FileServerAuditStore,
  FILESERVER_AUDIT_LIMIT,
} from '../../src/main/fileserver/FileServerAuditStore';
import type { FileServerSecurityEvent } from '../../src/shared/fileserver';

describe('FileServerAuditStore - Exhaustive Security Audit Log Resilience', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-audit-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on windows locks
    }
  });

  const makeEvent = (
    id: string,
    type: FileServerSecurityEvent['type'] = 'login',
    username = 'alice',
    clientIp = '192.168.1.100',
    timestamp = new Date().toISOString(),
  ): FileServerSecurityEvent => ({
    id,
    timestamp,
    type,
    username,
    clientIp,
    details: `Event details for ${id}`,
  });

  it('initializes empty and correctly saves and loads audit events', () => {
    const store = new FileServerAuditStore(tempDir);
    expect(store.getEvents()).toEqual([]);

    const ev = makeEvent('ev-1');
    const added = store.add(ev);
    expect(added).toBe(true);

    const reloaded = new FileServerAuditStore(tempDir);
    const events = reloaded.getEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.id).toBe('ev-1');
    expect(events[0]?.username).toBe('alice');
  });

  it('strictly deduplicates events by ID', () => {
    const store = new FileServerAuditStore(tempDir);
    const ev1 = makeEvent('ev-uniq');
    const ev1Dup = makeEvent('ev-uniq', 'failedLogin', 'bob', '10.0.0.1');

    expect(store.add(ev1)).toBe(true);
    expect(store.add(ev1Dup)).toBe(false);

    expect(store.getEvents().length).toBe(1);
    expect(store.getEvents()[0]?.type).toBe('login');
  });

  it('strictly deduplicates events by composite fingerprint (type:username:ip:timestamp)', () => {
    const store = new FileServerAuditStore(tempDir);
    const ts = '2026-11-21T12:00:00.000Z';
    const evA = makeEvent('id-alpha', 'failedLogin', 'eve', '172.16.0.50', ts);
    const evB = makeEvent('id-beta', 'failedLogin', 'eve', '172.16.0.50', ts);

    expect(store.add(evA)).toBe(true);
    // evB has a different ID but identical fingerprint
    expect(store.add(evB)).toBe(false);
    expect(store.getEvents().length).toBe(1);
  });

  it('rejects events without an ID', () => {
    const store = new FileServerAuditStore(tempDir);
    const invalid = {
      id: '',
      timestamp: new Date().toISOString(),
      type: 'login' as const,
      username: 'alice',
      clientIp: '127.0.0.1',
    };
    expect(store.add(invalid as any)).toBe(false);
  });

  it('enforces FILESERVER_AUDIT_LIMIT capacity and prunes oldest entries', () => {
    const store = new FileServerAuditStore(tempDir);
    const limit = 50; // test with synthetic burst

    for (let i = 0; i < limit + 10; i++) {
      store.add(makeEvent(`burst-${i}`, 'login', `user-${i}`, `10.0.0.${i % 250}`));
    }

    const events = store.getEvents({ limit: 100 });
    expect(events.length).toBe(limit + 10);
    // Newest is burst-59, oldest is burst-0
    expect(events[0]?.id).toBe(`burst-${limit + 9}`);
  });

  it('filters events by type', () => {
    const store = new FileServerAuditStore(tempDir);
    store.add(makeEvent('1', 'login'));
    store.add(makeEvent('2', 'failedLogin'));
    store.add(makeEvent('3', 'adminActivity'));
    store.add(makeEvent('4', 'failedLogin'));

    const failed = store.getEvents({ type: 'failedLogin' });
    expect(failed.length).toBe(2);
    expect(failed.every((e) => e.type === 'failedLogin')).toBe(true);
  });

  it('filters events by case-insensitive username match', () => {
    const store = new FileServerAuditStore(tempDir);
    store.add(makeEvent('1', 'login', 'AliceAdministrator'));
    store.add(makeEvent('2', 'login', 'BobManager'));
    store.add(makeEvent('3', 'login', 'aliceGuest'));

    const alices = store.getEvents({ username: 'ALICE' });
    expect(alices.length).toBe(2);
    expect(alices.map((e) => e.id)).toEqual(['3', '1']);
  });

  it('filters events by IP address substring match', () => {
    const store = new FileServerAuditStore(tempDir);
    store.add(makeEvent('1', 'login', 'user1', '192.168.1.10'));
    store.add(makeEvent('2', 'login', 'user2', '10.0.0.5'));
    store.add(makeEvent('3', 'login', 'user3', '192.168.2.20'));

    const subnet192 = store.getEvents({ ip: '192.168.' });
    expect(subnet192.length).toBe(2);
    expect(subnet192.map((e) => e.id)).toEqual(['3', '1']);
  });

  it('filters events by date ranges (fromDate, toDate)', () => {
    const store = new FileServerAuditStore(tempDir);
    store.add(makeEvent('early', 'login', 'a', '127.0.0.1', '2026-01-01T10:00:00Z'));
    store.add(makeEvent('mid', 'login', 'a', '127.0.0.1', '2026-06-01T10:00:00Z'));
    store.add(makeEvent('late', 'login', 'a', '127.0.0.1', '2026-12-01T10:00:00Z'));

    const inRange = store.getEvents({
      fromDate: '2026-05-01T00:00:00Z',
      toDate: '2026-07-01T00:00:00Z',
    });
    expect(inRange.length).toBe(1);
    expect(inRange[0]?.id).toBe('mid');
  });

  it('clears all events and removes tracking fingerprints', () => {
    const store = new FileServerAuditStore(tempDir);
    const ts = '2026-11-21T10:00:00Z';
    store.add(makeEvent('ev-reset', 'login', 'user', '127.0.0.1', ts));
    expect(store.getEvents().length).toBe(1);

    store.clear();
    expect(store.getEvents()).toEqual([]);

    // Should now allow re-adding the same event ID and fingerprint
    const reAdd = store.add(makeEvent('ev-reset', 'login', 'user', '127.0.0.1', ts));
    expect(reAdd).toBe(true);
    expect(store.getEvents().length).toBe(1);
  });
});
