import { BrowserWindow } from 'electron';
import { IPC, type Route } from '@shared/ipc';
import { loadRenderer, preloadPath } from './loadRenderer';

/** Title-bar colours matching the app's sidebar, light and dark. */
export const TITLE_BAR = {
  light: { color: '#F0EEE6', symbolColor: '#3D3D3A' },
  dark: { color: '#1F1E1D', symbolColor: '#C2C0B6' },
} as const;
export const TITLE_BAR_HEIGHT = 40;

let appWindow: BrowserWindow | null = null;
let pendingRoute: Route | null = null;

function createAppWindow(dark: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    title: 'Smaran',
    show: false,
    backgroundColor: dark ? '#262624' : '#FAF9F5',
    // Frameless look like modern desktop apps; Windows draws the caption buttons over our bar.
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...(dark ? TITLE_BAR.dark : TITLE_BAR.light), height: TITLE_BAR_HEIGHT },
    webPreferences: {
      preload: preloadPath('app'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-finish-load', () => {
    if (pendingRoute) win.webContents.send(IPC.navigate, pendingRoute);
    pendingRoute = null;
  });
  win.on('closed', () => {
    appWindow = null;
  });

  void loadRenderer(win, 'app');
  return win;
}

/** Opens the app window, or brings it to the front; optionally on a page. */
export function showAppWindow(dark: boolean, route?: Route): BrowserWindow {
  if (!appWindow || appWindow.isDestroyed()) {
    pendingRoute = route ?? null;
    appWindow = createAppWindow(dark);
    return appWindow;
  }
  if (appWindow.isMinimized()) appWindow.restore();
  appWindow.show();
  appWindow.focus();
  if (route) appWindow.webContents.send(IPC.navigate, route);
  return appWindow;
}

export function getAppWindow(): BrowserWindow | null {
  return appWindow && !appWindow.isDestroyed() ? appWindow : null;
}

/** Keeps the caption buttons in step with the app's theme. */
export function setTitleBarTheme(dark: boolean): void {
  const win = getAppWindow();
  if (!win) return;
  win.setTitleBarOverlay({
    ...(dark ? TITLE_BAR.dark : TITLE_BAR.light),
    height: TITLE_BAR_HEIGHT,
  });
  win.setBackgroundColor(dark ? '#262624' : '#FAF9F5');
}
