import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ServerResponse } from 'node:http';
import yazl from 'yazl';

export interface ZipStreamOptions {
  archiveName?: string;
  onProgress?: (bytes: number) => void;
  filterFile?: (filePath: string) => boolean;
}

/**
 * Streams a directory or file list as a ZIP directly to an HTTP ServerResponse.
 * Uses `yazl` for zero intermediate disk files and maximum streaming performance.
 */
export async function streamFolderAsZip(
  targetDir: string,
  res: ServerResponse,
  options: ZipStreamOptions = {},
): Promise<void> {
  const archiveName = options.archiveName || `${path.basename(targetDir) || 'archive'}.zip`;
  const safeName = archiveName.replace(/[/\\?%*:|"<>]/g, '_');

  const zip = new yazl.ZipFile();

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(safeName)}"`,
  );
  res.setHeader('Cache-Control', 'no-cache');

  // Track progress as chunks flow
  zip.outputStream.on('data', (chunk: Buffer) => {
    options.onProgress?.(chunk.length);
  });

  zip.outputStream.pipe(res);

  // Recursively add directory entries
  function addDirectoryRecursively(currentPhysical: string, archivePrefix: string): void {
    if (!fs.existsSync(currentPhysical)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPhysical, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.length === 0 && archivePrefix) {
      zip.addEmptyDirectory(archivePrefix);
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'descript.ion') {
        continue;
      }

      const fullPath = path.join(currentPhysical, entry.name);
      const entryArchiveName = archivePrefix ? `${archivePrefix}/${entry.name}` : entry.name;

      if (options.filterFile && !options.filterFile(fullPath)) {
        continue;
      }

      try {
        if (entry.isDirectory()) {
          addDirectoryRecursively(fullPath, entryArchiveName);
        } else if (entry.isFile()) {
          zip.addFile(fullPath, entryArchiveName);
        }
      } catch {
        // Skip inaccessible files
      }
    }
  }

  const stat = fs.statSync(targetDir);
  if (stat.isDirectory()) {
    addDirectoryRecursively(targetDir, '');
  } else if (stat.isFile()) {
    zip.addFile(targetDir, path.basename(targetDir));
  }

  zip.end();

  return new Promise((resolve, reject) => {
    zip.outputStream.on('end', () => resolve());
    zip.outputStream.on('error', (err) => reject(err));
    res.on('error', (err) => reject(err));
  });
}

/**
 * Streams a specific list of files/directories into a single ZIP archive.
 */
export async function streamSelectionAsZip(
  items: { physicalPath: string; archivePath: string }[],
  res: ServerResponse,
  archiveName: string,
  options: ZipStreamOptions = {},
): Promise<void> {
  const safeName = (archiveName.endsWith('.zip') ? archiveName : `${archiveName}.zip`).replace(
    /[/\\?%*:|"<>]/g,
    '_',
  );

  const zip = new yazl.ZipFile();

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(safeName)}"`,
  );
  res.setHeader('Cache-Control', 'no-cache');

  zip.outputStream.on('data', (chunk: Buffer) => {
    options.onProgress?.(chunk.length);
  });

  zip.outputStream.pipe(res);

  for (const item of items) {
    if (!fs.existsSync(item.physicalPath)) continue;
    try {
      const stat = fs.statSync(item.physicalPath);
      if (stat.isFile()) {
        zip.addFile(item.physicalPath, item.archivePath);
      } else if (stat.isDirectory()) {
        // Recursive walk
        const walk = (dir: string, prefix: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          if (entries.length === 0) {
            zip.addEmptyDirectory(prefix);
            return;
          }
          for (const ent of entries) {
            if (ent.name.startsWith('.')) continue;
            const full = path.join(dir, ent.name);
            const arch = `${prefix}/${ent.name}`;
            if (ent.isDirectory()) {
              walk(full, arch);
            } else if (ent.isFile()) {
              zip.addFile(full, arch);
            }
          }
        };
        walk(item.physicalPath, item.archivePath);
      }
    } catch {
      // Ignore errors for individual files
    }
  }

  zip.end();

  return new Promise((resolve, reject) => {
    zip.outputStream.on('end', () => resolve());
    zip.outputStream.on('error', (err) => reject(err));
    res.on('error', (err) => reject(err));
  });
}
