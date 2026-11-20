import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileServerStore } from '../../src/main/fileserver/FileServerStore';
import { HfsProcessSupervisor } from '../../src/main/fileserver/HfsProcessSupervisor';
import type { FileServerSecurityEvent } from '../../src/shared/fileserver';

describe('HfsProcessSupervisor - Persistent Failed Login Escalation', () => {
  const makeTempDir = () => {
    const dir = path.join(os.tmpdir(), `smaran_login_esc_test_${Date.now()}_${Math.random()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  it('increments repeatCount on repeated failed logins and persists across restart', () => {
    const dir = makeTempDir();
    const store = new FileServerStore(dir);
    const events: FileServerSecurityEvent[] = [];

    const supervisor = new HfsProcessSupervisor(dir, store, {
      isLicenseValid: () => true,
      onSecurityEvent: (ev) => events.push(ev),
    });

    const failedLog = (ip: string, username = 'attacker') =>
      `[SMARAN_SECURITY_EVENT] ${JSON.stringify({
        type: 'failedLogin',
        username,
        clientIp: ip,
        reason: 'wrong password',
      })}`;

    // 1. First failed attempt from 198.51.100.1
    // @ts-expect-error calling private method for unit test
    supervisor.parseLogLine(failedLog('198.51.100.1'));
    expect(events).toHaveLength(1);
    expect(events[0]?.repeatCount).toBe(1);
    expect(supervisor.getFailedLoginAttempts('198.51.100.1')).toBe(1);

    // 2. Second failed attempt from same IP (IPv4-mapped IPv6 variant)
    // @ts-expect-error calling private method for unit test
    supervisor.parseLogLine(failedLog('::ffff:198.51.100.1'));
    expect(events).toHaveLength(2);
    expect(events[1]?.repeatCount).toBe(2);
    expect(supervisor.getFailedLoginAttempts('198.51.100.1')).toBe(2);

    // 3. Verify failed-logins.json is written
    expect(fs.existsSync(supervisor.failedLoginsPath)).toBe(true);

    // 4. Simulate app restart with new supervisor instance pointing to same directory
    const supervisor2 = new HfsProcessSupervisor(dir, store, {
      isLicenseValid: () => true,
      onSecurityEvent: (ev) => events.push(ev),
    });

    // Count should be preserved after restart
    expect(supervisor2.getFailedLoginAttempts('198.51.100.1')).toBe(2);

    // Third attempt on new instance should increment to 3
    // @ts-expect-error calling private method for unit test
    supervisor2.parseLogLine(failedLog('198.51.100.1'));
    expect(events).toHaveLength(3);
    expect(events[2]?.repeatCount).toBe(3);
    expect(supervisor2.getFailedLoginAttempts('198.51.100.1')).toBe(3);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('resets failed counter on successful authentication', () => {
    const dir = makeTempDir();
    const store = new FileServerStore(dir);
    const supervisor = new HfsProcessSupervisor(dir, store, {
      isLicenseValid: () => true,
    });

    const failedLog = `[SMARAN_SECURITY_EVENT] ${JSON.stringify({
      type: 'failedLogin',
      username: 'user1',
      clientIp: '192.168.1.55',
    })}`;

    const successLog = `[SMARAN_SECURITY_EVENT] ${JSON.stringify({
      type: 'login',
      username: 'user1',
      clientIp: '192.168.1.55',
    })}`;

    // @ts-expect-error test private
    supervisor.parseLogLine(failedLog);
    // @ts-expect-error test private
    supervisor.parseLogLine(failedLog);
    expect(supervisor.getFailedLoginAttempts('192.168.1.55')).toBe(2);

    // User successfully logs in
    // @ts-expect-error test private
    supervisor.parseLogLine(successLog);

    // Counter must be reset to 0
    expect(supervisor.getFailedLoginAttempts('192.168.1.55')).toBe(0);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('expires failed attempts outside the 15-minute rolling window', () => {
    const dir = makeTempDir();
    const store = new FileServerStore(dir);

    // Write an expired entry manually into failed-logins.json (> 15 minutes ago)
    const sixteenMinAgo = Date.now() - 16 * 60 * 1000;
    const oldEntries = [{ ip: '10.0.0.99', count: 5, lastTime: sixteenMinAgo }];
    fs.writeFileSync(path.join(dir, 'failed-logins.json'), JSON.stringify(oldEntries), 'utf8');

    const supervisor = new HfsProcessSupervisor(dir, store, { isLicenseValid: () => true });

    // The expired record must not be counted
    expect(supervisor.getFailedLoginAttempts('10.0.0.99')).toBe(0);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('survives corrupted failed-logins.json without disruption', () => {
    const dir = makeTempDir();
    const store = new FileServerStore(dir);

    // Write corrupted JSON
    fs.writeFileSync(path.join(dir, 'failed-logins.json'), '{ broken unparseable content', 'utf8');

    const supervisor = new HfsProcessSupervisor(dir, store, { isLicenseValid: () => true });
    expect(supervisor.getFailedLoginAttempts('10.0.0.1')).toBe(0);

    // Can still record new logins normally
    const failedLog = `[SMARAN_SECURITY_EVENT] ${JSON.stringify({
      type: 'failedLogin',
      username: 'user1',
      clientIp: '10.0.0.1',
    })}`;
    // @ts-expect-error test private
    supervisor.parseLogLine(failedLog);
    expect(supervisor.getFailedLoginAttempts('10.0.0.1')).toBe(1);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
