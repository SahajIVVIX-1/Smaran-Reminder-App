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
  writeShortcuts,
  writeUninstallEntry,
} from './winSystem';

/** Asks a running Smaran to quit (handled in index.ts). */
export const QUIT_ARG = '--quit';

/** Same place the old NSIS installer used, so updates land on top of it. */
export function defaultInstallDir(): string {
  const local = process.env['LOCALAPPDATA'] ?? join(app.getPath('home'), 'AppData', 'Local');
  return join(local, 'Programs', 'smaran');
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
 * Opens the installed Smaran as the signed-in user. Windows often runs a file named "Setup" as
 * administrator; started directly, Smaran would inherit that and then couldn't be closed by a
 * normal uninstall or update. Explorer starts it with the user's normal rights instead.
 */
export function launchInstalled(target: string): void {
  const exe = join(target, EXE_NAME);
  const child = spawn('explorer.exe', [exe], { detached: true, stdio: 'ignore' });
  child.once('error', () =>
    spawn(exe, [], { cwd: target, env: appEnv(), detached: true, stdio: 'ignore' }).unref(),
  );
  child.unref();
}
