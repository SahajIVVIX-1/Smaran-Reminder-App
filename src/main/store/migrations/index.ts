import { z } from 'zod';
import type { NewId } from '@shared/defaults';
import { ConfigSchema as V1ConfigSchema } from '@shared/legacy/schemaV1';
import { SCHEMA_VERSION } from '@shared/schema';
import { fillDefaults as fillDefaultsV1, reconcileRuntime } from './normalizeV1';
import { importV1, isV1Settings, type V1ImportOptions } from './v0_to_v1';
import { v1ToV2 } from './v1_to_v2';

export interface MigrateOptions extends V1ImportOptions {
  newId: NewId;
}

export type MigrateResult =
  | { kind: 'current'; raw: unknown }
  | { kind: 'migrated'; raw: unknown; from: string }
  | { kind: 'newer'; version: number }
  | { kind: 'invalid'; error: string };

/**
 * Brings raw file content up to SCHEMA_VERSION:
 *   Smaran v1 (Python) settings → 2.0 config → 2.1 reminders.
 * A 'current' or 'migrated' result still has to pass the current ConfigSchema.
 */
export function migrate(raw: unknown, opts: MigrateOptions): MigrateResult {
  if (isV1Settings(raw)) {
    return {
      kind: 'migrated',
      raw: v1ToV2(importV1(raw, opts), opts.newId, opts.now),
      from: 'Smaran v1',
    };
  }

  const version =
    typeof raw === 'object' && raw !== null && 'version' in raw ? Number(raw.version) : NaN;
  if (version > SCHEMA_VERSION) return { kind: 'newer', version };

  if (version === 1) {
    const old = V1ConfigSchema.safeParse(fillDefaultsV1(raw));
    if (!old.success) return { kind: 'invalid', error: z.prettifyError(old.error) };
    return {
      kind: 'migrated',
      raw: v1ToV2(reconcileRuntime(old.data), opts.newId, opts.now),
      from: 'Smaran 2.0',
    };
  }
  return { kind: 'current', raw };
}

export { importV1, isV1Settings, v1ToV2 };
export type { V1ImportOptions };
