const HEX8 = /^#[0-9a-fA-F]{8}$/;
const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Accepts #RRGGBB or #RRGGBBAA; always produces upper-case #RRGGBBAA. */
export function normaliseColor(text: string): string | null {
  const t = text.trim();
  if (HEX8.test(t)) return t.toUpperCase();
  if (HEX6.test(t)) return `${t.toUpperCase()}FF`;
  return null;
}
