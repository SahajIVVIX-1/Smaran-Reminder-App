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
  const page = await appWindow(app);
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

/** The main app window (Smaran also keeps a hidden menu window ready). */
async function appWindow(app: ElectronApplication): Promise<Page> {
  return pageWith(app, '/app/');
}

/** The open window whose page URL contains `part`, once it has loaded. */
export async function pageWith(app: ElectronApplication, part: string): Promise<Page> {
  const until = Date.now() + 20_000;
  for (;;) {
    const win = app.windows().find((w) => w.url().includes(part));
    if (win) {
      await win.waitForLoadState('domcontentloaded');
      return win;
    }
    if (Date.now() > until) throw new Error(`No window with ${part}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** The next notification window that opens. */
export async function nextNotification(h: Harness): Promise<Page> {
  for (;;) {
    const win = await h.app.waitForEvent('window');
    await win.waitForLoadState('domcontentloaded');
    if (win.url().includes('/notification/')) return win;
  }
}
