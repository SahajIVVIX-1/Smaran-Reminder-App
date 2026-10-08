import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { createDefaultConfig } from '../../src/shared/defaults';
import type { Config, HistoryEntry } from '../../src/shared/schema';

export interface Harness {
  app: ElectronApplication;
  page: Page;
  userData: string;
  readConfig(): Config;
  close(): Promise<void>;
}

/** Onboarded config with sound off and quick-hiding notifications, so tests don't wait long. */
export function seedConfig(change: (c: Config) => void = () => undefined): Config {
  const config = createDefaultConfig();
  config.settings.onboarded = true;
  config.settings.startAtLogin = false;
  config.settings.holdWhenBusy = false;
  config.settings.notification.sound = false;
  config.settings.notification.hideAfterSec = 3;
  change(config);
  return config;
}

/** Launches the built app with its own temporary data folder (never the real %APPDATA%\Smaran). */
export async function launch(
  seed?: Config | null,
  history: HistoryEntry[] = [],
  extraArgs: string[] = [],
): Promise<Harness> {
  const userData = mkdtempSync(join(tmpdir(), 'smaran-e2e-'));
  if (seed) writeFileSync(join(userData, 'config.json'), JSON.stringify(seed, null, 2));
  if (history.length) writeFileSync(join(userData, 'history.json'), JSON.stringify(history));
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`, ...extraArgs] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return {
    app,
    page,
    userData,
    readConfig: () => JSON.parse(readFileSync(join(userData, 'config.json'), 'utf8')) as Config,
    async close() {
      await app.close();
      rmSync(userData, { recursive: true, force: true });
    },
  };
}

/** The next notification window that opens. */
export async function nextNotification(h: Harness): Promise<Page> {
  const win = await h.app.waitForEvent('window');
  await win.waitForLoadState('domcontentloaded');
  return win;
}
