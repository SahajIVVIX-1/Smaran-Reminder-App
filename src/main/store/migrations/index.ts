import { SCHEMA_VERSION } from '@shared/schema';
import { importV1, isV1Settings, type V1ImportOptions } from './v0_to_v1';

export type MigrateResult =
  | { kind: 'current'; raw: unknown }
  | { kind: 'migrated'; raw: unknown; from: string }
  | { kind: 'newer'; version: number };

/**
 * Brings raw file content up to SCHEMA_VERSION. The result still has to pass ConfigSchema.
 * Future schema versions add a step here: `if (version === 1) raw = v1_to_v2(raw)`.
 */
export function migrate(raw: unknown, opts: V1ImportOptions): MigrateResult {
  if (isV1Settings(raw)) return { kind: 'migrated', raw: importV1(raw, opts), from: 'Smaran v1' };

  const version =
    typeof raw === 'object' && raw !== null && 'version' in raw ? Number(raw.version) : NaN;
  if (version > SCHEMA_VERSION) return { kind: 'newer', version };
  return { kind: 'current', raw };
}

export { importV1, isV1Settings };
export type { V1ImportOptions };
