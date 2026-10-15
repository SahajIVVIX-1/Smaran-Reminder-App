// Smaran 2.12 → 2.13: Anthropic Serif becomes the default text font everywhere. The old default
// (Anthropic Sans) moves to it; a font the user chose is kept.

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

export function v4ToV5(raw: Raw): Raw {
  const settings = isObject(raw['settings']) ? { ...raw['settings'] } : undefined;
  if (settings && (settings['font'] === undefined || settings['font'] === 'Anthropic Sans'))
    settings['font'] = 'Anthropic Serif';
  return { ...raw, version: 5, ...(settings ? { settings } : {}) };
}
