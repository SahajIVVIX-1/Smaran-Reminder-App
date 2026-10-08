import type { StyleFields, StyleOverrides } from './schema';

/** Groups whose fields can be overridden one by one. */
export type GroupKey = 'font' | 'colors' | 'border' | 'size' | 'timing';
export type ScalarKey = 'paddingPx' | 'opacity';

/** Address of one overridable field: a scalar, or a field inside a group. Position is separate. */
export type FieldPath = readonly [ScalarKey] | readonly [GroupKey, string];

export type FieldValue = string | number | boolean;

export function pathKey(path: FieldPath): string {
  return path.join('.');
}

export function getField(fields: StyleFields, path: FieldPath): FieldValue {
  if (path.length === 1) return fields[path[0]];
  const group = fields[path[0]] as unknown as Record<string, FieldValue>;
  return group[path[1]] as FieldValue;
}

/** Returns a copy of `fields` with one field changed. */
export function setField(fields: StyleFields, path: FieldPath, value: FieldValue): StyleFields {
  if (path.length === 1) return { ...fields, [path[0]]: value };
  const [group, key] = path;
  return { ...fields, [group]: { ...fields[group], [key]: value } };
}

export function getOverride(overrides: StyleOverrides, path: FieldPath): FieldValue | undefined {
  if (path.length === 1) return overrides[path[0]];
  const group = overrides[path[0]] as Record<string, FieldValue | undefined> | undefined;
  return group?.[path[1]];
}

/** Returns a copy of `overrides` with one field overridden. */
export function setOverride(
  overrides: StyleOverrides,
  path: FieldPath,
  value: FieldValue,
): StyleOverrides {
  if (path.length === 1) return { ...overrides, [path[0]]: value };
  const [group, key] = path;
  return { ...overrides, [group]: { ...overrides[group], [key]: value } };
}

/** Returns a copy of `overrides` without one field; empty groups are removed. */
export function clearOverride(overrides: StyleOverrides, path: FieldPath): StyleOverrides {
  const without = (obj: object, drop: string) =>
    Object.fromEntries(Object.entries(obj).filter(([k, v]) => k !== drop && v !== undefined));
  if (path.length === 1) return without(overrides, path[0]) as StyleOverrides;
  const [group, key] = path;
  const rest = without(overrides[group] ?? {}, key);
  const next = without(overrides, group);
  return (Object.keys(rest).length > 0 ? { ...next, [group]: rest } : next) as StyleOverrides;
}

/** Paths that `overrides` sets, in the order of `known`. */
export function overriddenPaths(
  overrides: StyleOverrides,
  known: readonly FieldPath[],
): FieldPath[] {
  return known.filter((path) => getOverride(overrides, path) !== undefined);
}
