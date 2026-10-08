import { app, BrowserWindow } from 'electron';
import { showSettingsWindow } from './windows/SettingsWindow';

const APP_ID = 'com.sahaj.smaran';

// Only one Smaran may run. A second launch hands over to the first and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showSettingsWindow();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    showSettingsWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) showSettingsWindow();
    });
  });

  // Until the tray exists (Phase 4), closing the settings window ends the app.
  app.on('window-all-closed', () => {
    app.quit();
  });
}
