import type { Message, Style, StyleFields, StyleOverrides } from './schema';

/**
 * Applies a message's overrides on top of its style's fields.
 * Nested groups (font, colors, …) merge per field; `position` is replaced as a whole
 * because an anchor and an exact spot have different shapes.
 */
export function mergeStyle(base: StyleFields, overrides: StyleOverrides): StyleFields {
  return {
    font: mergeGroup(base.font, overrides.font),
    colors: mergeGroup(base.colors, overrides.colors),
    border: mergeGroup(base.border, overrides.border),
    paddingPx: overrides.paddingPx ?? base.paddingPx,
    opacity: overrides.opacity ?? base.opacity,
    size: mergeGroup(base.size, overrides.size),
    timing: mergeGroup(base.timing, overrides.timing),
    position: { ...(overrides.position ?? base.position) },
  };
}

/** Shallow merge that ignores keys explicitly set to undefined. */
function mergeGroup<T extends object>(base: T, over: Partial<T> | undefined): T {
  const out = { ...base };
  if (!over) return out;
  for (const key of Object.keys(over) as (keyof T)[]) {
    const value = over[key];
    if (value !== undefined) out[key] = value as T[keyof T];
  }
  return out;
}

/** Finds the message's style, falling back to the default style (then the first) if it is missing. */
export function resolveStyle(styleId: string, styles: readonly Style[]): Style {
  const style =
    styles.find((s) => s.id === styleId) ?? styles.find((s) => s.isDefault) ?? styles[0];
  if (!style) throw new Error('No styles are defined.');
  return style;
}

/** The one function preview, test popup and real popup all use to decide how a message looks. */
export function effectiveStyle(message: Message, styles: readonly Style[]): StyleFields {
  return mergeStyle(resolveStyle(message.styleId, styles), message.overrides);
}
