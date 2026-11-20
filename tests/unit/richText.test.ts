import { describe, expect, it } from 'vitest';
import { hasRich, parseRich, plainRich } from '../../src/shared/richText';

describe('richText utility', () => {
  it('parses plain text without markers', () => {
    expect(parseRich('hello world')).toEqual(['hello world']);
    expect(plainRich('hello world')).toBe('hello world');
    expect(hasRich('hello world')).toBe(false);
  });

  it('parses bold, italic, underline, and strike formatting', () => {
    expect(parseRich('**bold text**')).toEqual([
      { mark: 'bold', children: ['bold text'] },
    ]);
    expect(plainRich('**bold text**')).toBe('bold text');
    expect(hasRich('**bold text**')).toBe(true);

    expect(parseRich('*italic text*')).toEqual([
      { mark: 'italic', children: ['italic text'] },
    ]);
    expect(plainRich('*italic text*')).toBe('italic text');

    expect(parseRich('__underlined text__')).toEqual([
      { mark: 'underline', children: ['underlined text'] },
    ]);
    expect(plainRich('__underlined text__')).toBe('underlined text');

    expect(parseRich('~~strikethrough~~')).toEqual([
      { mark: 'strike', children: ['strikethrough'] },
    ]);
    expect(plainRich('~~strikethrough~~')).toBe('strikethrough');
  });

  it('handles nested markers correctly', () => {
    const parsed = parseRich('**bold *and italic***');
    expect(parsed).toEqual([
      {
        mark: 'bold',
        children: ['bold ', { mark: 'italic', children: ['and italic'] }],
      },
    ]);
    expect(plainRich('**bold *and italic***')).toBe('bold and italic');
  });

  it('handles unclosed or invalid markers gracefully', () => {
    expect(parseRich('**unclosed bold')).toEqual(['**unclosed bold']);
    expect(plainRich('**unclosed bold')).toBe('**unclosed bold');
    expect(hasRich('**unclosed bold')).toBe(false);

    expect(parseRich('* space after star*')).toEqual(['* space after star*']);
  });
});
