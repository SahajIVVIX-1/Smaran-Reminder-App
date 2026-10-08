import { getFonts } from 'font-list';

const FALLBACK = [
  'Segoe UI',
  'Arial',
  'Calibri',
  'Cambria',
  'Consolas',
  'Georgia',
  'Tahoma',
  'Verdana',
];

let cached: Promise<string[]> | null = null;

/** Installed font families, sorted, for the font picker. Falls back to common Windows fonts. */
export function listFonts(): Promise<string[]> {
  cached ??= getFonts({ disableQuoting: true })
    .then((fonts) =>
      [...new Set(fonts.map((f) => f.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    )
    .then((fonts) => (fonts.length > 0 ? fonts : FALLBACK))
    .catch(() => FALLBACK);
  return cached;
}
