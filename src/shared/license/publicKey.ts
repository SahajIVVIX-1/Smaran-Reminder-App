// The Ed25519 public keys licenses are checked with.
// The matching private key stays on the publisher's PC (never in this repository).

/**
 * Trusted Ed25519 public keys for license verification.
 * Supports controlled key rotation:
 * - ACTIVE_LICENSE_KEY_ID: ID of the primary/active key for new licenses.
 * - TRUSTED_LICENSE_PUBLIC_KEYS: All accepted public keys (active and legacy/migration).
 */
export const ACTIVE_LICENSE_KEY_ID = 'v1';

export const TRUSTED_LICENSE_PUBLIC_KEYS: Record<string, string> = {
  // v1 (legacy key) - kept trusted so existing customer licenses remain valid
  v1: 'ETy6dgHw3Qhi1XK2ihXl6buklNrdfnzWLbjtjzyrNjg',
};

export const LICENSE_PUBLIC_KEY = TRUSTED_LICENSE_PUBLIC_KEYS[ACTIVE_LICENSE_KEY_ID];
