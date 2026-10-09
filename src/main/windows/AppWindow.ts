import { BrowserWindow } from 'electron';
import { IPC, type Route } from '@shared/ipc';
import { supportsGlass } from '../system/glass';
import { iconPath } from '../tray/Tray';
import { loadRenderer, preloadPath } from './loadRenderer';

/** Title-bar colours matching the app's sidebar, light and dark. */
export const TITLE_BAR = {
  light: { color: '#F0EEE6', symbolColor: '#3D3D3A' },
  dark: { color: '#1F1E1D', symbolColor: '#C2C0B6' },
} as const;
export const TITLE_BAR_HEIGHT = 36;
const CLEAR = '#00000000';

/** True when the window gets Windows 11's acrylic backdrop. */
export const GLASS = supportsGlass();

let appWindow: BrowserWindow | null = null;
let pendingRoute: Route | null = null;

function overlay(dark: boolean) {
  const colors = dark ? TITLE_BAR.dark : TITLE_BAR.light;
  return { ...colors, color: GLASS ? CLEAR : colors.color, height: TITLE_BAR_HEIGHT };
}

function background(dark: boolean): string {
  if (GLASS) return CLEAR;
  return dark ? '#1F1E1D' : '#F0EEE6';
}

function createAppWindow(dark: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1040,
    height: 700,
    minWidth: 820,
    minHeight: 560,
    title: 'Smaran',
    icon: iconPath(),
    show: false,
    backgroundColor: background(dark),
    ...(GLASS ? { backgroundMaterial: 'acrylic' as const } : {}),
    // Frameless look like modern desktop apps; Windows draws the caption buttons over our bar.
    titleBarStyle: 'hidden',
    titleBarOverlay: overlay(dark),
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
  win.setTitleBarOverlay(overlay(dark));
  win.setBackgroundColor(background(dark));
}
