/**
 * Fonts. The UI mixes Anthropic's typefaces: Serif for titles and, by default, for text too (the
 * font setting) and Mono for times and numbers. Anthropic's typefaces are their own and can't be
 * shipped inside the app, so each one has an open-licence stand-in that Smaran bundles; the moment
 * the real font is installed on the PC (or added under Settings) it is used instead.
 */
export const DEFAULT_FONT = 'Anthropic Serif';

/** Open-licence fonts bundled with the app (CSS family names from @fontsource-variable). */
export const BUNDLED = [
  { family: 'Source Serif 4 Variable', label: 'Source Serif 4', kind: 'serif' },
  { family: 'Inter Variable', label: 'Inter', kind: 'sans' },
  { family: 'JetBrains Mono Variable', label: 'JetBrains Mono', kind: 'mono' },
] as const;

/** Anthropic's typefaces and the bundled font used until the real one is available. */
export const ANTHROPIC = [
  { family: 'Anthropic Serif', standIn: 'Source Serif 4 Variable', generic: 'serif' },
  { family: 'Anthropic Sans', standIn: 'Inter Variable', generic: 'sans-serif' },
  { family: 'Anthropic Mono', standIn: 'JetBrains Mono Variable', generic: 'monospace' },
] as const;

const UI_FALLBACK = "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif";

const quote = (family: string) => `'${family.replace(/['\\]/g, '')}'`;

/** CSS font-family for a chosen font, with sensible fallbacks (and stand-ins for Anthropic fonts). */
export function fontStack(family: string): string {
  const anthropic = ANTHROPIC.find((f) => f.family === family);
  if (anthropic) return `${quote(family)}, ${quote(anthropic.standIn)}, ${anthropic.generic}`;
  return `${quote(family)}, ${UI_FALLBACK}`;
}

/** Display name for a font family ("Inter Variable" → "Inter"). */
export function fontLabel(family: string): string {
  return BUNDLED.find((f) => f.family === family)?.label ?? family;
}

export interface CustomFont {
  family: string;
  /** smaran-font:// URL of the file. */
  url: string;
  weight: number;
  italic: boolean;
}

export interface FontCatalog {
  /** Families installed on this PC. */
  system: string[];
  /** Font files the user added in Settings. */
  custom: CustomFont[];
}

/** CSS @font-face rules for added font files. */
export function fontFaceCss(custom: readonly CustomFont[]): string {
  return custom
    .map(
      (f) =>
        `@font-face{font-family:${quote(f.family)};src:url("${f.url}");font-weight:${f.weight};font-style:${f.italic ? 'italic' : 'normal'};font-display:swap}`,
    )
    .join('\n');
}
