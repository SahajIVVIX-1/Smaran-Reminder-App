import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE_FIELDS } from '@shared/defaults';
import { effectiveStyle, mergeStyle, resolveStyle } from '@shared/effectiveStyle';
import type { Message, Style } from '@shared/schema';

const style = (id: string, isDefault = false, sizePx = 22): Style => ({
  id,
  name: id,
  isDefault,
  ...structuredClone(DEFAULT_STYLE_FIELDS),
  font: { ...DEFAULT_STYLE_FIELDS.font, sizePx },
});

const message = (styleId: string, overrides: Message['overrides'] = {}): Message => ({
  id: 'm',
  text: 'Hello',
  enabled: true,
  tags: [],
  styleId,
  overrides,
  createdAt: '2026-10-08T00:00:00.000Z',
  updatedAt: '2026-10-08T00:00:00.000Z',
});

describe('mergeStyle', () => {
  it('returns only style fields, unchanged, when there are no overrides', () => {
    const merged = mergeStyle(style('s'), {});
    expect(merged).toEqual(DEFAULT_STYLE_FIELDS);
    expect(merged).not.toHaveProperty('id');
  });

  it('overrides single fields inside a group and keeps the rest', () => {
    const merged = mergeStyle(DEFAULT_STYLE_FIELDS, {
      font: { sizePx: 30 },
      colors: { text: '#FF0000FF' },
      border: { radiusPx: 0 },
      size: { mode: 'fixed' },
      timing: { stayMs: 9000 },
      paddingPx: 4,
      opacity: 0.5,
    });
    expect(merged.font).toEqual({ ...DEFAULT_STYLE_FIELDS.font, sizePx: 30 });
    expect(merged.colors.background).toBe(DEFAULT_STYLE_FIELDS.colors.background);
    expect(merged.colors.text).toBe('#FF0000FF');
    expect(merged.border).toEqual({ widthPx: 2, radiusPx: 0 });
    expect(merged.size.mode).toBe('fixed');
    expect(merged.timing).toEqual({ ...DEFAULT_STYLE_FIELDS.timing, stayMs: 9000 });
    expect(merged.paddingPx).toBe(4);
    expect(merged.opacity).toBe(0.5);
  });

  it('ignores override keys that are explicitly undefined', () => {
    const merged = mergeStyle(DEFAULT_STYLE_FIELDS, { font: { family: undefined } });
    expect(merged.font.family).toBe('Segoe UI');
  });

  it('replaces position as a whole', () => {
    const merged = mergeStyle(DEFAULT_STYLE_FIELDS, {
      position: { kind: 'exact', displayId: 7, x: 10, y: 20 },
    });
    expect(merged.position).toEqual({ kind: 'exact', displayId: 7, x: 10, y: 20 });
  });

  it('never shares nested objects with its inputs', () => {
    const base = structuredClone(DEFAULT_STYLE_FIELDS);
    const merged = mergeStyle(base, {});
    merged.font.sizePx = 99;
    merged.position.kind = 'exact';
    expect(base.font.sizePx).toBe(22);
    expect(base.position.kind).toBe('anchor');
  });
});

describe('resolveStyle', () => {
  const styles = [style('a'), style('b', true)];

  it('finds the style by id', () => {
    expect(resolveStyle('a', styles).id).toBe('a');
  });

  it('falls back to the default style, then the first', () => {
    expect(resolveStyle('missing', styles).id).toBe('b');
    expect(resolveStyle('missing', [style('a'), style('c')]).id).toBe('a');
  });

  it('throws when there are no styles', () => {
    expect(() => resolveStyle('a', [])).toThrow();
  });
});

describe('effectiveStyle', () => {
  it('merges the message overrides onto its style', () => {
    const styles = [style('big', true, 40)];
    const result = effectiveStyle(message('big', { font: { italic: true } }), styles);
    expect(result.font).toMatchObject({ sizePx: 40, italic: true });
  });
});
