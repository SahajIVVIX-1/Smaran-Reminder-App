/**
 * Light formatting for reminder notes and lines, stored as plain text with markers:
 *   **bold**   *italic*   __underline__   ~~strike~~
 * Markers can nest (e.g. **bold *and italic***). Unmatched markers stay as typed.
 */
export type RichMark = 'bold' | 'italic' | 'underline' | 'strike';
export type RichNode = string | { mark: RichMark; children: RichNode[] };

export const RICH_MARKERS: Readonly<Record<RichMark, string>> = {
  bold: '**',
  italic: '*',
  underline: '__',
  strike: '~~',
};

// Two-character markers first, so ** is never read as two italics.
const ORDER: RichMark[] = ['bold', 'underline', 'strike', 'italic'];

function findClose(text: string, marker: string, from: number): number {
  for (let j = from; j < text.length; j++) {
    if (!text.startsWith(marker, j)) continue;
    // For *italic*, a ** inside is bold, not the end.
    if (marker === '*' && text[j + 1] === '*') {
      const bold = text.indexOf('**', j + 2);
      if (bold < 0) return -1;
      j = bold + 1;
      continue;
    }
    // "***" closing **bold *italic***: the italic takes the first star, bold the last two.
    while (marker === '**' && text[j + 2] === '*') j++;
    return j;
  }
  return -1;
}

export function parseRich(text: string): RichNode[] {
  const out: RichNode[] = [];
  let plain = '';
  let i = 0;
  while (i < text.length) {
    let node: RichNode | null = null;
    for (const mark of ORDER) {
      const marker = RICH_MARKERS[mark];
      if (!text.startsWith(marker, i)) continue;
      const start = i + marker.length;
      if (start >= text.length || /\s/.test(text[start] ?? '')) continue;
      const close = findClose(text, marker, start + 1);
      if (close < 0) continue;
      node = { mark, children: parseRich(text.slice(start, close)) };
      i = close + marker.length;
      break;
    }
    if (node) {
      if (plain) out.push(plain);
      plain = '';
      out.push(node);
    } else {
      plain += text[i];
      i++;
    }
  }
  if (plain) out.push(plain);
  return out;
}

/** The text without its markers, e.g. for tooltips. */
export function plainRich(text: string): string {
  const flat = (nodes: RichNode[]): string =>
    nodes.map((n) => (typeof n === 'string' ? n : flat(n.children))).join('');
  return flat(parseRich(text));
}

export function hasRich(text: string): boolean {
  return parseRich(text).some((n) => typeof n !== 'string');
}
