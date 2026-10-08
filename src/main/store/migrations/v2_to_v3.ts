// Smaran 2.1 → 2.2: reminders gain a per-reminder sound setting (filled by normalize), and the
// defaults changed to a dark app and mobile-style notifications from the top centre. Settings
// still at the old defaults move to the new ones; anything the user changed is kept.

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

export function v2ToV3(raw: Raw): Raw {
  const settings = isObject(raw['settings']) ? { ...raw['settings'] } : undefined;
  if (settings) {
    if (settings['theme'] === 'system') settings['theme'] = 'dark';
    if (isObject(settings['notification'])) {
      const n = { ...settings['notification'] };
      if (n['corner'] === 'bottom-right') n['corner'] = 'top-center';
      if (n['hideAfterSec'] === 12) n['hideAfterSec'] = 8;
      settings['notification'] = n;
    }
  }
  return { ...raw, version: 3, ...(settings ? { settings } : {}) };
}
