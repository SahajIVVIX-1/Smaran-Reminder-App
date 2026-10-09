import { describe, expect, it } from 'vitest';
import { MenuEntriesSchema, MenuPickSchema, separator } from '@shared/menu';

describe('menu entries', () => {
  it('accepts items, separators and headings', () => {
    const items = [
      { kind: 'item', id: 'copy', label: 'Copy', hint: 'Ctrl+C' },
      separator,
      { kind: 'heading', label: 'Snooze' },
      { kind: 'item', id: 'delete', label: 'Delete', danger: true, disabled: false },
    ];
    expect(MenuEntriesSchema.parse(items)).toEqual(items);
  });

  it('rejects empty, oversized or malformed menus', () => {
    expect(MenuEntriesSchema.safeParse([]).success).toBe(false);
    expect(MenuEntriesSchema.safeParse([{ kind: 'item', id: '', label: 'x' }]).success).toBe(false);
    expect(MenuEntriesSchema.safeParse(Array(41).fill(separator)).success).toBe(false);
    expect(MenuEntriesSchema.safeParse([{ kind: 'script' }]).success).toBe(false);
  });

  it('accepts a chosen id or null', () => {
    expect(MenuPickSchema.parse(null)).toBeNull();
    expect(MenuPickSchema.parse('snooze-1')).toBe('snooze-1');
    expect(MenuPickSchema.safeParse(5).success).toBe(false);
  });
});
