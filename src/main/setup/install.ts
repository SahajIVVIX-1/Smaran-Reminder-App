import { execFileSync, spawn } from 'node:child_process';
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
  sleep,
  waitForSmaranReadyFrom,
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

/**
 * Validates that an HFS engine archive exists, is not empty or corrupted,
 * and contains the required runtime entry points.
 */
export function verifyEngineArchive(archivePath: string): { ok: boolean; error?: string } {
  if (!fs.existsSync(archivePath)) {
    return { ok: false, error: `HFS engine archive not found at ${archivePath}` };
  }
  const stat = fs.statSync(archivePath);
  if (stat.size < 1_000_000) {
    return { ok: false, error: `HFS engine archive is incomplete (${stat.size} bytes)` };
  }
  try {
    const list = execFileSync('tar.exe', ['-ztf', archivePath], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    const required = ['src/index.js', 'package.json', 'central.json'];
    for (const req of required) {
      if (!list.includes(req)) {
        return { ok: false, error: `HFS engine archive is missing entry point: ${req}` };
      }
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `HFS engine archive verification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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

  // Verify HFS engine archive exists and is integral in installed resources
  const engineArchive = join(resourcesDir, 'engine.tar.gz');
  const engineCheck = verifyEngineArchive(engineArchive);
  if (!engineCheck.ok) {
    return {
      ok: false,
      error: `Installation validation failed: ${engineCheck.error}`,
    };
  }

  return { ok: true };
}

/**
 * Launches the installed Smaran directly with a clean environment (stripping portable launcher
 * variables) and verifies that the process and its actual GUI window are ready before reporting success.
 * Handles asynchronous spawn errors and timeout failures.
 */
export async function launchAndVerifyInstalled(
  target: string,
): Promise<{ ok: boolean; error?: string }> {
  const verify = verifyInstalledFiles(target);
  if (!verify.ok) return verify;

  const exe = join(target, EXE_NAME);
  const cleanEnv = appEnv();

  let asyncSpawnError: Error | null = null;
  let childProcess;

  try {
    childProcess = spawn(exe, [], {
      cwd: target,
      env: cleanEnv,
      detached: true,
      stdio: 'ignore',
    });
    childProcess.once('error', (err) => {
      asyncSpawnError = err;
    });
    childProcess.unref();
  } catch (err) {
    return {
      ok: false,
      error: `Could not launch ${exe}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Yield to event loop to catch immediate asynchronous spawn errors
  await sleep(200);
  if (asyncSpawnError) {
    return {
      ok: false,
      error: `Asynchronous launch failure for ${exe}: ${(asyncSpawnError as Error).message}`,
    };
  }

  // Poll for actual process and window readiness (MainWindowHandle != 0)
  const readyResult = await waitForSmaranReadyFrom(target, 7000);
  if (!readyResult.ok) {
    // Fallback: try explorer.exe with clean environment
    try {
      const child2 = spawn('explorer.exe', [exe], {
        cwd: target,
        env: cleanEnv,
        detached: true,
        stdio: 'ignore',
      });
      child2.unref();
      const fallbackResult = await waitForSmaranReadyFrom(target, 4000);
      if (fallbackResult.ok) {
        return { ok: true };
      }
    } catch {
      // Fallback failed
    }

    return {
      ok: false,
      error:
        readyResult.error ||
        'Smaran was installed successfully, but its window did not appear in time. You can launch it from your Desktop or Start Menu.',
    };
  }

  return { ok: true };
}

export function launchInstalled(target: string): void {
  void launchAndVerifyInstalled(target);
}
