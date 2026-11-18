import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { app, shell } from 'electron';

/** Our entry in Settings › Apps (per user, like the old NSIS installer). */
export const UNINSTALL_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Smaran';
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

const quietly = (p: Promise<unknown>): Promise<void> =>
  p.then(
    () => undefined,
    () => undefined,
  );

function powershell(command: string): Promise<string> {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
}

/**
 * The environment for Smaran processes this one starts. Without the portable launcher's
 * variables, so a Smaran started from Setup runs as the app, not as Setup again.
 */
export function appEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith('PORTABLE_EXECUTABLE_')) Reflect.deleteProperty(env, key);
  return env;
}

/** PowerShell selecting every other Smaran process (not this one or its own helper processes). */
const others = () =>
  `Get-CimInstance Win32_Process -Filter "Name='${EXE_NAME}'" | Where-Object { $_.ProcessId -ne ${process.pid} -and $_.ParentProcessId -ne ${process.pid} }`;

export async function countOtherSmarans(): Promise<number> {
  const out = await powershell(`@(${others()}).Count`).catch(() => '0');
  return Number.parseInt(out.trim(), 10) || 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits up to `ms` for every other Smaran to be gone; true if they are. */
async function goneWithin(ms: number): Promise<boolean> {
  for (let waited = 0; waited <= ms; waited += 300) {
    if ((await countOtherSmarans()) === 0) return true;
    await sleep(300);
  }
  return false;
}

/**
 * Closes any running Smaran (installed or portable, wherever it is), so its files can be
 * replaced or removed: first politely, so it saves its history; then by force; and if it runs
 * as administrator (so a normal force-close is refused), with Windows' permission prompt.
 * Returns true once none are left.
 */
export async function closeOtherSmarans(quitArg: string): Promise<boolean> {
  if ((await countOtherSmarans()) === 0) return true;
  // A second Smaran started with --quit tells the running one to quit, then exits itself.
  await new Promise<void>((resolve) =>
    execFile(process.execPath, [quitArg], { env: appEnv(), windowsHide: true }, () => resolve()),
  );
  if (await goneWithin(4000)) return true;

  await quietly(
    powershell(
      `${others()} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ),
  );
  if (await goneWithin(1500)) return true;

  // Still there: it was started as administrator. Ask Windows to end just those processes.
  await quietly(
    powershell(
      `$ids = @(${others()} | ForEach-Object { '/PID'; $_.ProcessId }); ` +
        `if ($ids.Count) { Start-Process -FilePath taskkill.exe -ArgumentList (@('/F','/T') + $ids) -Verb RunAs -WindowStyle Hidden -Wait }`,
    ),
  );
  return goneWithin(4000);
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
