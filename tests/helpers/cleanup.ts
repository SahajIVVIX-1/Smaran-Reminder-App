import { rmSync, existsSync } from 'node:fs';

/**
 * Safely removes a directory on Windows with exponential backoff retries
 * to handle transient file lock releases by the OS or antivirus.
 */
export async function safeRemoveDir(dirPath: string, maxAttempts = 5): Promise<void> {
  if (!existsSync(dirPath)) return;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.warn(`[cleanup] Could not remove directory ${dirPath}:`, err);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }
}
