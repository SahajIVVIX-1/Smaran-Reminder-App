// Smaran 2.13 → 2.14: automations arrive. Every config starts with none.

type Raw = Record<string, unknown>;

export function v5ToV6(raw: Raw): Raw {
  return {
    ...raw,
    version: 6,
    automations: Array.isArray(raw['automations']) ? raw['automations'] : [],
  };
}
