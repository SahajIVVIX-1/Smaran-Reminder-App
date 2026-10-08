import type { Id, Message } from './schema';

/** CSV holds messages only (text, tags, enabled). Full backups use JSON. */
export const CSV_HEADER = ['text', 'tags', 'enabled'] as const;
const TAG_SEPARATOR = ';';

function escapeField(value: string): string {
  return /[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function messagesToCsv(messages: readonly Message[]): string {
  const rows = [
    CSV_HEADER.join(','),
    ...messages.map((m) =>
      [m.text, m.tags.join(TAG_SEPARATOR), String(m.enabled)].map(escapeField).join(','),
    ),
  ];
  return `${rows.join('\r\n')}\r\n`;
}

/** RFC 4180 parser: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export interface CsvImportOptions {
  styleId: Id;
  newId: () => Id;
  now: Date;
}

export interface CsvImportResult {
  messages: Message[];
  skipped: number;
}

/**
 * Reads messages from CSV. A header row (with a "text" column) is optional; without one the
 * columns are text, tags, enabled. Imported messages get `styleId` (the default style).
 * Rows with no text, and v1's "GLOBAL" rows, are skipped.
 */
export function csvToMessages(input: string, opts: CsvImportOptions): CsvImportResult {
  const rows = parseCsv(input);
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const hasHeader = header.includes('text');
  const col = (name: (typeof CSV_HEADER)[number], fallback: number) =>
    hasHeader ? header.indexOf(name) : fallback;
  const textCol = col('text', 0);
  const tagsCol = col('tags', 1);
  const enabledCol = col('enabled', 2);
  const stamp = opts.now.toISOString();

  const messages: Message[] = [];
  let skipped = 0;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const text = (row[textCol] ?? '').trim();
    if (!text || text === 'GLOBAL') {
      skipped++;
      continue;
    }
    const tags = (tagsCol >= 0 ? (row[tagsCol] ?? '') : '')
      .split(TAG_SEPARATOR)
      .map((t) => t.trim())
      .filter(Boolean);
    const enabledText = (enabledCol >= 0 ? (row[enabledCol] ?? '') : '').trim().toLowerCase();
    messages.push({
      id: opts.newId(),
      text,
      enabled: !['false', '0', 'no', 'off'].includes(enabledText),
      tags: [...new Set(tags)],
      styleId: opts.styleId,
      overrides: {},
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  return { messages, skipped };
}
