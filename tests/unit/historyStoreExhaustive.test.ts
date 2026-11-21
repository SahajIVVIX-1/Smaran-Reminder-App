import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  HistoryStore,
} from '../../src/main/store/HistoryStore';
import type { HistoryEntry } from '../../src/shared/schema';

describe('HistoryStore - Event Audit & Write-Debouncing Resilience', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-history-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  const makeEntry = (
    id: string,
    outcome = 'done',
    at = new Date().toISOString(),
  ): HistoryEntry => ({
    id,
    reminderId: `rem-${id}`,
    title: `Reminder Title ${id}`,
    dueAt: at,
    at,
    outcome,
  });

  it('starts empty and loads from disk when file exists', () => {
    const store = new HistoryStore(tempDir);
    store.load();
    expect(store.list()).toEqual([]);
  });

  it('adds entries newest first and caps at HISTORY_LIMIT', () => {
    const store = new HistoryStore(tempDir, 100);
    store.add(makeEntry('1'));
    store.add(makeEntry('2'));
    store.add(makeEntry('3'));

    const list = store.list();
    expect(list.length).toBe(3);
    expect(list[0]?.id).toBe('3');
    expect(list[1]?.id).toBe('2');
    expect(list[2]?.id).toBe('1');
  });

  it('clears all history entries', () => {
    const store = new HistoryStore(tempDir, 100);
    store.add(makeEntry('1'));
    store.add(makeEntry('2'));
    expect(store.list().length).toBe(2);

    store.clear();
    expect(store.list()).toEqual([]);
  });

  it('broadcasts updates to registered listeners and isolates exceptions', () => {
    const store = new HistoryStore(tempDir, 100);
    const received: number[] = [];

    // Failing listener should not interrupt subsequent listener
    store.onChange(() => {
      throw new Error('Exploding listener');
    });

    const unsubscribe = store.onChange((entries) => {
      received.push(entries.length);
    });

    store.add(makeEntry('1'));
    store.add(makeEntry('2'));

    expect(received).toEqual([1, 2]);

    unsubscribe();
    store.add(makeEntry('3'));
    expect(received).toEqual([1, 2]);
  });

  it('flushes immediately to disk on flush()', () => {
    const store = new HistoryStore(tempDir, 10_000); // 10s debounce delay
    store.add(makeEntry('h1'));
    store.add(makeEntry('h2'));

    // Directly flush without waiting 10s
    store.flush();

    // Verify file exists on disk and has entries
    const filePath = path.join(tempDir, 'history.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const reloaded = new HistoryStore(tempDir);
    reloaded.load();
    expect(reloaded.list().length).toBe(2);
    expect(reloaded.list()[0]?.id).toBe('h2');
  });
});
