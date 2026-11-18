import * as mime from 'mime-types';
import * as path from 'node:path';

const FALLBACKS: Record<string, string> = {
  '.ts': 'video/mp2t',
  '.mkv': 'video/x-matroska',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.flac': 'audio/flac',
  '.opus': 'audio/opus',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
};

export function lookupMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const found = mime.lookup(filePath);
  if (found) return found;
  return FALLBACKS[ext] ?? 'application/octet-stream';
}
