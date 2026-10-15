import { join } from 'node:path';
import { app, type BrowserWindow } from 'electron';

export type RendererEntry = 'app' | 'notification' | 'menu' | 'trayart' | 'setup';

/** Loads a renderer entry from the Vite dev server in development, or from out/renderer when built. */
export function loadRenderer(win: BrowserWindow, entry: RendererEntry): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) {
    return win.loadURL(`${devUrl}/${entry}/index.html`);
  }
  return win.loadFile(join(__dirname, `../renderer/${entry}/index.html`));
}

export function preloadPath(entry: RendererEntry): string {
  return join(__dirname, `../preload/${entry}.js`);
}
