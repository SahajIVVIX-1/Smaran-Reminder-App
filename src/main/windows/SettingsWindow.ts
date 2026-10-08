import { BrowserWindow } from 'electron';
import { loadRenderer, preloadPath } from './loadRenderer';

let settingsWindow: BrowserWindow | null = null;

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    title: 'Smaran Settings',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath('settings'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    settingsWindow = null;
  });

  void loadRenderer(win, 'settings');
  return win;
}

/** Opens the settings window, or brings the existing one to the front. */
export function showSettingsWindow(): BrowserWindow {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    settingsWindow = createSettingsWindow();
    return settingsWindow;
  }
  if (settingsWindow.isMinimized()) settingsWindow.restore();
  settingsWindow.show();
  settingsWindow.focus();
  return settingsWindow;
}
