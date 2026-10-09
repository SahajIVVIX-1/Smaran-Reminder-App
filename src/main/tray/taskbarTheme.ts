import { execFile } from 'node:child_process';

/**
 * Windows lets the taskbar ("Choose your default Windows mode") differ from apps' light/dark mode,
 * so the tray icon follows this value, not nativeTheme.
 */
const KEY = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`;

/** Reads `reg query … /v SystemUsesLightTheme` output: true for a light taskbar, null if absent. */
export function parseSystemUsesLightTheme(output: string): boolean | null {
  const match = /SystemUsesLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(output);
  return match?.[1] === undefined ? null : parseInt(match[1], 16) !== 0;
}

/** Whether the Windows taskbar is light; null when it can't be read (or not on Windows). */
export function taskbarIsLight(): Promise<boolean | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', KEY, '/v', 'SystemUsesLightTheme'],
      { windowsHide: true, timeout: 3000 },
      (error, stdout) => resolve(error ? null : parseSystemUsesLightTheme(stdout)),
    );
  });
}
