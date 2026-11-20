import * as fs from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { HistoryEntrySchema, type HistoryEntry } from '@shared/schema';

export const HISTORY_FILE = 'history.json';
export const HISTORY_LIMIT = 5000;

export type HistoryListener = (entries: readonly HistoryEntry[]) => void;

/**
 * What happened to each reminder (done, snoozed, missed…), newest first, capped at 1,000 entries.
 * Kept apart from config.json so it never bloats backups. A damaged file just starts empty.
 */
export class HistoryStore {
  private entries: HistoryEntry[] = [];
  private readonly listeners = new Set<HistoryListener>();
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly dir: string,
    private readonly writeDelayMs = 500,
  ) {}

  get filePath(): string {
    return join(this.dir, HISTORY_FILE);
  }

  load(): void {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const parsed = z.array(HistoryEntrySchema).safeParse(raw);
      this.entries = parsed.success ? parsed.data.slice(0, HISTORY_LIMIT) : [];
    } catch {
      this.entries = [];
    }
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

  /** Writes now (used on quit). */
  flush(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = null;
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.entries), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  private changed(): void {
    for (const listener of this.listeners) listener(this.entries);
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => this.flush(), this.writeDelayMs);
  }
}
