// Smaran 2.7 → 2.8: the app now mixes Anthropic's typefaces (Serif titles, Sans text, Mono times),
// and the font setting picks the text font. The old default text font (Anthropic Serif) moves to
// the new default, Anthropic Sans; a font the user chose is kept.

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

export function v3ToV4(raw: Raw): Raw {
  const settings = isObject(raw['settings']) ? { ...raw['settings'] } : undefined;
  if (settings && (settings['font'] === undefined || settings['font'] === 'Anthropic Serif'))
    settings['font'] = 'Anthropic Sans';
  return { ...raw, version: 4, ...(settings ? { settings } : {}) };
}
