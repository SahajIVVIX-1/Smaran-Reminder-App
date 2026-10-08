import { z } from 'zod';
import type { NewId } from '@shared/defaults';
import { ConfigSchema, type Config } from '@shared/schema';
import { migrate } from './migrations';
import { fillDefaults, reconcileRuntime } from './normalize';

/** Full backup: the config exactly as config.json stores it. */
export function exportJson(config: Config): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export type ParseResult = { ok: true; config: Config } | { ok: false; error: string };

export interface ParseOptions {
  newId: NewId;
  now: Date;
  primaryDisplayId: number;
}

/** Reads a JSON backup (or a v1 settings file) into a validated config. Ids are kept. */
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
  const parsed = ConfigSchema.safeParse(fillDefaults(migrated.raw));
  if (!parsed.success) {
    return {
      ok: false,
      error: `This file is not a valid Smaran backup:\n${z.prettifyError(parsed.error)}`,
    };
  }
  return { ok: true, config: reconcileRuntime(parsed.data) };
}

/**
 * Adds an imported config (e.g. converted v1 settings) to the current one instead of replacing it.
 * Imported styles never become the default; ids that already exist are given new ones.
 */
export function mergeConfigs(current: Config, imported: Config, newId: NewId): Config {
  const taken = new Set([
    ...current.styles.map((s) => s.id),
    ...current.messages.map((m) => m.id),
    ...current.schedules.map((s) => s.id),
  ]);
  const remap = new Map<string, string>();
  const idFor = (id: string) => {
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
    const fresh = newId();
    remap.set(id, fresh);
    taken.add(fresh);
    return fresh;
  };

  const styles = imported.styles.map((s) => ({ ...s, id: idFor(s.id), isDefault: false }));
  const styleId = (id: string) => remap.get(id) ?? id;
  const messages = imported.messages.map((m) => ({
    ...m,
    id: idFor(m.id),
    styleId: styleId(m.styleId),
  }));
  const messageId = (id: string) => remap.get(id) ?? id;
  const runtime = { ...current.runtime };
  const schedules = imported.schedules.map((s) => {
    const id = idFor(s.id);
    const old = imported.runtime[s.id];
    if (old) {
      runtime[id] = {
        ...old,
        lastMessageId: old.lastMessageId ? messageId(old.lastMessageId) : null,
        shuffleBag: old.shuffleBag.map(messageId),
      };
    }
    const picker =
      s.picker.messageId !== undefined
        ? { ...s.picker, messageId: messageId(s.picker.messageId) }
        : s.picker;
    return { ...s, id, picker };
  });

  return reconcileRuntime({
    ...current,
    styles: [...current.styles, ...styles],
    messages: [...current.messages, ...messages],
    schedules: [...current.schedules, ...schedules],
    runtime,
  });
}
