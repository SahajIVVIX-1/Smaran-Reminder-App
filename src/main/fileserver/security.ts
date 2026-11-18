import * as crypto from 'node:crypto';
import * as path from 'node:path';

/**
 * Validates that `relativePath` stays strictly inside `baseDir`, preventing `../` traversal.
 * Returns the normalized absolute path if safe, or `null` if unsafe.
 */
export function resolveSafePath(baseDir: string, relativePath: string): string | null {
  const normalizedBase = path.resolve(baseDir);
  // Decode URI components in case %2e%2e is used
  let cleanRel = relativePath;
  try {
    cleanRel = decodeURIComponent(relativePath);
  } catch {
    // Keep raw if decoding fails
  }

  // Strip leading slashes/backslashes so path.resolve joins relative to baseDir
  cleanRel = cleanRel.replace(/^[/\\]+/, '');

  const resolved = path.resolve(normalizedBase, cleanRel);

  // Must equal baseDir or start with baseDir + path separator
  if (resolved === normalizedBase || resolved.startsWith(normalizedBase + path.sep)) {
    return resolved;
  }
  return null;
}

/** Hashes password using scrypt with random 16-byte salt */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/** Verifies password against stored salt:key hash using timingSafeEqual */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, keyHex] = parts;
    if (!salt || !keyHex) return false;

    const key = Buffer.from(keyHex, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, key.length);
    return crypto.timingSafeEqual(key, derivedKey);
  } catch {
    return false;
  }
}

/** Generates a cryptographically secure random token string */
export function generateToken(length = 24): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}
