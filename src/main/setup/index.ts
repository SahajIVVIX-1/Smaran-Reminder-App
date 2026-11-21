import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron';
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
  HKLM_UNINSTALL_KEY,
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
  if (!app.isPackaged) return false;
  if (process.argv.some((arg) => /^[-/]+install$/i.test(arg.trim()))) return true;
  const portableFile = process.env['PORTABLE_EXECUTABLE_FILE'];
  if (portableFile && /setup|install/i.test(basename(portableFile))) return true;
  const exeName = basename(process.execPath);
  return /setup|installer/i.test(exeName);
}

export function isUninstallRun(): boolean {
  return (
    app.isPackaged &&
    process.argv.some((arg) => /^[-/]+uninstall$/i.test(arg.trim()))
  );
}

/** Card plus room for its shadow and the coloured border light. */
const WIDTH = 500;
const HEIGHT = 340;
/** How long "Smaran was removed" stays before the uninstaller window closes. */
const UNINSTALL_DONE_MS = 5000;
/** A moment for the window to appear before anything starts. */
const SETTLE_MS = 700;
/** Windows asks for the window's system menu (right-click on the caption, Alt+Space). */
const WM_POPUPSYSTEMMENU = 0x0313;

function friendly(error: unknown): string {
  const e = error as NodeJS.ErrnoException;
  if (e?.code === 'EBUSY' || e?.code === 'EPERM' || e?.code === 'EACCES')
    return 'Windows didn’t let go of some files in time. Press Try Again.';
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
    useContentSize: true,
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
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  // Guarantee window is displayed even if ready-to-show is delayed
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      win.focus();
    }
  }, 1000);
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
        const current = license.info();
        send({ phase: 'done', progress: 1, licensee: current.license?.name });
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
      void pickAndImport(license, win, () => {
        send({ phase: 'verifying', progress: 0 });
      }).then((result) => {
        choosing = false;
        if (result.ok) {
          send({ phase: 'verifying', progress: 0.1, licensee: result.info.license?.name });
        } else if (!('canceled' in result)) {
          askForLicense(result.error);
        } else {
          send({ phase: 'license', progress: 0 });
        }
      });
    });

    ipcMain.on(IPC.setupStart, (event) => {
      if (event.sender !== win.webContents || running) return;
      const current = license.info();
      if (current.status !== 'valid') {
        askForLicense('Please choose a valid license before installing.');
        return;
      }
      void start();
    });

    ipcMain.on(IPC.setupLaunch, (event) => {
      if (event.sender !== win.webContents) return;
      // Close the setup window immediately so it disappears before the app opens
      try {
        if (!win.isDestroyed()) {
          win.hide();
        }
      } catch {
        // ignore
      }
      launchInstalled(target);
      setTimeout(() => {
        try {
          if (!win.isDestroyed()) win.destroy();
        } catch {
          // ignore
        }
        app.quit();
      }, 350);
    });

    ipcMain.on(IPC.setupRetry, (event) => {
      if (event.sender === win.webContents) void start();
    });
    ipcMain.on(IPC.setupOpenFolder, (event, folderPath: unknown) => {
      if (event.sender === win.webContents) {
        const p = typeof folderPath === 'string' && folderPath ? folderPath : target;
        void shell.openPath(p);
      }
    });
    ipcMain.on(IPC.setupClose, (event) => {
      if (event.sender === win.webContents && !running) {
        try {
          if (!win.isDestroyed()) {
            win.hide();
            win.destroy();
          }
        } catch {
          // ignore
        }
        app.quit();
      }
    });
    // Closing halfway through the copy would leave a broken install.
    win.on('close', (event) => {
      if (running) event.preventDefault();
    });
    win.webContents.once('did-finish-load', () => {
      const current = license.info();
      const isLicenseValid = current.status === 'valid';
      const init: SetupInit = {
        mode: 'install',
        version: app.getVersion(),
        dark: nativeTheme.shouldUseDarkColors,
        target,
        licensee: isLicenseValid ? current.license?.name : undefined,
      };
      win.webContents.send(IPC.setupInit, init);
      setTimeout(() => {
        if (isLicenseValid) {
          send({ phase: 'ready', progress: 0, licensee: current.license?.name });
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
    let quitting = false;
    let uninstalled = false;
    let autoCloseTimer: NodeJS.Timeout | null = null;

    const send = (progress: SetupProgress) => {
      if (!win.isDestroyed()) win.webContents.send(IPC.setupProgress, progress);
    };

    const finishAndQuit = () => {
      if (quitting) return;
      quitting = true;
      running = false;
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
      }
      if (uninstalled) {
        // Pre-clean everything in dir except the running executable
        try {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const full = join(dir, item);
            if (full.toLowerCase() !== process.execPath.toLowerCase()) {
              fs.rmSync(full, { recursive: true, force: true });
            }
          }
        } catch {
          // best-effort pre-clean
        }

        // Silent background self-cleanup without ping or console window
        const cleanDir = dir.replace(/'/g, "''");
        spawn(
          'powershell.exe',
          [
            '-WindowStyle',
            'Hidden',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Start-Sleep -Seconds 2; Remove-Item -LiteralPath '${cleanDir}' -Recurse -Force -ErrorAction SilentlyContinue`,
          ],
          {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          },
        ).unref();
      }
      if (!win.isDestroyed()) win.destroy();
      app.quit();
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
        await deleteKey(HKLM_UNINSTALL_KEY);
        send({ phase: 'removing', progress: 0.85 });
        if (deleteData) deleteUserData(dataDir);
        running = false;
        uninstalled = true;
        send({ phase: 'done', progress: 1 });
      } catch (error) {
        running = false;
        send({ phase: 'error', progress: 0, error: friendly(error) });
        return;
      }
      autoCloseTimer = setTimeout(() => {
        finishAndQuit();
      }, UNINSTALL_DONE_MS);
    };

    ipcMain.on(IPC.setupUninstall, (event, deleteData: unknown) => {
      if (event.sender !== win.webContents || running) return;
      void remove(deleteData === true);
    });
    ipcMain.on(IPC.setupRetry, (event) => {
      if (event.sender === win.webContents && !running) send({ phase: 'confirm', progress: 0 });
    });
    ipcMain.on(IPC.setupClose, (event) => {
      if (event.sender === win.webContents && !running) {
        finishAndQuit();
      }
    });
    win.on('close', (event) => {
      if (running) {
        event.preventDefault();
        return;
      }
      if (uninstalled && !quitting) {
        finishAndQuit();
      }
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
    try {
      fs.rmSync(join(dataDir, name), {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 300,
      });
    } catch {
      // Best effort: a cache file Windows still holds is left behind rather than stopping here.
    }
  }
}
