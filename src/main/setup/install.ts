import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { app } from 'electron';
import type { SetupProgress } from '@shared/setup';
import {
  appEnv,
  closeOtherSmarans,
  deleteKey,
  EXE_NAME,
  existingInstallDir,
  legacyUninstallKeys,
  waitForSmaranRunningFrom,
  writeShortcuts,
  writeUninstallEntry,
} from './winSystem';

/** Asks a running Smaran to quit (handled in index.ts). */
export const QUIT_ARG = '--quit';

/** Default per-user install directory (%LOCALAPPDATA%\Programs\Smaran). */
export function defaultInstallDir(): string {
  const local = process.env['LOCALAPPDATA'] ?? join(app.getPath('home'), 'AppData', 'Local');
  return join(local, 'Programs', 'Smaran');
}

const same = (a: string, b: string) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

/** Only a missing folder, an empty one or an earlier Smaran install may be replaced. */
function replaceable(dir: string): boolean {
  if (!fs.existsSync(dir)) return true;
  return fs.existsSync(join(dir, EXE_NAME)) || fs.readdirSync(dir).length === 0;
}

/** Where to install: over an earlier install when there is one, otherwise the default. */
export async function chooseTarget(): Promise<string> {
  const existing = await existingInstallDir();
  if (existing && fs.existsSync(join(existing, EXE_NAME))) return existing;
  return defaultInstallDir();
}

interface FileEntry {
  from: string;
  to: string;
  size: number;
}

function listFiles(source: string, target: string): FileEntry[] {
  const out: FileEntry[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = join(dir, entry.name);
      if (entry.isDirectory()) walk(from);
      else if (entry.isFile())
        out.push({ from, to: join(target, relative(source, from)), size: fs.statSync(from).size });
    }
  };
  walk(source);
  return out;
}

/**
 * Copies the app this setup carries (the unpacked portable build it is running from) into
 * `target`, then adds shortcuts and the Settings › Apps entry. Progress goes to `report`.
 */
export async function install(target: string, report: (p: SetupProgress) => void): Promise<void> {
  const source = dirname(process.execPath);
  if (same(source, target))
    throw new Error('Smaran Setup is already running from the install folder.');
  if (!replaceable(target))
    throw new Error(`${target} already has other files in it, so Smaran will not overwrite it.`);

  report({ phase: 'preparing', progress: 0.01 });
  // Whatever Smaran is running (an older install, a portable copy) is closed and replaced.
  await closeOtherSmarans(QUIT_ARG);

  // Copy app.asar as a plain file, not as the folder Electron normally pretends it is.
  const noAsar = process.noAsar;
  process.noAsar = true;
  let total = 0;
  try {
    const files = listFiles(source, target);
    total = files.reduce((sum, f) => sum + f.size, 0) || 1;
    report({ phase: 'preparing', progress: 0.04 });
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 6, retryDelay: 400 });
    fs.mkdirSync(target, { recursive: true });

    let copied = 0;
    let lastReport = 0;
    for (const file of files) {
      fs.mkdirSync(dirname(file.to), { recursive: true });
      const read = fs.createReadStream(file.from);
      read.on('data', (chunk: Buffer | string) => {
        copied += chunk.length;
        const now = Date.now();
        if (now - lastReport < 50) return;
        lastReport = now;
        report({ phase: 'copying', progress: 0.04 + 0.86 * (copied / total) });
      });
      await pipeline(read, fs.createWriteStream(file.to));
    }
  } finally {
    process.noAsar = noAsar;
  }

  report({ phase: 'finishing', progress: 0.93 });
  writeShortcuts(target);
  // The old NSIS installer's entry in Settings › Apps would otherwise linger beside ours.
  for (const legacy of await legacyUninstallKeys()) await deleteKey(legacy.key);
  await writeUninstallEntry(target, app.getVersion(), total / 1024);
  report({ phase: 'done', progress: 1 });
}

export function verifyInstalledFiles(target: string): { ok: boolean; error?: string } {
  const exe = join(target, EXE_NAME);
  if (!fs.existsSync(exe)) {
    return { ok: false, error: `Executable missing after install: ${exe}` };
  }
  const resourcesDir = join(target, 'resources');
  if (!fs.existsSync(resourcesDir)) {
    return { ok: false, error: `Resources directory missing after install: ${resourcesDir}` };
  }
  return { ok: true };
}

/**
 * Launches the installed Smaran directly with a clean environment (stripping portable launcher
 * variables) and verifies that the process is alive before reporting success.
 */
export async function launchAndVerifyInstalled(
  target: string,
): Promise<{ ok: boolean; error?: string }> {
  const verify = verifyInstalledFiles(target);
  if (!verify.ok) return verify;

  const exe = join(target, EXE_NAME);
  const cleanEnv = appEnv();

  try {
    const child = spawn(exe, [], {
      cwd: target,
      env: cleanEnv,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (err) {
    return {
      ok: false,
      error: `Could not launch ${exe}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Poll for up to 4.5 seconds to confirm process startup
  const isRunning = await waitForSmaranRunningFrom(target, 4500);
  if (!isRunning) {
    // Fallback: try explorer.exe
    try {
      const child2 = spawn('explorer.exe', [exe], {
        cwd: target,
        env: cleanEnv,
        detached: true,
        stdio: 'ignore',
      });
      child2.unref();
      if (await waitForSmaranRunningFrom(target, 3000)) {
        return { ok: true };
      }
    } catch {
      // Fallback failed
    }

    return {
      ok: false,
      error:
        'Smaran was installed successfully, but did not start automatically. You can launch it from your Desktop or Start Menu.',
    };
  }

  return { ok: true };
}

export function launchInstalled(target: string): void {
  void launchAndVerifyInstalled(target);
}
