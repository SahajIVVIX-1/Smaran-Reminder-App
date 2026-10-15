import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, nativeImage, nativeTheme } from 'electron';
import { IPC } from '@shared/ipc';
import type { SetupInit, SetupProgress } from '@shared/setup';
import { decodeWithNativeImage, pickAndImport } from '../license/ipc';
import { LicenseStore } from '../license/LicenseStore';
import { iconPath } from '../tray/Tray';
import { loadRenderer, preloadPath } from '../windows/loadRenderer';
import { chooseTarget, install, launchInstalled, QUIT_ARG } from './install';
import {
  APP_ID,
  closeOtherSmarans,
  deleteKey,
  EXE_NAME,
  removeLoginItem,
  shortcutPaths,
  UNINSTALL_KEY,
} from './winSystem';

export { QUIT_ARG };
export const UNINSTALL_ARG = '--uninstall';

/**
 * The setup exe is the portable build under a "Setup" name: when it runs, it installs the app
 * it carries instead of starting Smaran. See scripts/make-setup.mjs.
 */
export function isSetupRun(): boolean {
  const file = process.env['PORTABLE_EXECUTABLE_FILE'];
  return app.isPackaged && !!file && /setup/i.test(basename(file));
}

export function isUninstallRun(): boolean {
  return app.isPackaged && process.argv.includes(UNINSTALL_ARG);
}

/** Card plus room for its shadow and the coloured border light. */
const WIDTH = 460;
const HEIGHT = 300;
/** How long "Smaran is ready" stays before the installed app opens. */
const DONE_MS = 2400;

function friendly(error: unknown): string {
  const e = error as NodeJS.ErrnoException;
  if (e?.code === 'EBUSY' || e?.code === 'EPERM' || e?.code === 'EACCES')
    return 'Some Smaran files are in use. Quit Smaran from the tray, then try again.';
  return e?.message || String(error);
}

/** Shows the setup window and installs straight away. */
export function runSetup(): void {
  // Where the installed Smaran keeps its data (and its license): %APPDATA%\Smaran.
  const dataDir = app.getPath('userData');
  // Keep the setup's own browser data out of the real Smaran folder.
  app.setPath('userData', join(app.getPath('temp'), 'smaran-setup'));
  app.on('window-all-closed', () => app.quit());

  void app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID);
    const target = await chooseTarget();
    const win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      title: 'Smaran Setup',
      icon: iconPath(),
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      show: false,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath('setup'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    win.setAlwaysOnTop(true, 'floating');

    let running = false;
    const send = (progress: SetupProgress) => {
      if (!win.isDestroyed()) win.webContents.send(IPC.setupProgress, progress);
    };
    const start = async () => {
      if (running) return;
      running = true;
      try {
        await install(target, send);
        running = false;
        setTimeout(() => {
          launchInstalled(target);
          app.quit();
        }, DONE_MS);
      } catch (error) {
        running = false;
        send({ phase: 'error', progress: 0, error: friendly(error) });
      }
    };

    // Smaran installs only with a valid license: one already on this PC, or an image chosen here.
    const license = new LicenseStore(dataDir, { decodeOther: decodeWithNativeImage });
    const askForLicense = (error?: string) =>
      send({ phase: 'license', progress: 0, ...(error ? { error } : {}) });
    let choosing = false;
    ipcMain.on(IPC.setupLicense, (event) => {
      if (event.sender !== win.webContents || running || choosing) return;
      choosing = true;
      void pickAndImport(license, win).then((result) => {
        choosing = false;
        if (result.ok) {
          send({ phase: 'preparing', progress: 0, licensee: result.info.license?.name });
          void start();
        } else if (!('canceled' in result)) askForLicense(result.error);
      });
    });

    ipcMain.on(IPC.setupRetry, (event) => {
      if (event.sender === win.webContents) void start();
    });
    ipcMain.on(IPC.setupClose, (event) => {
      if (event.sender === win.webContents && !running) app.quit();
    });
    // Closing halfway through the copy would leave a broken install.
    win.on('close', (event) => {
      if (running) event.preventDefault();
    });
    win.once('ready-to-show', () => win.show());
    win.webContents.once('did-finish-load', () => {
      const init: SetupInit = {
        version: app.getVersion(),
        dark: nativeTheme.shouldUseDarkColors,
        target,
      };
      win.webContents.send(IPC.setupInit, init);
      const current = license.info();
      if (current.status !== 'valid') {
        askForLicense(current.status === 'missing' ? undefined : (current.message ?? undefined));
        return;
      }
      // A moment for the window to appear before the work starts.
      setTimeout(() => void start(), 700);
    });
    void loadRenderer(win, 'setup');
  });
}

/** Settings › Apps › Uninstall runs `Smaran.exe --uninstall` from the install folder. */
export function runUninstall(): void {
  const dataDir = app.getPath('userData'); // %APPDATA%\Smaran
  app.setPath('userData', join(app.getPath('temp'), 'smaran-uninstall'));

  void app.whenReady().then(async () => {
    const dir = dirname(process.execPath);
    if (!fs.existsSync(join(dir, EXE_NAME)) || !fs.existsSync(join(dir, 'resources'))) {
      app.quit();
      return;
    }
    const icon = nativeImage.createFromPath(iconPath());
    const confirm = await dialog.showMessageBox({
      type: 'question',
      icon,
      title: 'Uninstall Smaran',
      message: 'Uninstall Smaran?',
      detail: 'Smaran will be removed from this PC.',
      buttons: ['Uninstall', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });
    if (confirm.response !== 0) {
      app.quit();
      return;
    }

    await closeOtherSmarans(QUIT_ARG);
    await removeLoginItem();
    for (const lnk of shortcutPaths()) fs.rmSync(lnk, { force: true });
    await deleteKey(UNINSTALL_KEY);

    const data = await dialog.showMessageBox({
      type: 'question',
      icon,
      title: 'Uninstall Smaran',
      message: 'Also delete your Smaran messages and settings?',
      detail: 'Choose Keep to keep them for a later reinstall.',
      buttons: ['Keep', 'Delete'],
      defaultId: 0,
      cancelId: 0,
    });
    if (data.response === 1) fs.rmSync(dataDir, { recursive: true, force: true });

    // The running exe can't delete its own folder: a hidden shell does it once we have exited.
    spawn('cmd.exe', ['/d', '/s', '/c', `"ping -n 4 127.0.0.1 >nul & rmdir /s /q "${dir}""`], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      windowsVerbatimArguments: true,
    }).unref();
    app.quit();
  });
}
