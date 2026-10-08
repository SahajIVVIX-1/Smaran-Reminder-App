import * as fs from 'node:fs';
import { join } from 'node:path';

export const PORTABLE_DATA_DIR = 'SmaranData';

/**
 * Where config.json lives. The portable build keeps its data next to the exe in SmaranData
 * when that folder is writable (checked with a test write); otherwise, and for the installed
 * build, it uses the normal per-user folder (%APPDATA%\Smaran).
 */
export function chooseDataFolder(
  portableExeDir: string | undefined,
  userDataDefault: string,
): {
  dir: string;
  portable: boolean;
} {
  if (portableExeDir) {
    const dir = join(portableExeDir, PORTABLE_DATA_DIR);
    if (isWritable(dir)) return { dir, portable: true };
  }
  return { dir: userDataDefault, portable: false };
}

export function isWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe);
    return true;
  } catch {
    return false;
  }
}
