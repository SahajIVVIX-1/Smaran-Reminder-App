import * as fs from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { createDefaultConfig, type NewId } from '@shared/defaults';
import type { SaveResult } from '@shared/ipc';
import { ConfigSchema, type Config } from '@shared/schema';
import { migrate } from './migrations';
import { fillDefaults, reconcileState } from './normalize';

export const CONFIG_FILE = 'config.json';
export const BACKUP_DIR = 'backups';

export interface ConfigStoreOptions {
  newId?: NewId;
  now?: () => Date;
  maxBackups?: number;
  /** Used when importing v1 positions, which were relative to the primary screen. */
  primaryDisplayId?: () => number;
}

export interface LoadResult {
  config: Config;
  /** Plain-English message to show the user, or null if loading was uneventful. */
  notice: string | null;
}

export type ConfigListener = (config: Config) => void;

export interface SaveOptions {
  /** Copy the current file into backups/ first. Default true. */
  backup?: boolean;
}

/**
 * The only reader and writer of config.json. Everything else asks it for the config
 * and sends whole validated configs back; it broadcasts every change to listeners.
 */
export class ConfigStore {
  readonly dir: string;
  private config: Config | null = null;
  private readonly listeners = new Set<ConfigListener>();
  private readonly newId: NewId;
  private readonly now: () => Date;
  private readonly maxBackups: number;
  private readonly primaryDisplayId: () => number;

  constructor(dir: string, options: ConfigStoreOptions = {}) {
    this.dir = dir;
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date());
    this.maxBackups = options.maxBackups ?? 5;
    this.primaryDisplayId = options.primaryDisplayId ?? (() => 0);
  }

  get filePath(): string {
    return join(this.dir, CONFIG_FILE);
  }

  get backupDir(): string {
    return join(this.dir, BACKUP_DIR);
  }

  /** Reads config.json, migrating and filling defaults. A damaged file is set aside and replaced. */
  load(): LoadResult {
    fs.mkdirSync(this.dir, { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      return this.startFresh(null);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      return this.startFresh('it is not valid JSON');
    }

    const migrated = migrate(raw, {
      newId: this.newId,
      now: this.now(),
      primaryDisplayId: this.primaryDisplayId(),
    });
    if (migrated.kind === 'newer') {
      return this.startFresh(
        `it was saved by a newer version of Smaran (format ${migrated.version})`,
      );
    }
    if (migrated.kind === 'invalid') {
      return this.startFresh(`it has invalid values:\n${migrated.error}`);
    }

    const parsed = ConfigSchema.safeParse(fillDefaults(migrated.raw));
    if (!parsed.success) {
      return this.startFresh(`it has invalid values:\n${z.prettifyError(parsed.error)}`);
    }

    const config = reconcileState(parsed.data);
    this.config = config;
    if (migrated.kind === 'migrated') {
      const original = `config.before-upgrade-${this.stamp()}.json`;
      fs.copyFileSync(this.filePath, join(this.dir, original));
      this.write(config);
      if (migrated.quiet) return { config, notice: null };
      return {
        config,
        notice: `Your settings were converted from ${migrated.from}. The original file was kept as "${original}" in ${this.dir}.`,
      };
    }
    return { config, notice: null };
  }

  get(): Config {
    if (!this.config) throw new Error('ConfigStore.load() must run before get().');
    return this.config;
  }

  /**
   * Validates and saves a whole config, then tells every listener.
   * Pass `backup: false` for frequent internal writes (scheduler runtime, popup drags)
   * so they don't push real backups out of the rolling set.
   */
  save(next: unknown, options: SaveOptions = {}): SaveResult {
    const parsed = ConfigSchema.safeParse(next);
    if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
    const config = reconcileState(parsed.data);
    try {
      this.write(config, options.backup ?? true);
    } catch (error) {
      return {
        ok: false,
        error: `Could not write ${this.filePath}: ${(error as Error).message}. Check that the folder is not read-only and try again.`,
      };
    }
    this.config = config;
    for (const listener of this.listeners) {
      try {
        listener(config);
      } catch (err) {
        console.error('[ConfigStore] Listener error:', err);
      }
    }
    return { ok: true };
  }

  /** Applies a change to the current config, e.g. a popup drag or a scheduler runtime update. */
  update(change: (current: Config) => Config, options: SaveOptions = {}): SaveResult {
    return this.save(change(structuredClone(this.get())), options);
  }

  onChange(listener: ConfigListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------- internals ----------

  private startFresh(problem: string | null): LoadResult {
    let notice: string | null = null;
    if (problem !== null) {
      const kept = this.setAsideDamaged();
      notice =
        `Smaran could not read your settings because ${problem}\n\n` +
        `It started with default settings. Your old file was kept as "${kept}" in ${this.dir}. ` +
        `Earlier copies are in the "${BACKUP_DIR}" folder there.`;
    }
    const config = createDefaultConfig(this.newId, this.now());
    this.write(config);
    this.config = config;
    return { config, notice };
  }

  private setAsideDamaged(): string {
    const name = `config.invalid-${this.stamp()}.json`;
    fs.renameSync(this.filePath, join(this.dir, name));
    return name;
  }

  /** Backs up the current file, then writes atomically: temp file + rename. */
  private write(config: Config, backup = true): void {
    fs.mkdirSync(this.dir, { recursive: true });
    if (backup && fs.existsSync(this.filePath)) this.backupCurrent();
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  private backupCurrent(): void {
    fs.mkdirSync(this.backupDir, { recursive: true });
    // Fixed-width names (ISO stamp + 2-digit counter for same-millisecond saves) sort oldest first.
    const stamp = this.stamp();
    let n = 0;
    const nameFor = (i: number) => `config-${stamp}-${String(i).padStart(2, '0')}.json`;
    while (fs.existsSync(join(this.backupDir, nameFor(n)))) n++;
    fs.copyFileSync(this.filePath, join(this.backupDir, nameFor(n)));

    const backups = fs
      .readdirSync(this.backupDir)
      .filter((f) => f.startsWith('config-') && f.endsWith('.json'))
      .sort();
    for (const old of backups.slice(0, Math.max(0, backups.length - this.maxBackups))) {
      fs.rmSync(join(this.backupDir, old));
    }
  }

  /** Sortable, filename-safe timestamp. */
  private stamp(): string {
    return this.now().toISOString().replace(/[:.]/g, '-');
  }
}
