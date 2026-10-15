import { z } from 'zod';
import type { NewId } from '@shared/defaults';
import { ConfigSchema as V1ConfigSchema } from '@shared/legacy/schemaV1';
import { SCHEMA_VERSION } from '@shared/schema';
import { fillDefaults as fillDefaultsV1, reconcileRuntime } from './normalizeV1';
import { importV1, isV1Settings, type V1ImportOptions } from './v0_to_v1';
import { v1ToV2 } from './v1_to_v2';
import { v2ToV3 } from './v2_to_v3';
import { v3ToV4 } from './v3_to_v4';
import { v4ToV5 } from './v4_to_v5';

export interface MigrateOptions extends V1ImportOptions {
  newId: NewId;
}

export type MigrateResult =
  | { kind: 'current'; raw: unknown }
  /** `quiet`: a small format update the user needn't be told about. */
  | { kind: 'migrated'; raw: unknown; from: string; quiet?: boolean }
  | { kind: 'newer'; version: number }
  | { kind: 'invalid'; error: string };

/**
 * Brings raw file content up to SCHEMA_VERSION:
 *   Smaran v1 (Python) settings → 2.0 config → reminders (2.1) → 2.2 → 2.8 → 2.13.
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
  if (version === 2) {
    return {
      kind: 'migrated',
      raw: v4ToV5(v3ToV4(v2ToV3(raw as Record<string, unknown>))),
      from: 'Smaran 2.1',
      quiet: true,
    };
  }
  if (version === 3) {
    return {
      kind: 'migrated',
      raw: v4ToV5(v3ToV4(raw as Record<string, unknown>)),
      from: 'Smaran 2.7',
      quiet: true,
    };
  }
  if (version === 4) {
    return {
      kind: 'migrated',
      raw: v4ToV5(raw as Record<string, unknown>),
      from: 'Smaran 2.12',
      quiet: true,
    };
  }
  return { kind: 'current', raw };
}

export { importV1, isV1Settings, v1ToV2, v2ToV3, v3ToV4, v4ToV5 };
export type { V1ImportOptions };
