import { BrowserWindow, dialog } from 'electron';
import { IPC } from '@shared/ipc';
import type { Id } from '@shared/schema';
import { loadRenderer, preloadPath } from './loadRenderer';

let settingsWindow: BrowserWindow | null = null;
let dirty = false;
let pendingFocus: Id | null = null;

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    title: 'Smaran Settings',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1b1b1d',
    webPreferences: {
      preload: preloadPath('settings'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-finish-load', () => {
    if (pendingFocus) win.webContents.send(IPC.settingsFocusMessage, pendingFocus);
    pendingFocus = null;
  });

  // Unsaved changes: ask before the window closes.
  win.on('close', (event) => {
    if (!dirty) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      title: 'Unsaved changes',
      message: 'You have changes that are not saved.',
      detail: 'Close the window and lose them, or go back and press Save?',
      buttons: ['Keep editing', 'Discard changes'],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice === 0) event.preventDefault();
    else dirty = false;
  });

  win.on('closed', () => {
    settingsWindow = null;
    dirty = false;
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

/** Opens settings on the Messages page with one message selected. */
export function showMessageInSettings(messageId: Id): void {
  const existing =
    settingsWindow && !settingsWindow.isDestroyed() && !settingsWindow.webContents.isLoading();
  if (!existing) pendingFocus = messageId;
  const win = showSettingsWindow();
  if (existing) win.webContents.send(IPC.settingsFocusMessage, messageId);
}

export function setSettingsDirty(value: boolean): void {
  dirty = value;
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
}
