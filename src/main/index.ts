import { app, dialog } from 'electron';
import { registerIpcHandlers } from './ipc/handlers';
import { SmaranApp } from './SmaranApp';
import { chooseDataFolder } from './system/dataFolder';
import { launchedHidden } from './system/loginItem';
import { showSettingsWindow } from './windows/SettingsWindow';

const APP_ID = 'com.sahaj.smaran';

// Portable build: keep data beside the exe when that folder is writable. Must run before 'ready'.
const data = chooseDataFolder(process.env['PORTABLE_EXECUTABLE_DIR'], app.getPath('userData'));
if (data.dir !== app.getPath('userData')) app.setPath('userData', data.dir);

// Only one Smaran may run. A second launch opens the first one's settings and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let smaran: SmaranApp | null = null;

  app.on('second-instance', () => {
    showSettingsWindow();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    smaran = new SmaranApp(app.getPath('userData'), data.portable);
    const { notice, firstRun } = smaran.start();
    registerIpcHandlers(smaran);

    // At login Smaran starts quietly in the tray; otherwise (and on first run) settings open.
    if (!launchedHidden() || firstRun || notice) {
      const settings = showSettingsWindow();
      if (notice) {
        void dialog.showMessageBox(settings, { type: 'warning', title: 'Smaran', message: notice });
      }
    }
  });

  // Smaran lives in the tray: closing the settings window does not quit.
  app.on('window-all-closed', () => undefined);

  app.on('before-quit', () => {
    smaran?.stop();
  });
}
