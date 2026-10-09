import { basename, extname } from 'node:path';

export interface FontInfo {
  family: string;
  weight: number;
  italic: boolean;
}

/** Reads family, weight and italic from a TrueType/OpenType file's name and OS/2 tables. */
export function readFontInfo(data: Buffer): FontInfo | null {
  try {
    const tag = data.toString('latin1', 0, 4);
    if (tag !== '\u0000\u0001\u0000\u0000' && tag !== 'OTTO' && tag !== 'true') return null;
    const numTables = data.readUInt16BE(4);
    const tables = new Map<string, { offset: number; length: number }>();
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      tables.set(data.toString('latin1', rec, rec + 4), {
        offset: data.readUInt32BE(rec + 8),
        length: data.readUInt32BE(rec + 12),
      });
    }

    const name = tables.get('name');
    if (!name) return null;
    const count = data.readUInt16BE(name.offset + 2);
    const strings = name.offset + data.readUInt16BE(name.offset + 4);
    const found = new Map<number, string>();
    for (let i = 0; i < count; i++) {
      const r = name.offset + 6 + i * 12;
      const platform = data.readUInt16BE(r);
      const nameId = data.readUInt16BE(r + 6);
      const length = data.readUInt16BE(r + 8);
      const start = strings + data.readUInt16BE(r + 10);
      if (nameId !== 1 && nameId !== 16) continue;
      if (found.has(nameId) && platform !== 3) continue;
      const raw = data.subarray(start, start + length);
      const text =
        platform === 3 || platform === 0
          ? Buffer.from(raw).swap16().toString('utf16le')
          : raw.toString('latin1');
      if (text.trim()) found.set(nameId, text.trim());
    }
    // Typographic family (16) groups all weights under one name; fall back to the legacy one (1).
    const family = found.get(16) ?? found.get(1);
    if (!family) return null;

    let weight = 400;
    let italic = false;
    const os2 = tables.get('OS/2');
    if (os2 && os2.length >= 64) {
      weight = data.readUInt16BE(os2.offset + 4) || 400;
      italic = (data.readUInt16BE(os2.offset + 62) & 1) === 1;
    }
    return { family, weight: Math.min(1000, Math.max(1, weight)), italic };
  } catch {
    return null;
  }
}

/** Guesses a family from a file name like "AnthropicSerif-BoldItalic.woff2" → "Anthropic Serif". */
export function familyFromFileName(file: string): FontInfo {
  const stem = basename(file, extname(file));
  const [base = stem, style = ''] = stem.split(/[-_]/);
  const family = base.replace(/([a-z])([A-Z])/g, '$1 $2').trim() || stem;
  const s = style.toLowerCase();
  const weight = /thin/.test(s)
    ? 100
    : /extralight|ultralight/.test(s)
      ? 200
      : /light/.test(s)
        ? 300
        : /medium/.test(s)
          ? 500
          : /semibold|demibold/.test(s)
            ? 600
            : /extrabold|ultrabold/.test(s)
              ? 800
              : /black|heavy/.test(s)
                ? 900
                : /bold/.test(s)
                  ? 700
                  : 400;
  return { family, weight, italic: /italic|oblique/.test(s) };
}
