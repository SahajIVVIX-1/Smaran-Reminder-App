import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import type { Config, HistoryEntry } from '../../src/shared/schema';
import { safeRemoveDir } from './cleanup';

export interface AppHarness {
  app: ElectronApplication;
  page: Page;
  userData: string;
  readConfig(): Config;
  readHistory(): HistoryEntry[];
  pageWith(urlPart: string, timeoutMs?: number): Promise<Page>;
  nextNotification(): Promise<Page>;
  close(): Promise<void>;
}

export interface LaunchOptions {
  seed?: Config | null;
  history?: HistoryEntry[];
  fileserverConfig?: Record<string, unknown>;
  extraArgs?: string[];
  extraEnv?: Record<string, string>;
}

/**
 * Launches the real Electron desktop application inside an isolated temporary user-data directory.
 * Ensures ELECTRON_RUN_AS_NODE is stripped so Electron runs with full Chromium/GUI capabilities.
 */
export async function launchApp(options: LaunchOptions = {}): Promise<AppHarness> {
  const { seed, history = [], fileserverConfig, extraArgs = [], extraEnv = {} } = options;

  const userData = mkdtempSync(join(tmpdir(), 'smaran-e2e-'));

  if (seed) {
    writeFileSync(join(userData, 'config.json'), JSON.stringify(seed, null, 2));
  }
  if (history.length) {
    writeFileSync(join(userData, 'history.json'), JSON.stringify(history, null, 2));
  }
  if (fileserverConfig) {
    writeFileSync(join(userData, 'fileserver.json'), JSON.stringify(fileserverConfig, null, 2));
  }

  const env: Record<string, string | undefined> = {
    ...process.env,
    SMARAN_LICENSE_CHECK: 'off',
    ...extraEnv,
  };
  // Ensure Electron runs as desktop GUI application, not Node runtime
  delete env['ELECTRON_RUN_AS_NODE'];

  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`, ...extraArgs],
    env: env as Record<string, string>,
  });

  const page = await findPageWith(app, '/app/');

  const harness: AppHarness = {
    app,
    page,
    userData,
    readConfig() {
      const p = join(userData, 'config.json');
      return JSON.parse(readFileSync(p, 'utf8')) as Config;
    },
    readHistory() {
      const p = join(userData, 'history.json');
      try {
        return JSON.parse(readFileSync(p, 'utf8')) as HistoryEntry[];
      } catch {
        return [];
      }
    },
    async pageWith(urlPart: string, timeoutMs = 20_000) {
      return findPageWith(app, urlPart, timeoutMs);
    },
    async nextNotification() {
      for (;;) {
        const win = await app.waitForEvent('window');
        await win.waitForLoadState('domcontentloaded');
        if (win.url().includes('/notification/')) {
          return win;
        }
      }
    },
    async close() {
      try {
        await app.close();
      } catch (err) {
        console.warn('[app-launcher] Error while closing app:', err);
      }
      await safeRemoveDir(userData);
    },
  };

  return harness;
}

/**
 * Finds an open BrowserWindow whose URL contains the specified substring.
 */
async function findPageWith(
  app: ElectronApplication,
  part: string,
  timeoutMs = 20_000,
): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const win = app.windows().find((w) => w.url().includes(part));
    if (win) {
      await win.waitForLoadState('domcontentloaded');
      return win;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Window with URL containing "${part}" was not found within ${timeoutMs}ms`);
}
