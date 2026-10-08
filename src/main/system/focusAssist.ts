import { execFile } from 'node:child_process';

/**
 * Windows "user notification state" (SHQueryUserNotificationState). It reports full-screen apps,
 * games, presentation mode, quiet time and the lock screen. Focus Assist's "priority only" mode is
 * not exposed by Windows to apps, so it is only caught when Windows reports quiet time.
 */
export enum NotificationState {
  NotPresent = 1, // screen saver, locked, fast user switching
  Busy = 2, // full-screen app
  D3DFullScreen = 3, // full-screen game
  PresentationMode = 4,
  AcceptsNotifications = 5,
  QuietTime = 6,
  App = 7, // full-screen Store app
}

const SUPPRESSING = new Set<number>([
  NotificationState.NotPresent,
  NotificationState.Busy,
  NotificationState.D3DFullScreen,
  NotificationState.PresentationMode,
  NotificationState.QuietTime,
  NotificationState.App,
]);

export function isSuppressingState(state: number | null): boolean {
  return state !== null && SUPPRESSING.has(state);
}

const SCRIPT = [
  'Add-Type -Namespace Smaran -Name Shell -MemberDefinition \'[DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);\'',
  '$s = 0',
  '[void][Smaran.Shell]::SHQueryUserNotificationState([ref]$s)',
  '$s',
].join('; ');

const CACHE_MS = 15_000;
let cache: { at: number; state: number | null } | null = null;

/** Current state, or null if it cannot be read (non-Windows, PowerShell blocked). Cached briefly. */
export function queryNotificationState(): Promise<number | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.state);

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
      { timeout: 8000, windowsHide: true },
      (error, stdout) => {
        const value = Number.parseInt(String(stdout).trim(), 10);
        const state = error || Number.isNaN(value) ? null : value;
        cache = { at: Date.now(), state };
        resolve(state);
      },
    );
  });
}

/** True when Windows says now is a bad time for a popup (full-screen app, presentation, quiet time). */
export async function windowsIsBusy(): Promise<boolean> {
  return isSuppressingState(await queryNotificationState());
}
