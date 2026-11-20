import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readValidatedJson, writeAtomicFile } from '../store/atomicFile';
import { z } from 'zod';

const WEBDAV_REGISTRY_BACKUP_FILE = 'webdav-registry-backup.json';
const REG_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\WebClient\\Parameters';

const WebDavRegistryBackupSchema = z.object({
  previousBasicAuthLevel: z.number().int().min(0).max(2).nullable(),
  previousFileSizeLimit: z.number().int().positive().nullable(),
  modifiedAt: z.string(),
  reason: z.string(),
});

export type WebDavRegistryBackup = z.infer<typeof WebDavRegistryBackupSchema>;

function execFilePromise(file: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Queries current WebClient registry values using reg.exe without shell interpolation.
 */
export async function queryCurrentWebClientRegistry(): Promise<{
  basicAuthLevel: number | null;
  fileSizeLimit: number | null;
}> {
  let basicAuthLevel: number | null = null;
  let fileSizeLimit: number | null = null;

  try {
    const { stdout } = await execFilePromise('reg.exe', ['query', REG_KEY, '/v', 'BasicAuthLevel']);
    const match = /BasicAuthLevel\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(stdout);
    if (match && match[1]) {
      basicAuthLevel = Number.parseInt(match[1], 16);
    }
  } catch {
    // Value might not exist
  }

  try {
    const { stdout } = await execFilePromise('reg.exe', ['query', REG_KEY, '/v', 'FileSizeLimitInBytes']);
    const match = /FileSizeLimitInBytes\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(stdout);
    if (match && match[1]) {
      fileSizeLimit = Number.parseInt(match[1], 16);
    }
  } catch {
    // Value might not exist
  }

  return { basicAuthLevel, fileSizeLimit };
}

/**
 * Preserves the previous registry values to disk before modifying them.
 */
export async function backupWebClientRegistry(dataDir: string): Promise<WebDavRegistryBackup> {
  const current = await queryCurrentWebClientRegistry();
  const backup: WebDavRegistryBackup = {
    previousBasicAuthLevel: current.basicAuthLevel,
    previousFileSizeLimit: current.fileSizeLimit,
    modifiedAt: new Date().toISOString(),
    reason: 'Configured by Smaran HFS for local HTTP WebDAV mounting',
  };

  const backupPath = path.join(dataDir, WEBDAV_REGISTRY_BACKUP_FILE);
  writeAtomicFile(backupPath, JSON.stringify(backup, null, 2), { backup: false });
  return backup;
}

/**
 * Restores previous registry settings from the backup file.
 */
export async function restoreWebClientRegistry(
  dataDir: string,
): Promise<{ ok: boolean; restored: Partial<WebDavRegistryBackup>; error?: string }> {
  const backupPath = path.join(dataDir, WEBDAV_REGISTRY_BACKUP_FILE);
  const res = readValidatedJson<WebDavRegistryBackup | null>(
    backupPath,
    WebDavRegistryBackupSchema,
    null,
  );
  const backup = res.data;

  if (!backup) {
    return { ok: false, restored: {}, error: 'No previous WebDAV registry backup found.' };
  }

  try {
    // If previousBasicAuthLevel existed, restore it; otherwise delete the override
    if (backup.previousBasicAuthLevel !== null) {
      await runElevatedReg([
        'add',
        REG_KEY,
        '/v',
        'BasicAuthLevel',
        '/t',
        'REG_DWORD',
        '/d',
        String(backup.previousBasicAuthLevel),
        '/f',
      ]);
    } else {
      await runElevatedReg(['delete', REG_KEY, '/v', 'BasicAuthLevel', '/f']).catch(() => undefined);
    }

    if (backup.previousFileSizeLimit !== null) {
      await runElevatedReg([
        'add',
        REG_KEY,
        '/v',
        'FileSizeLimitInBytes',
        '/t',
        'REG_DWORD',
        '/d',
        String(backup.previousFileSizeLimit),
        '/f',
      ]);
    }

    // Restart WebClient service
    await restartWebClientService();

    // Clean up backup file after successful restoration
    try {
      fs.unlinkSync(backupPath);
    } catch {
      // ignore
    }

    return { ok: true, restored: backup };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, restored: {}, error: msg };
  }
}

/**
 * Runs reg.exe elevated via PowerShell Start-Process with strict argument array.
 */
export async function runElevatedReg(regArgs: string[]): Promise<void> {
  // PowerShell argument list quoted safely
  const quotedArgs = regArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(', ');
  const psCommand = `Start-Process -FilePath 'reg.exe' -ArgumentList @(${quotedArgs}) -Verb RunAs -Wait -WindowStyle Hidden`;

  await execFilePromise('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    psCommand,
  ]);
}

/**
 * Restarts the Windows WebClient service cleanly using powershell Start-Process.
 */
export async function restartWebClientService(): Promise<void> {
  const psScript = `
    sc.exe config WebClient start= auto
    net.exe stop WebClient /y
    net.exe start WebClient
  `;
  await execFilePromise('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    psScript,
  ]).catch(() => undefined);
}
