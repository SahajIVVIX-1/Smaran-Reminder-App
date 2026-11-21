import { describe, expect, it } from 'vitest';
import { parseRich, plainRich, type RichNode } from '@shared/richText';

describe('richTextFormatting - Markdown Tokenizer & Plain Text Extraction', () => {
  it('parses basic bold, italic, underline and strikethrough markers', () => {
    const boldNodes = parseRich('Hello **world**!');
    expect(boldNodes).toEqual([
      'Hello ',
      { mark: 'bold', children: ['world'] },
      '!',
    ]);

    const italicNodes = parseRich('Some *italic* words');
    expect(italicNodes).toEqual([
      'Some ',
      { mark: 'italic', children: ['italic'] },
      ' words',
    ]);

    const underNodes = parseRich('__Underlined__ headline');
    expect(underNodes).toEqual([
      { mark: 'underline', children: ['Underlined'] },
      ' headline',
    ]);

    const strikeNodes = parseRich('~~Strikethrough~~ item');
    expect(strikeNodes).toEqual([
      { mark: 'strike', children: ['Strikethrough'] },
      ' item',
    ]);
  });

  it('handles nested combinations like bold italic and strike', () => {
    const nested = parseRich('**Bold and *italic* together**');
    expect(nested).toEqual([
      {
        mark: 'bold',
        children: ['Bold and ', { mark: 'italic', children: ['italic'] }, ' together'],
      },
    ]);

    const triple = parseRich('***Everything***');
    expect(triple).toBeDefined();
    expect(plainRich('***Everything***')).toBe('Everything');
  });

  it('leaves unclosed markers or markers followed by whitespace as literal text', () => {
    const unclosed = parseRich('**Never closed text');
    expect(unclosed).toEqual(['**Never closed text']);

    const spaceAfter = parseRich('** not bold **');
    expect(spaceAfter).toEqual(['** not bold **']);

    const loneStar = parseRich('3 * 4 = 12 * 2');
    expect(loneStar).toEqual(['3 * 4 = 12 * 2']);
  });

  it('strips all formatting nodes cleanly in plainRich', () => {
    const raw = 'Start **bold __under *italic*__** and ~~strike~~ end.';
    const plain = plainRich(raw);
    expect(plain).toBe('Start bold under italic and strike end.');
  });

  it('handles HTML injection characters and Unicode symbols without corruption', () => {
    const htmlPayload = '<script>alert("xss")</script> & <b>test</b>';
    expect(plainRich(htmlPayload)).toBe(htmlPayload);

    const unicodePayload = '🌟 Reminder: Drink 💧 water and breathe 🧘!';
    expect(plainRich(unicodePayload)).toBe(unicodePayload);
  });

  it('safely handles large multiline texts without recursion overflow', () => {
    const largeParagraph = 'This is a **repeating** *note* block.\n'.repeat(500);
    const nodes = parseRich(largeParagraph);
    expect(nodes.length).toBeGreaterThan(500);
    expect(plainRich(largeParagraph).length).toBeGreaterThan(10000);
  });
});
