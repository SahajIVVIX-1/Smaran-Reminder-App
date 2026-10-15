import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { IPC } from '@shared/ipc';
import type { SetupInit, SetupProgress } from '@shared/setup';
import { decodeWithNativeImage, pickAndImport } from '../license/ipc';
import { LICENSE_FILE, LicenseStore } from '../license/LicenseStore';
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
const HEIGHT = 320;
/** How long "Smaran is ready" (or "removed") stays before the window goes. */
const DONE_MS = 2400;
/** A moment for the window to appear before anything starts. */
const SETTLE_MS = 700;
/** Windows asks for the window's system menu (right-click on the caption, Alt+Space). */
const WM_POPUPSYSTEMMENU = 0x0313;

function friendly(error: unknown): string {
  const e = error as NodeJS.ErrnoException;
  if (e?.code === 'EBUSY' || e?.code === 'EPERM' || e?.code === 'EACCES')
    return 'Some Smaran files are in use. Quit Smaran from the tray, then try again.';
  return e?.message || String(error);
}

/**
 * The floating Smaran card used by Setup and the uninstaller. It stays where it opens: it can't
 * be dragged, and right-clicking it shows no menu (the page blocks its context menu too).
 */
function cardWindow(title: string): BrowserWindow {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    title,
    icon: iconPath(),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
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
  if (process.platform === 'win32') {
    // Swallow the system menu: toggling enabled cancels the popup Windows is about to show.
    win.hookWindowMessage(WM_POPUPSYSTEMMENU, () => {
      win.setEnabled(false);
      win.setEnabled(true);
    });
  }
  win.once('ready-to-show', () => win.show());
  return win;
}

/** Shows the setup window; installs once a valid license is on this PC or chosen here. */
export function runSetup(): void {
  // Where the installed Smaran keeps its data (and its license): %APPDATA%\Smaran.
  const dataDir = app.getPath('userData');
  // Keep the setup's own browser data out of the real Smaran folder.
  app.setPath('userData', join(app.getPath('temp'), 'smaran-setup'));
  app.on('window-all-closed', () => app.quit());

  void app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID);
    const target = await chooseTarget();
    const win = cardWindow('Smaran Setup');

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
    win.webContents.once('did-finish-load', () => {
      const init: SetupInit = {
        mode: 'install',
        version: app.getVersion(),
        dark: nativeTheme.shouldUseDarkColors,
        target,
      };
      win.webContents.send(IPC.setupInit, init);
      setTimeout(() => {
        const current = license.info();
        if (current.status === 'valid') {
          send({ phase: 'preparing', progress: 0, licensee: current.license?.name });
          void start();
        } else {
          askForLicense(current.status === 'missing' ? undefined : (current.message ?? undefined));
        }
      }, SETTLE_MS);
    });
    void loadRenderer(win, 'setup');
  });
}

/**
 * Settings › Apps › Uninstall runs `Smaran.exe --uninstall` from the install folder: the same
 * floating card as Setup asks first, then removes Smaran.
 */
export function runUninstall(): void {
  const dataDir = app.getPath('userData'); // %APPDATA%\Smaran
  app.setPath('userData', join(app.getPath('temp'), 'smaran-uninstall'));
  app.on('window-all-closed', () => app.quit());

  void app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    const dir = dirname(process.execPath);
    if (!fs.existsSync(join(dir, EXE_NAME)) || !fs.existsSync(join(dir, 'resources'))) {
      app.quit();
      return;
    }
    const win = cardWindow('Uninstall Smaran');
    let running = false;
    const send = (progress: SetupProgress) => {
      if (!win.isDestroyed()) win.webContents.send(IPC.setupProgress, progress);
    };

    const remove = async (deleteData: boolean) => {
      running = true;
      send({ phase: 'removing', progress: 0.1 });
      try {
        await closeOtherSmarans(QUIT_ARG);
        send({ phase: 'removing', progress: 0.4 });
        await removeLoginItem();
        send({ phase: 'removing', progress: 0.55 });
        for (const lnk of shortcutPaths()) fs.rmSync(lnk, { force: true });
        send({ phase: 'removing', progress: 0.7 });
        await deleteKey(UNINSTALL_KEY);
        send({ phase: 'removing', progress: 0.85 });
        if (deleteData) deleteUserData(dataDir);
        send({ phase: 'done', progress: 1 });
      } catch (error) {
        running = false;
        send({ phase: 'error', progress: 0, error: friendly(error) });
        return;
      }
      setTimeout(() => {
        // The running exe can't delete its own folder: a hidden shell does it once we have exited.
        spawn('cmd.exe', ['/d', '/s', '/c', `"ping -n 4 127.0.0.1 >nul & rmdir /s /q "${dir}""`], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          windowsVerbatimArguments: true,
        }).unref();
        app.quit();
      }, DONE_MS);
    };

    ipcMain.on(IPC.setupUninstall, (event, deleteData: unknown) => {
      if (event.sender !== win.webContents || running) return;
      void remove(deleteData === true);
    });
    ipcMain.on(IPC.setupRetry, (event) => {
      if (event.sender === win.webContents && !running) send({ phase: 'confirm', progress: 0 });
    });
    ipcMain.on(IPC.setupClose, (event) => {
      if (event.sender === win.webContents && !running) app.quit();
    });
    win.on('close', (event) => {
      if (running) event.preventDefault();
    });
    win.webContents.once('did-finish-load', () => {
      const init: SetupInit = {
        mode: 'uninstall',
        version: app.getVersion(),
        dark: nativeTheme.shouldUseDarkColors,
        target: dir,
      };
      win.webContents.send(IPC.setupInit, init);
      send({ phase: 'confirm', progress: 0 });
    });
    void loadRenderer(win, 'setup');
  });
}

/**
 * Deletes reminders, settings, history and backups, but keeps the license, so reinstalling
 * later doesn't ask for it again.
 */
function deleteUserData(dataDir: string): void {
  if (!fs.existsSync(dataDir)) return;
  for (const name of fs.readdirSync(dataDir)) {
    if (name === LICENSE_FILE) continue;
    fs.rmSync(join(dataDir, name), { recursive: true, force: true });
  }
}
