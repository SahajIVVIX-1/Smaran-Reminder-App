import path from 'node:path';
import {
  DEFAULT_REMOTE_HUB_SETTINGS,
  RemoteHubSettingsSchema,
  type RemoteHubSettings,
} from '@shared/remotehub';
import { readValidatedJson, writeAtomicFile } from '../store/atomicFile';

export class RemoteHubConfigStore {
  private settings: RemoteHubSettings;
  private readonly configPath: string;

  constructor(dataDir: string) {
    this.configPath = path.join(dataDir, 'remotehub.json');
    this.settings = this.load();
  }

  private load(): RemoteHubSettings {
    const result = readValidatedJson<RemoteHubSettings>(
      this.configPath,
      RemoteHubSettingsSchema,
      DEFAULT_REMOTE_HUB_SETTINGS,
      {
        onRecovered: (msg) => console.log(`[RemoteHubConfigStore] ${msg}`),
        onCorrupt: (err, p) =>
          console.warn(`[RemoteHubConfigStore] Corrupt config preserved to ${p}:`, err),
      },
    );
    return result.data;
  }

  get(): RemoteHubSettings {
    return { ...this.settings };
  }

  update(patch: Partial<RemoteHubSettings>): RemoteHubSettings {
    const merged = { ...this.settings, ...patch };
    const validated = RemoteHubSettingsSchema.parse(merged);
    this.settings = validated;
    writeAtomicFile(this.configPath, JSON.stringify(validated, null, 2), { backup: true });
    return { ...this.settings };
  }
}
