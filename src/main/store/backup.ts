import { z } from 'zod';
import type { NewId } from '@shared/defaults';
import { ConfigSchema, type Config } from '@shared/schema';
import { migrate } from './migrations';
import { fillDefaults, reconcileState } from './normalize';

/** Full backup: the config exactly as config.json stores it. */
export function exportJson(config: Config): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export type ParseResult =
  { ok: true; config: Config; from: string | null } | { ok: false; error: string };

export interface ParseOptions {
  newId: NewId;
  now: Date;
  primaryDisplayId: number;
}

/** Reads a backup, a Smaran 2.0 config or a v1 settings file into a validated config. Ids are kept. */
export function parseBackupJson(text: string, opts: ParseOptions): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return {
      ok: false,
      error: 'This file is not valid JSON. Choose a Smaran backup (.json) file.',
    };
  }
  const migrated = migrate(raw, opts);
  if (migrated.kind === 'newer') {
    return {
      ok: false,
      error: `This backup was made by a newer version of Smaran (format ${migrated.version}). Update Smaran, then import it again.`,
    };
  }
  if (migrated.kind === 'invalid') {
    return { ok: false, error: `This file is not a valid Smaran backup:\n${migrated.error}` };
  }
  const parsed = ConfigSchema.safeParse(fillDefaults(migrated.raw));
  if (!parsed.success) {
    return {
      ok: false,
      error: `This file is not a valid Smaran backup:\n${z.prettifyError(parsed.error)}`,
    };
  }
  return {
    ok: true,
    config: reconcileState(parsed.data),
    from: migrated.kind === 'migrated' ? migrated.from : null,
  };
}

/**
 * Adds the reminders and automations of an imported config to the current one.
 * Colliding ids get new ones.
 */
export function mergeReminders(current: Config, imported: Config, newId: NewId): Config {
  const taken = new Set([...current.reminders, ...current.automations].map((x) => x.id));
  const state = { ...current.state };
  const added = imported.reminders.map((r) => {
    const id = taken.has(r.id) ? newId() : r.id;
    taken.add(id);
    const old = imported.state[r.id];
    if (old) state[id] = old;
    return { ...r, id };
  });
  const automations = imported.automations.map((a) => {
    const id = taken.has(a.id) ? newId() : a.id;
    taken.add(id);
    return { ...a, id };
  });
  return reconcileState({
    ...current,
    reminders: [...current.reminders, ...added],
    automations: [...current.automations, ...automations],
    state,
  });
}
