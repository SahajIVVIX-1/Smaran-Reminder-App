import { app, dialog } from 'electron';
import { registerIpcHandlers } from './ipc/handlers';
import { isSetupRun, isUninstallRun, QUIT_ARG, runSetup, runUninstall } from './setup';
import { SmaranApp } from './SmaranApp';
import { chooseDataFolder } from './system/dataFolder';
import { registerFontScheme } from './system/fonts';
import { launchedHidden } from './system/loginItem';

const APP_ID = 'com.sahaj.smaran';

// The same exe also installs (as Smaran-Setup-<version>.exe) and uninstalls (--uninstall).
if (isSetupRun()) runSetup();
else if (isUninstallRun()) runUninstall();
else runApp();

function runApp(): void {
  // Portable build: keep data beside the exe when that folder is writable. Must run before 'ready'.
  const data = chooseDataFolder(process.env['PORTABLE_EXECUTABLE_DIR'], app.getPath('userData'));
  if (data.dir !== app.getPath('userData')) app.setPath('userData', data.dir);

  registerFontScheme();

  // Only one Smaran may run. A second launch opens the first one's window and exits.
  // Setup and uninstall launch it with --quit to close the running one before replacing it.
  if (!app.requestSingleInstanceLock() || process.argv.includes(QUIT_ARG)) {
    app.quit();
    return;
  }
  let smaran: SmaranApp | null = null;

  app.on('second-instance', (_event, argv) => {
    if (argv.includes(QUIT_ARG)) app.quit();
    else smaran?.openApp();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    smaran = new SmaranApp(app.getPath('userData'), data.portable);
    registerIpcHandlers(smaran);
    const { notice, firstRun } = smaran.start();

    // At login Smaran starts quietly in the tray; otherwise (and on first run) the window opens.
    if (!launchedHidden() || firstRun || notice) {
      smaran.openApp(firstRun ? 'today' : undefined);
      if (notice) {
        const converted = notice.startsWith('Your settings were converted');
        void dialog.showMessageBox({
          type: converted ? 'info' : 'warning',
          title: 'Smaran',
          message: converted ? 'Smaran has been updated' : 'Smaran started with default settings',
          detail: notice,
        });
      }
    }
  });

  // Smaran lives in the tray: closing the window does not quit.
  app.on('window-all-closed', () => undefined);

  app.on('before-quit', () => {
    smaran?.stop();
  });
}
