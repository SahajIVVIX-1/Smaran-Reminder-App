import { app, BrowserWindow, dialog } from 'electron';
import { registerIpcHandlers } from './ipc/handlers';
import { decodeWithNativeImage, registerLicenseIpc } from './license/ipc';
import { LicenseStore } from './license/LicenseStore';
import { openLicenseWindow } from './license/LicenseWindow';
import { isSetupRun, isUninstallRun, QUIT_ARG, runSetup, runUninstall } from './setup';
import { SmaranApp } from './SmaranApp';
import { recordMilestone } from './system/diagnostics';
import { chooseDataFolder } from './system/dataFolder';
import { registerFontScheme } from './system/fonts';
import { launchedHidden } from './system/loginItem';

const APP_ID = 'com.sahaj.smaran';
/** How often a running Smaran re-checks its license (it may expire while open). */
const LICENSE_RECHECK_MS = 60 * 60_000;

// Check uninstaller first so an explicit --uninstall argument is always respected.
if (isUninstallRun()) runUninstall();
else if (isSetupRun()) runSetup();
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
  let gate: BrowserWindow | null = null;
  let license: LicenseStore | null = null;
  let checking = true;

  const focusGate = () => {
    if (!gate || gate.isDestroyed()) return false;
    if (gate.isMinimized()) gate.restore();
    gate.focus();
    return true;
  };

  app.on('second-instance', (_event, argv) => {
    if (argv.includes(QUIT_ARG)) app.quit();
    else if (!focusGate()) smaran?.openApp();
  });

  app.whenReady().then(() => {
    recordMilestone('app_when_ready');
    app.setAppUserModelId(APP_ID);
    license = new LicenseStore(app.getPath('userData'), {
      decodeOther: decodeWithNativeImage,
    });
    // Only an unpackaged development build may skip the license (the e2e tests do).
    checking = app.isPackaged || process.env['SMARAN_LICENSE_CHECK'] !== 'off';
    recordMilestone('license_checked');

    /** The license screen: nothing else of Smaran runs while it shows. */
    const showGate = () => {
      if (focusGate()) return;
      gate = openLicenseWindow();
      gate.on('closed', () => {
        gate = null;
        if (!smaran) app.quit();
      });
    };

    registerLicenseIpc(license, (info) => {
      if (info.status !== 'valid') return;
      if (!smaran) {
        // Activated from the license screen: open Smaran a moment after the check mark.
        setTimeout(() => {
          const closing = gate;
          startSmaran(true);
          closing?.close();
        }, 1400);
      }
    });

    if (checking && !license.valid) {
      showGate();
      return;
    }
    startSmaran(false);

    // A license can run out while Smaran is open: check now and then, and lock if it has.
    if (checking) {
      setInterval(() => {
        if (license?.valid || !smaran) return;
        smaran.stop();
        for (const win of BrowserWindow.getAllWindows()) win.destroy();
        smaran = null;
        // IPC handlers stay registered, so the next activation restarts Smaran cleanly.
        relaunchAfterActivation = true;
        showGate();
      }, LICENSE_RECHECK_MS);
    }
  });

  let relaunchAfterActivation = false;

  function startSmaran(activated: boolean): void {
    if (relaunchAfterActivation) {
      const exe = process.env['PORTABLE_EXECUTABLE_FILE'];
      app.relaunch(exe ? { execPath: exe } : undefined);
      app.exit(0);
      return;
    }
    smaran = new SmaranApp(
      app.getPath('userData'),
      data.portable,
      () => !checking || (license?.valid ?? false),
    );
    registerIpcHandlers(smaran);
    const { notice, firstRun } = smaran.start();
    recordMilestone('smaran_started');
    if (activated) {
      smaran.openApp(firstRun ? 'today' : undefined);
      return;
    }

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
  }

  // Smaran lives in the tray: closing the window does not quit.
  app.on('window-all-closed', () => undefined);

  app.on('before-quit', () => {
    smaran?.stop();
  });
}
