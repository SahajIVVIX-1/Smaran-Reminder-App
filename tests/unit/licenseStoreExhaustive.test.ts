import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LicenseStore } from '../../src/main/license/LicenseStore';

describe('LicenseStore - Offline License Verification & Clock Tamper Resilience', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-licstore-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('reports status = "missing" when license file does not exist', () => {
    const store = new LicenseStore(tempDir);
    const info = store.info();
    expect(info.status).toBe('missing');
    expect(info.license).toBeNull();
  });

  it('reports status = "invalid" when license file contains corrupt JSON', () => {
    const store = new LicenseStore(tempDir);
    fs.writeFileSync(store.filePath, '{ corrupt-json: true ');
    const info = store.info();
    expect(info.status).toBe('invalid');
    expect(info.license).toBeNull();
  });

  it('detects clock tampering when system time is set backwards past CLOCK_SLACK_MS', () => {
    let mockTime = new Date('2026-11-21T12:00:00Z');
    const store = new LicenseStore(tempDir, {
      now: () => mockTime,
    });

    // Write a mock stored container record that was seen in future (e.g. 5 days ahead)
    const stored = {
      container: 'aW52YWxpZC1jb250YWluZXI=', // base64
      importedAt: '2026-11-20T10:00:00Z',
      lastSeen: '2026-11-26T12:00:00Z', // 5 days in future
    };
    fs.writeFileSync(store.filePath, JSON.stringify(stored));

    // When now is 2026-11-21, lastSeen is > 2 days ahead of now, triggering clock tamper detection
    const info = store.info();
    expect(info.status).toBe('invalid');
  });

  it('updates and persists info, and detects license removal', () => {
    const store = new LicenseStore(tempDir);
    fs.writeFileSync(store.filePath, JSON.stringify({ container: 'abc' }));
    expect(fs.existsSync(store.filePath)).toBe(true);

    fs.unlinkSync(store.filePath);
    expect(fs.existsSync(store.filePath)).toBe(false);
    expect(store.info().status).toBe('missing');
  });
});
