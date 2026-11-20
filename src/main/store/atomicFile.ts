import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

function sleepSync(ms: number): void {
  try {
    const sab = new SharedArrayBuffer(4);
    const int32 = new Int32Array(sab);
    Atomics.wait(int32, 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // synchronous spin fallback
    }
  }
}

export interface AtomicWriteOptions {
  backup?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  encoding?: BufferEncoding;
}

/**
 * Atomically writes data to a file using a unique temporary file, fsync,
 * automatic backup, and Windows-safe replacement with exponential backoff.
 */
export function writeAtomicFile(
  filePath: string,
  data: string | Buffer,
  options: AtomicWriteOptions = {},
): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const maxRetries = options.maxRetries ?? 5;
  const retryDelayMs = options.retryDelayMs ?? 20;
  const encoding = options.encoding ?? 'utf8';
  const createBackup = options.backup ?? true;

  const rand = crypto.randomBytes(4).toString('hex');
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${rand}`;

  // 1. Write and fsync temporary file
  let fd: number | null = null;
  try {
    fd = fs.openSync(tmpPath, 'w');
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);
    fs.writeSync(fd, buf, 0, buf.length, 0);
    fs.fsyncSync(fd);
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore close errors
      }
    }
  }

  // 2. Manage backup if target file exists
  const backupPath = `${filePath}.bak`;
  if (createBackup && fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, backupPath);
    } catch (backupErr) {
      console.warn(`[atomicFile] Warning: Failed creating backup for ${filePath}:`, backupErr);
    }
  }

  // 3. Windows-safe atomic replacement with retry and copy fallback
  let renamed = false;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      fs.renameSync(tmpPath, filePath);
      renamed = true;
      break;
    } catch (err: unknown) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES' || code === 'EEXIST') {
        if (attempt < maxRetries) {
          sleepSync(retryDelayMs * (attempt + 1));
          continue;
        }
      } else {
        break;
      }
    }
  }

  if (!renamed) {
    try {
      fs.copyFileSync(tmpPath, filePath);
      renamed = true;
    } catch (copyErr) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
      throw new Error(
        `Failed writing atomic file ${filePath}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)} (copy fallback: ${copyErr instanceof Error ? copyErr.message : String(copyErr)})`,
      );
    }
  }

  // Clean up temporary file
  try {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  } catch {
    // ignore
  }
}

export interface ReadValidatedResult<T> {
  data: T;
  recoveredFromBackup: boolean;
  corruptSaved: boolean;
  error?: string;
}

export interface ReadValidatedOptions {
  backupPath?: string;
  onRecovered?: (msg: string) => void;
  onCorrupt?: (err: unknown, preservedPath: string) => void;
}

/**
 * Reads and validates JSON data against a Zod schema.
 * If the file is malformed or invalid:
 * - Preserves the corrupt file to <filePath>.corrupt.<timestamp> for forensics.
 * - Attempts automatic recovery from the valid .bak file.
 * - Restores recovered data to main file.
 * - Returns fallback if neither is recoverable.
 */
export function readValidatedJson<T>(
  filePath: string,
  schema: z.ZodType<T>,
  fallback: T,
  options: ReadValidatedOptions = {},
): ReadValidatedResult<T> {
  const backupPath = options.backupPath ?? `${filePath}.bak`;

  const tryLoadAndValidate = (
    pathToCheck: string,
  ): { ok: true; data: T } | { ok: false; error: unknown } => {
    try {
      if (!fs.existsSync(pathToCheck)) {
        return { ok: false, error: new Error(`File ${pathToCheck} does not exist`) };
      }
      const rawStr = fs.readFileSync(pathToCheck, 'utf8');
      const parsed = JSON.parse(rawStr);
      const res = schema.safeParse(parsed);
      if (res.success) {
        return { ok: true, data: res.data };
      }
      return { ok: false, error: res.error };
    } catch (err) {
      return { ok: false, error: err };
    }
  };

  // Case 1: Main file does not exist
  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(backupPath)) {
      const backupCheck = tryLoadAndValidate(backupPath);
      if (backupCheck.ok) {
        options.onRecovered?.(`Main file ${filePath} missing, recovered from backup ${backupPath}`);
        return { data: backupCheck.data, recoveredFromBackup: true, corruptSaved: false };
      }
    }
    return { data: fallback, recoveredFromBackup: false, corruptSaved: false };
  }

  // Case 2: Main file exists
  const mainCheck = tryLoadAndValidate(filePath);
  if (mainCheck.ok) {
    return { data: mainCheck.data, recoveredFromBackup: false, corruptSaved: false };
  }

  // File is damaged or schema invalid
  const timestamp = Date.now();
  const corruptPath = `${filePath}.corrupt.${timestamp}`;
  let corruptSaved = false;
  try {
    fs.copyFileSync(filePath, corruptPath);
    corruptSaved = true;
    options.onCorrupt?.(mainCheck.error, corruptPath);
  } catch (copyErr) {
    console.warn(`[atomicFile] Warning: Could not preserve damaged file ${filePath}:`, copyErr);
  }

  // Attempt recovery from backup
  if (fs.existsSync(backupPath)) {
    const backupCheck = tryLoadAndValidate(backupPath);
    if (backupCheck.ok) {
      options.onRecovered?.(`Recovered valid data from ${backupPath} after ${filePath} corruption`);
      try {
        writeAtomicFile(filePath, fs.readFileSync(backupPath), { backup: false });
      } catch (restoreErr) {
        console.warn(`[atomicFile] Warning: Failed restoring backup to ${filePath}:`, restoreErr);
      }
      return {
        data: backupCheck.data,
        recoveredFromBackup: true,
        corruptSaved,
        error: String(mainCheck.error),
      };
    }
  }

  return {
    data: fallback,
    recoveredFromBackup: false,
    corruptSaved,
    error: String(mainCheck.error),
  };
}

/**
 * Removes abandoned temporary files from interrupted writes older than maxAgeMs.
 */
export function cleanupStaleTempFiles(
  dir: string,
  baseName: string,
  maxAgeMs = 5 * 60 * 1000,
): number {
  if (!fs.existsSync(dir)) return 0;
  let cleaned = 0;
  const now = Date.now();
  const prefix = `${baseName}.tmp.`;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.startsWith(prefix)) {
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            cleaned++;
          }
        } catch {
          // ignore individual cleanup error
        }
      }
    }
  } catch {
    // ignore readdir error
  }
  return cleaned;
}
