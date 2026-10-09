import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT, fontFaceCss, fontLabel, fontStack } from '@shared/fonts';
import { familyFromFileName, readFontInfo } from '../../src/main/system/fontFile';

describe('font stacks', () => {
  it('defaults to Anthropic Sans, with the bundled stand-ins behind each Anthropic font', () => {
    expect(DEFAULT_FONT).toBe('Anthropic Sans');
    expect(fontStack('Anthropic Serif')).toBe(
      "'Anthropic Serif', 'Source Serif 4 Variable', serif",
    );
    expect(fontStack('Anthropic Mono')).toBe(
      "'Anthropic Mono', 'JetBrains Mono Variable', monospace",
    );
  });

  it('falls back to the Windows UI font for other fonts, and strips quotes', () => {
    expect(fontStack("Bad'Name")).toBe(
      "'BadName', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif",
    );
  });

  it('shows friendly names for bundled fonts', () => {
    expect(fontLabel('Inter Variable')).toBe('Inter');
    expect(fontLabel('Georgia')).toBe('Georgia');
  });

  it('writes @font-face rules for added files', () => {
    expect(
      fontFaceCss([
        { family: 'Anthropic Sans', url: 'smaran-font://f/a.ttf', weight: 700, italic: true },
      ]),
    ).toBe(
      '@font-face{font-family:\'Anthropic Sans\';src:url("smaran-font://f/a.ttf");font-weight:700;font-style:italic;font-display:swap}',
    );
  });
});

describe('font files', () => {
  it('guesses family, weight and style from a file name', () => {
    expect(familyFromFileName('C:/x/AnthropicSerif-BoldItalic.woff2')).toEqual({
      family: 'Anthropic Serif',
      weight: 700,
      italic: true,
    });
    expect(familyFromFileName('Inter_SemiBold.ttf')).toEqual({
      family: 'Inter',
      weight: 600,
      italic: false,
    });
    expect(familyFromFileName('plain.otf')).toEqual({
      family: 'plain',
      weight: 400,
      italic: false,
    });
    expect(familyFromFileName('X-Light.otf').weight).toBe(300);
    expect(familyFromFileName('X-Black.otf').weight).toBe(900);
  });

  it('rejects data that is not a TrueType/OpenType font', () => {
    expect(readFontInfo(Buffer.from('not a font at all'))).toBeNull();
    expect(readFontInfo(Buffer.alloc(0))).toBeNull();
  });

  const segoe = 'C:/Windows/Fonts/segoeuib.ttf';
  it.skipIf(!existsSync(segoe))('reads the real name and weight from a Windows font', () => {
    expect(readFontInfo(readFileSync(segoe))).toMatchObject({
      family: 'Segoe UI',
      weight: 700,
      italic: false,
    });
  });
});
