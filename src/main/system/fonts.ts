import * as fs from 'node:fs';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { getFonts } from 'font-list';
import type { CustomFont, FontCatalog } from '@shared/fonts';
import { familyFromFileName, readFontInfo, type FontInfo } from './fontFile';

export const FONT_SCHEME = 'smaran-font';
const FONT_TYPES = new Set(['.ttf', '.otf', '.woff', '.woff2']);

/** Must run before the app is ready. */
export function registerFontScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FONT_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ]);
}

/** Fonts the user added live in <data>/fonts and are served to the pages as smaran-font://f/<file>. */
export class FontLibrary {
  private system: Promise<string[]> | null = null;

  constructor(private readonly dir: string) {}

  /** Serves added font files to the app and notification pages. Call once the app is ready. */
  serve(): void {
    protocol.handle(FONT_SCHEME, (request) => {
      const name = basename(decodeURIComponent(new URL(request.url).pathname));
      const file = join(this.dir, name);
      if (!FONT_TYPES.has(extname(name).toLowerCase()) || !fs.existsSync(file)) {
        return new Response('Not found', { status: 404 });
      }
      return net.fetch(pathToFileURL(file).toString());
    });
  }

  async catalog(): Promise<FontCatalog> {
    this.system ??= getFonts({ disableQuoting: true })
      .then((fonts) =>
        [...new Set(fonts.map((f) => f.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
      )
      .catch(() => []);
    return { system: await this.system, custom: this.customFonts() };
  }

  /** Copies font files into the library. Returns the families added. */
  add(paths: readonly string[]): { added: string[]; skipped: string[] } {
    fs.mkdirSync(this.dir, { recursive: true });
    const added = new Set<string>();
    const skipped: string[] = [];
    for (const path of paths) {
      const ext = extname(path).toLowerCase();
      if (!FONT_TYPES.has(ext)) {
        skipped.push(basename(path));
        continue;
      }
      const info = this.info(fs.readFileSync(path), path);
      fs.copyFileSync(path, join(this.dir, basename(path)));
      added.add(info.family);
    }
    return { added: [...added], skipped };
  }

  customFonts(): CustomFont[] {
    if (!fs.existsSync(this.dir)) return [];
    return fs
      .readdirSync(this.dir)
      .filter((f) => FONT_TYPES.has(extname(f).toLowerCase()))
      .sort()
      .map((file) => {
        const info = this.info(fs.readFileSync(join(this.dir, file)), file);
        return { ...info, url: `${FONT_SCHEME}://f/${encodeURIComponent(file)}` };
      });
  }

  private info(data: Buffer, path: string): FontInfo {
    return readFontInfo(data) ?? familyFromFileName(path);
  }
}
