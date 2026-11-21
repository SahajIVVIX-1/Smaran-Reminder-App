import crypto from 'node:crypto';
import os from 'node:os';
import { safeStorage } from 'electron';

const DPAPI_PREFIX = 'enc:dpapi:';
const AES_GCM_PREFIX = 'enc:v1:';

function getFallbackMasterKey(contextKey = 'smaran-fileserver'): Buffer {
  const machineId = `${os.hostname()}-${os.platform()}-${os.userInfo().username}-${contextKey}`;
  const salt = Buffer.from('smaran-storage-salt-v1', 'utf8');
  return crypto.pbkdf2Sync(machineId, salt, 100_000, 32, 'sha256');
}

/**
 * Encrypts sensitive secrets using Electron safeStorage (Windows DPAPI).
 * In headless/test environments where safeStorage is unavailable, uses
 * AES-256-GCM with a user-and-machine-derived key.
 */
export function encryptSecret(plainText: string, contextKey = 'smaran-fileserver'): string {
  if (!plainText) return '';

  try {
    if (typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable?.()) {
      const encrypted = safeStorage.encryptString(plainText);
      return `${DPAPI_PREFIX}${encrypted.toString('base64')}`;
    }
  } catch {
    // Fall back to authenticated AES-256-GCM
  }

  // Fallback: AES-256-GCM with machine-bound key
  const key = getFallbackMasterKey(contextKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plainText, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${AES_GCM_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Decrypts sensitive secrets. Transparently handles DPAPI, fallback AES-GCM,
 * and unencrypted legacy plaintext (for seamless backward-compatible migration).
 */
export function decryptSecret(cipherText: string, contextKey = 'smaran-fileserver'): string {
  if (!cipherText || typeof cipherText !== 'string') return '';

  if (cipherText.startsWith(DPAPI_PREFIX)) {
    try {
      if (typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable?.()) {
        const buf = Buffer.from(cipherText.slice(DPAPI_PREFIX.length), 'base64');
        return safeStorage.decryptString(buf);
      }
    } catch (err) {
      console.warn('[secureStorage] Failed to decrypt with DPAPI safeStorage:', err);
      return '';
    }
  }

  if (cipherText.startsWith(AES_GCM_PREFIX)) {
    try {
      const parts = cipherText.slice(AES_GCM_PREFIX.length).split(':');
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const iv = Buffer.from(parts[0], 'base64');
        const tag = Buffer.from(parts[1], 'base64');
        const ct = Buffer.from(parts[2], 'base64');
        const key = getFallbackMasterKey(contextKey);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
        return plain.toString('utf8');
      }
    } catch (err) {
      console.warn('[secureStorage] Failed to decrypt fallback cipherText:', err);
      return '';
    }
  }

  // Legacy plaintext backwards compatibility
  return cipherText;
}

export function isSecretEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith(DPAPI_PREFIX) || value.startsWith(AES_GCM_PREFIX);
}
