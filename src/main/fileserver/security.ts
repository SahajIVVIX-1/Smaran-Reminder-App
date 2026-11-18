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

/**
 * Checks if an IP matches a mask (supports exact IP, wildcards like 192.168.1.*, or CIDR /24)
 */
export function ipMatchesPattern(ip: string, pattern: string): boolean {
  const cleanIp = ip.replace(/^::ffff:/, '').trim();
  const cleanPattern = pattern.trim();

  if (cleanPattern === '*' || cleanPattern === cleanIp) return true;

  // Wildcard match, e.g. 192.168.1.*
  if (cleanPattern.includes('*')) {
    const regexStr = '^' + cleanPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
    return new RegExp(regexStr).test(cleanIp);
  }

  // CIDR match, e.g. 192.168.1.0/24
  if (cleanPattern.includes('/')) {
    try {
      const parts = cleanPattern.split('/');
      const subnet = parts[0];
      const bitsStr = parts[1];
      if (!subnet || !bitsStr) return false;

      const bits = parseInt(bitsStr, 10);
      if (isNaN(bits) || bits < 0 || bits > 32) return false;

      const ipParts = cleanIp.split('.').map(Number);
      const subnetParts = subnet.split('.').map(Number);
      if (ipParts.length !== 4 || subnetParts.length !== 4) return false;

      const ip0 = ipParts[0] ?? 0;
      const ip1 = ipParts[1] ?? 0;
      const ip2 = ipParts[2] ?? 0;
      const ip3 = ipParts[3] ?? 0;

      const sub0 = subnetParts[0] ?? 0;
      const sub1 = subnetParts[1] ?? 0;
      const sub2 = subnetParts[2] ?? 0;
      const sub3 = subnetParts[3] ?? 0;

      const ipNum = ((ip0 << 24) | (ip1 << 16) | (ip2 << 8) | ip3) >>> 0;
      const subnetNum = ((sub0 << 24) | (sub1 << 16) | (sub2 << 8) | sub3) >>> 0;

      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (ipNum & mask) === (subnetNum & mask);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Checks whether an incoming client IP is allowed based on blocklist and allowlist
 */
export function isIpAllowed(
  clientIp: string,
  enabled: boolean,
  allowlist: string[],
  blocklist: string[],
): boolean {
  if (!enabled) return true;
  const cleanIp = clientIp.replace(/^::ffff:/, '').trim();

  // 1. If blocklist matches, deny
  for (const pattern of blocklist) {
    if (ipMatchesPattern(cleanIp, pattern)) {
      return false;
    }
  }

  // 2. If allowlist is configured, must match at least one
  if (allowlist.length > 0) {
    for (const pattern of allowlist) {
      if (ipMatchesPattern(cleanIp, pattern)) {
        return true;
      }
    }
    return false; // Not in allowlist
  }

  return true;
}

/**
 * Anti-brute force limiter: tracks failed logins per IP and locks out after threshold
 */
export class BruteForceLimiter {
  private failedAttempts = new Map<string, { count: number; lockedUntil: number }>();
  private readonly maxFailures = 5;
  private readonly lockoutMs = 15 * 60 * 1000; // 15 minutes

  isLocked(clientIp: string): boolean {
    const cleanIp = clientIp.replace(/^::ffff:/, '').trim();
    const entry = this.failedAttempts.get(cleanIp);
    if (!entry) return false;

    if (entry.lockedUntil > 0) {
      if (Date.now() > entry.lockedUntil) {
        this.failedAttempts.delete(cleanIp);
        return false;
      }
      return true;
    }
    return entry.count >= this.maxFailures;
  }

  recordFailure(clientIp: string): void {
    const cleanIp = clientIp.replace(/^::ffff:/, '').trim();
    const entry = this.failedAttempts.get(cleanIp) || { count: 0, lockedUntil: 0 };
    entry.count++;
    if (entry.count >= this.maxFailures) {
      entry.lockedUntil = Date.now() + this.lockoutMs;
    }
    this.failedAttempts.set(cleanIp, entry);
  }

  recordSuccess(clientIp: string): void {
    const cleanIp = clientIp.replace(/^::ffff:/, '').trim();
    this.failedAttempts.delete(cleanIp);
  }
}

