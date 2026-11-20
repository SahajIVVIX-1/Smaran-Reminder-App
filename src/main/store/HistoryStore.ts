import { join } from 'node:path';
import { z } from 'zod';
import { HistoryEntrySchema, type HistoryEntry } from '@shared/schema';
import { cleanupStaleTempFiles, readValidatedJson, writeAtomicFile } from './atomicFile';

export const HISTORY_FILE = 'history.json';
export const HISTORY_LIMIT = 5000;

export type HistoryListener = (entries: readonly HistoryEntry[]) => void;

/**
 * What happened to each reminder (done, snoozed, missed…), newest first, capped at 5,000 entries.
 * Kept apart from config.json so it never bloats backups.
 */
export class HistoryStore {
  private entries: HistoryEntry[] = [];
  private readonly listeners = new Set<HistoryListener>();
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly dir: string,
    private readonly writeDelayMs = 500,
  ) {
    cleanupStaleTempFiles(dir, HISTORY_FILE);
  }

  get filePath(): string {
    return join(this.dir, HISTORY_FILE);
  }

  load(): void {
    const res = readValidatedJson(this.filePath, z.array(HistoryEntrySchema), [], {
      onRecovered: (msg) => console.log(`[HistoryStore] ${msg}`),
      onCorrupt: (err, corruptPath) =>
        console.warn(`[HistoryStore] Corrupt history preserved to ${corruptPath}:`, err),
    });
    this.entries = res.data.slice(0, HISTORY_LIMIT);
  }

  list(): readonly HistoryEntry[] {
    return this.entries;
  }

  add(entry: HistoryEntry): void {
    this.entries = [entry, ...this.entries].slice(0, HISTORY_LIMIT);
    this.changed();
  }

  clear(): void {
    this.entries = [];
    this.changed();
  }

  onChange(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Writes now (used on quit and shutdown). */
  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.performFlush();
  }

  private performFlush(retryCount = 0): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    try {
      writeAtomicFile(this.filePath, JSON.stringify(this.entries), {
        backup: true,
        maxRetries: 3,
      });
    } catch (err) {
      console.error(`[HistoryStore] Failed flushing history (attempt ${retryCount + 1}):`, err);
      if (retryCount < 3) {
        const backoff = (retryCount + 1) * 200;
        this.writeTimer = setTimeout(() => {
          this.performFlush(retryCount + 1);
        }, backoff);
      }
    }
  }

  private scheduleWrite(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }
    this.writeTimer = setTimeout(() => {
      this.performFlush();
    }, this.writeDelayMs);
  }

  private changed(): void {
    // Isolated listener execution: one failing listener does not interrupt others or write scheduling
    for (const listener of this.listeners) {
      try {
        listener(this.entries);
      } catch (err) {
        console.error('[HistoryStore] Listener error:', err);
      }
    }
    this.scheduleWrite();
  }
}
