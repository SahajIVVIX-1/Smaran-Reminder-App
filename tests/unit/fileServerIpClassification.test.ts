import { describe, expect, it } from 'vitest';
import { isLanIp, normalizeClientIp } from '../../src/main/fileserver/ipUtils';

describe('fileServerIpClassification - IP Normalization & LAN Classification', () => {
  describe('normalizeClientIp', () => {
    it('normalizes IPv4-mapped IPv6 addresses by stripping ::ffff:', () => {
      expect(normalizeClientIp('::ffff:192.168.1.50')).toBe('192.168.1.50');
      expect(normalizeClientIp('::ffff:10.0.0.1')).toBe('10.0.0.1');
    });

    it('maps loopback variants to standard 127.0.0.1', () => {
      expect(normalizeClientIp('::1')).toBe('127.0.0.1');
      expect(normalizeClientIp('localhost')).toBe('127.0.0.1');
      expect(normalizeClientIp('LOCALHOST')).toBe('127.0.0.1');
      expect(normalizeClientIp('127.0.0.1')).toBe('127.0.0.1');
    });

    it('handles empty or null inputs gracefully by returning 127.0.0.1', () => {
      expect(normalizeClientIp('')).toBe('127.0.0.1');
      expect(normalizeClientIp(null)).toBe('127.0.0.1');
      expect(normalizeClientIp(undefined)).toBe('127.0.0.1');
    });

    it('trims surrounding whitespace', () => {
      expect(normalizeClientIp('  192.168.0.25  ')).toBe('192.168.0.25');
    });
  });

  describe('isLanIp RFC-1918 Private & Local Address Detection', () => {
    it('identifies 10.0.0.0/8 private network range', () => {
      expect(isLanIp('10.0.0.1')).toBe(true);
      expect(isLanIp('10.15.200.4')).toBe(true);
      expect(isLanIp('10.255.255.255')).toBe(true);
    });

    it('identifies 172.16.0.0/12 private range and rejects out-of-range 172.x', () => {
      // 172.16.x through 172.31.x are LAN
      expect(isLanIp('172.16.0.1')).toBe(true);
      expect(isLanIp('172.24.10.5')).toBe(true);
      expect(isLanIp('172.31.255.254')).toBe(true);

      // Outside private range (Public IPs)
      expect(isLanIp('172.15.0.1')).toBe(false);
      expect(isLanIp('172.32.0.1')).toBe(false);
    });

    it('identifies 192.168.0.0/16 private home/office LAN range', () => {
      expect(isLanIp('192.168.0.1')).toBe(true);
      expect(isLanIp('192.168.1.100')).toBe(true);
      expect(isLanIp('192.168.254.254')).toBe(true);
    });

    it('identifies link-local 169.254.0.0/16 and IPv6 link-local ranges', () => {
      expect(isLanIp('169.254.1.1')).toBe(true);
      expect(isLanIp('fe80::1ff:fe23:4567:890a')).toBe(true);
      expect(isLanIp('fc00::1')).toBe(true);
    });

    it('correctly labels public WAN internet addresses as non-LAN (External)', () => {
      expect(isLanIp('8.8.8.8')).toBe(false); // Google DNS
      expect(isLanIp('1.1.1.1')).toBe(false); // Cloudflare DNS
      expect(isLanIp('93.184.216.34')).toBe(false); // example.com
      expect(isLanIp('203.0.113.195')).toBe(false);
    });
  });
});
