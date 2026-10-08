import { app } from 'electron';

/** Registry value name under HKCU\...\Run. The uninstaller removes the same name. */
export const LOGIN_ITEM_NAME = 'Smaran';
/** Launched at login: start in the tray without opening settings. */
export const HIDDEN_ARG = '--hidden';

/** The exe to start at login. For the portable build that is the portable exe, wherever it now is. */
function exePath(): string {
  return process.env['PORTABLE_EXECUTABLE_FILE'] ?? process.execPath;
}

/** Sets or removes the login item. Skipped in development so electron.exe is never registered. */
export function applyLoginItem(enabled: boolean): void {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: LOGIN_ITEM_NAME,
    path: exePath(),
    args: [HIDDEN_ARG],
  });
}

export function launchedHidden(argv: readonly string[] = process.argv): boolean {
  return argv.includes(HIDDEN_ARG);
}
