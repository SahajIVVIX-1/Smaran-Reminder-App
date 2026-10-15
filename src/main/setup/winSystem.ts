import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { app, shell } from 'electron';

/** Our entry in Settings › Apps (per user, like the old NSIS installer). */
export const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Smaran';
const UNINSTALL_ROOT = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
export const APP_ID = 'com.sahaj.smaran';
export const EXE_NAME = 'Smaran.exe';

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    );
  });
}

const quietly = (p: Promise<unknown>): Promise<void> => p.then(
  () => undefined,
  () => undefined,
);

function powershell(command: string): Promise<string> {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
}

const psString = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** PowerShell pipeline selecting Smaran processes started from `dir`, other than this one. */
const fromDir = (dir: string) =>
  `Get-Process -Name Smaran -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${process.pid} -and $_.Path -and $_.Path.StartsWith(${psString(dir)}, [System.StringComparison]::OrdinalIgnoreCase) }`;

export async function countRunningFrom(dir: string): Promise<number> {
  const out = await powershell(`@(${fromDir(dir)}).Count`).catch(() => '0');
  return Number.parseInt(out.trim(), 10) || 0;
}

/**
 * Closes a Smaran running from `dir`: first politely (so it saves its history), then by force.
 * A copy that predates the --quit switch just opens its window, and is then closed by force.
 */
export async function closeRunningFrom(dir: string, quitArg: string): Promise<void> {
  if ((await countRunningFrom(dir)) === 0) return;
  await quietly(run(join(dir, EXE_NAME), [quitArg]));
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 300));
    if ((await countRunningFrom(dir)) === 0) return;
  }
  await quietly(powershell(`${fromDir(dir)} | Stop-Process -Force`));
  await new Promise((r) => setTimeout(r, 700));
}

// ---------- registry ----------

async function regValue(key: string, name: string): Promise<string | null> {
  try {
    const out = await run('reg.exe', ['query', key, '/v', name]);
    const line = out.split(/\r?\n/).find((l) => l.trim().startsWith(`${name} `));
    const match = line ? /REG_\w+\s+(.*)$/.exec(line.trim()) : null;
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

/** Uninstall entries for Smaran under other names (the old NSIS installer used a GUID). */
export async function legacyUninstallKeys(): Promise<{ key: string; location: string | null }[]> {
  let out = '';
  try {
    out = await run('reg.exe', ['query', UNINSTALL_ROOT, '/s', '/f', 'Smaran', '/d']);
  } catch {
    return [];
  }
  const keys = [
    ...new Set(
      out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('HKEY_') && !/\\Smaran$/i.test(l)),
    ),
  ];
  const found: { key: string; location: string | null }[] = [];
  for (const raw of keys) {
    const key = raw.replace(/^HKEY_CURRENT_USER/, 'HKCU');
    // NSIS named it "Smaran <version>".
    if (!/^Smaran( |$)/.test((await regValue(key, 'DisplayName')) ?? '')) continue;
    found.push({ key, location: await regValue(key, 'InstallLocation') });
  }
  return found;
}

export function deleteKey(key: string): Promise<void> {
  return quietly(run('reg.exe', ['delete', key, '/f']));
}

/** Folder of an earlier install (ours or the old NSIS one), if any. */
export async function existingInstallDir(): Promise<string | null> {
  const ours = await regValue(UNINSTALL_KEY, 'InstallLocation');
  if (ours) return ours;
  for (const legacy of await legacyUninstallKeys()) if (legacy.location) return legacy.location;
  return null;
}

export async function writeUninstallEntry(dir: string, version: string, sizeKb: number) {
  const exe = join(dir, EXE_NAME);
  const values: [string, string, string][] = [
    ['DisplayName', 'REG_SZ', 'Smaran'],
    ['DisplayVersion', 'REG_SZ', version],
    ['Publisher', 'REG_SZ', 'SahajS'],
    ['DisplayIcon', 'REG_SZ', `${exe},0`],
    ['InstallLocation', 'REG_SZ', dir],
    ['UninstallString', 'REG_SZ', `"${exe}" --uninstall`],
    ['NoModify', 'REG_DWORD', '1'],
    ['NoRepair', 'REG_DWORD', '1'],
    ['EstimatedSize', 'REG_DWORD', String(Math.round(sizeKb))],
  ];
  for (const [name, type, data] of values)
    await run('reg.exe', ['add', UNINSTALL_KEY, '/v', name, '/t', type, '/d', data, '/f']);
}

/** The start-at-login entry Smaran writes (value name "Smaran"). */
export function removeLoginItem(): Promise<void> {
  return quietly(run('reg.exe', ['delete', RUN_KEY, '/v', 'Smaran', '/f']));
}

// ---------- shortcuts ----------

export function shortcutPaths(): string[] {
  return [
    join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Smaran.lnk'),
    join(app.getPath('desktop'), 'Smaran.lnk'),
  ];
}

export function writeShortcuts(dir: string): void {
  const exe = join(dir, EXE_NAME);
  for (const lnk of shortcutPaths()) {
    shell.writeShortcutLink(lnk, 'create', {
      target: exe,
      cwd: dir,
      icon: exe,
      iconIndex: 0,
      appUserModelId: APP_ID,
      description: 'Gentle reminders, on your schedule.',
    });
  }
}
