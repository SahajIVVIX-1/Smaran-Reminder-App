import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { createDefaultConfig } from '../../src/shared/defaults';
import type { Config } from '../../src/shared/schema';

export interface Harness {
  app: ElectronApplication;
  settings: Page;
  userData: string;
  readConfig(): Config;
  close(): Promise<void>;
}

/** A config with onboarding done and quick popups, so tests don't wait long. */
export function seedConfig(change: (c: Config) => void = () => undefined): Config {
  const config = createDefaultConfig();
  config.app.onboarded = true;
  config.app.startAtLogin = false;
  config.app.respectFocusAssist = false;
  for (const style of config.styles) style.timing = { fadeInMs: 100, stayMs: 1500, fadeOutMs: 100 };
  change(config);
  return config;
}

/** Launches the built app with its own temporary data folder (never the real %APPDATA%\Smaran). */
export async function launch(seed?: Config | null): Promise<Harness> {
  const userData = mkdtempSync(join(tmpdir(), 'smaran-e2e-'));
  if (seed) writeFileSync(join(userData, 'config.json'), JSON.stringify(seed, null, 2));
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`] });
  const settings = await app.firstWindow();
  await settings.waitForLoadState('domcontentloaded');
  return {
    app,
    settings,
    userData,
    readConfig: () => JSON.parse(readFileSync(join(userData, 'config.json'), 'utf8')) as Config,
    async close() {
      await app.close();
      rmSync(userData, { recursive: true, force: true });
    },
  };
}

/** Waits for a popup window (any window that is not the settings window). */
export async function waitForPopup(h: Harness): Promise<Page> {
  const existing = h.app.windows().find((w) => w !== h.settings);
  return existing ?? (await h.app.waitForEvent('window'));
}
