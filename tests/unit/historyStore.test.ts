import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { HistoryStore } from '../../src/main/store/HistoryStore';
import type { HistoryEntry } from '../../src/shared/schema';

describe('HistoryStore - Advanced Reliability & Isolation', () => {
  const makeTempDir = () => {
    const dir = path.join(os.tmpdir(), `smaran_history_test_${Date.now()}_${Math.random()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  const sampleEntry = (i: number): HistoryEntry => ({
    id: `entry-${i}`,
    reminderId: `rem-${i}`,
    title: `Task #${i}`,
    dueAt: new Date(2026, 10, 20).toISOString(),
    at: new Date(2026, 10, 20).toISOString(),
    outcome: 'done',
  });

  it('isolates throwing listeners so other listeners run and writes are scheduled', () => {
    const dir = makeTempDir();
    const store = new HistoryStore(dir, 100);

    let secondListenerRan = false;
    // Listener 1: throws
    store.onChange(() => {
      throw new Error('Listener catastrophe');
    });

    // Listener 2: should run despite Listener 1 throwing
    store.onChange(() => {
      secondListenerRan = true;
    });

    expect(() => store.add(sampleEntry(1))).not.toThrow();
    expect(secondListenerRan).toBe(true);

    // Direct flush should write the entry safely
    store.flush();
    expect(fs.existsSync(store.filePath)).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('preserves corrupt file and recovers from valid backup', () => {
    const dir = makeTempDir();
    const store = new HistoryStore(dir, 100);

    // 1. Add valid entry and flush
    store.add(sampleEntry(1));
    store.flush();

    // 2. Add second entry and flush to ensure backup has valid entries
    store.add(sampleEntry(2));
    store.flush();

    expect(fs.existsSync(`${store.filePath}.bak`)).toBe(true);

    // 3. Corrupt the history file
    fs.writeFileSync(store.filePath, '{ corrupt json invalid', 'utf8');

    // 4. Reload into new instance
    const store2 = new HistoryStore(dir, 100);
    store2.load();

    // Should recover valid history from backup
    expect(store2.list().length).toBeGreaterThanOrEqual(1);
    expect(store2.list().some((e) => e.id === 'entry-1')).toBe(true);

    // Check .corrupt preservation
    const files = fs.readdirSync(dir);
    expect(files.some((f) => f.includes('history.json.corrupt.'))).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('clears write timer on explicit flush', () => {
    vi.useFakeTimers();
    const dir = makeTempDir();
    const store = new HistoryStore(dir, 5000);

    store.add(sampleEntry(1));
    // Immediately call flush (simulating app quit)
    store.flush();

    expect(fs.existsSync(store.filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(store.filePath, 'utf8'));
    expect(content).toHaveLength(1);

    vi.useRealTimers();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('schedules bounded retry on write failure', () => {
    vi.useFakeTimers();
    const dir = makeTempDir();
    // Create a file where directory should be to force write failure
    const invalidSubDir = path.join(dir, 'file_blocking_dir');
    fs.writeFileSync(invalidSubDir, 'block', 'utf8');

    const blockedStore = new HistoryStore(path.join(invalidSubDir, 'nested'));
    blockedStore.add(sampleEntry(1));

    // Force flush, which triggers writeAtomicFile catch and schedules retry
    blockedStore.flush();

    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
