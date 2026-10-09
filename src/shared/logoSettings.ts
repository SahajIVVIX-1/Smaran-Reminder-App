import { DEFAULT_SEQUENCE, SHAPES, type SceneKey } from './dots/dotsScenes';

/** The shapes in the chosen families, in registry order; no families = the everyday set. */
export function shapesIn(families: readonly string[]): SceneKey[] {
  if (families.length === 0) return [...DEFAULT_SEQUENCE];
  const keys = SHAPES.filter((s) => families.includes(s.category)).map((s) => s.key as SceneKey);
  return keys.length > 0 ? keys : [...DEFAULT_SEQUENCE];
}
