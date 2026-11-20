/**
 * Normalizes an IP address:
 * - strips IPv4-mapped IPv6 prefix (::ffff:x.x.x.x -> x.x.x.x)
 * - maps ::1 or localhost to 127.0.0.1
 * - trims whitespace
 * Never trusts arbitrary forwarded headers without explicit proxy configuration.
 */
export function normalizeClientIp(rawIp?: string | null): string {
  if (!rawIp) return '127.0.0.1';
  let ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (ip === '::1' || ip.toLowerCase() === 'localhost') {
    return '127.0.0.1';
  }
  return ip;
}

/**
 * Checks whether an IP belongs to private/local/LAN network ranges.
 */
export function isLanIp(ip: string): boolean {
  const norm = normalizeClientIp(ip);
  if (norm === '127.0.0.1' || norm === 'localhost' || norm === '::1') return true;
  if (/^10\./.test(norm)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(norm)) return true;
  if (/^192\.168\./.test(norm)) return true;
  if (/^169\.254\./.test(norm)) return true; // link-local
  if (/^(fc00|fe80):/i.test(norm)) return true; // unique local / link-local ipv6
  return false;
}
