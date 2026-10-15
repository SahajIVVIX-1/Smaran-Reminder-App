import { BrowserWindow, nativeTheme } from 'electron';
import { iconPath } from '../tray/Tray';
import { loadRenderer, preloadPath } from '../windows/loadRenderer';

/**
 * The license screen: the only thing Smaran shows until a valid license is imported.
 * It can import a license image or quit; nothing else in Smaran runs meanwhile.
 */
export function openLicenseWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 520,
    height: 600,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Smaran: License',
    icon: iconPath(),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#262624' : '#faf9f5',
    webPreferences: {
      preload: preloadPath('license'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.setMenu(null);
  win.once('ready-to-show', () => win.show());
  void loadRenderer(win, 'license');
  return win;
}
