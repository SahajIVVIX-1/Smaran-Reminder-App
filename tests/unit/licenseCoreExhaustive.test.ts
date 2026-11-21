import { describe, expect, it } from 'vitest';
import {
  addYears,
  buildPayload,
  cleanName,
  FORMAT_VERSION,
  isIp,
  LicenseError,
  MAX_NAME,
  MAX_YEARS,
  parsePayload,
  PRODUCT_ID,
} from '../../src/shared/license/core';

describe('licenseCore - Cryptographic Offline License Mechanics', () => {
  describe('isIp IP Address Validator', () => {
    it('validates standard IPv4 addresses', () => {
      expect(isIp('127.0.0.1')).toBe(true);
      expect(isIp('192.168.1.1')).toBe(true);
      expect(isIp('8.8.8.8')).toBe(true);
      expect(isIp('255.255.255.255')).toBe(true);
      expect(isIp('10.0.0.1')).toBe(true);
    });

    it('rejects invalid or out-of-range IPv4 addresses', () => {
      expect(isIp('256.0.0.1')).toBe(false);
      expect(isIp('192.168.1.300')).toBe(false);
      expect(isIp('1.2.3.4.5')).toBe(false);
      expect(isIp('192.168.1')).toBe(false);
      expect(isIp('not.an.ip.address')).toBe(false);
      expect(isIp('')).toBe(false);
      expect(isIp(null)).toBe(false);
      expect(isIp(undefined)).toBe(false);
    });

    it('validates standard IPv6 addresses', () => {
      expect(isIp('::1')).toBe(true);
      expect(isIp('2001:db8::1')).toBe(true);
      expect(isIp('fe80::1ff:fe23:4567:890a')).toBe(true);
    });

    it('rejects malformed or non-hex IP representations', () => {
      expect(isIp('xyz:invalid:token')).toBe(false);
      expect(isIp('this:is:not:valid:hex:values')).toBe(false);
      expect(isIp('a'.repeat(50))).toBe(false); // exceeds 45 char max
    });
  });

  describe('addYears with Leap Year Mechanics', () => {
    it('adds normal years accurately', () => {
      const base = new Date('2026-06-15T12:00:00Z');
      const next = addYears(base, 1);
      expect(next.toISOString()).toBe('2027-06-15T12:00:00.000Z');

      const threeYears = addYears(base, 3);
      expect(threeYears.toISOString()).toBe('2029-06-15T12:00:00.000Z');
    });

    it('safely clamps Feb 29 to Feb 28 when advancing into a non-leap year', () => {
      const leapDay = new Date('2024-02-29T12:00:00Z');
      const nonLeap = addYears(leapDay, 1); // 2025 is not a leap year
      expect(nonLeap.getUTCFullYear()).toBe(2025);
      expect(nonLeap.getUTCMonth()).toBe(1); // February
      expect(nonLeap.getUTCDate()).toBe(28);
    });

    it('preserves Feb 29 when advancing into another leap year', () => {
      const leapDay = new Date('2024-02-29T12:00:00Z');
      const nextLeap = addYears(leapDay, 4); // 2028 is a leap year
      expect(nextLeap.getUTCFullYear()).toBe(2028);
      expect(nextLeap.getUTCMonth()).toBe(1); // February
      expect(nextLeap.getUTCDate()).toBe(29);
    });
  });

  describe('cleanName', () => {
    it('collapses multiple whitespace characters and trims boundaries', () => {
      expect(cleanName('   Alice   Bob   ')).toBe('Alice Bob');
      expect(cleanName('Charlie\t\nDelta')).toBe('Charlie Delta');
    });
  });

  describe('buildPayload Construction & Validation', () => {
    const validParams = {
      name: 'Sahaj Tech Labs',
      years: 2,
      id: 'uuid-lic-001',
      now: new Date('2026-11-21T00:00:00Z'),
      issuer: 'license-sign',
      ip: '203.0.113.195',
    };

    it('builds a compliant license payload with exact expiration', () => {
      const payload = buildPayload(validParams);
      expect(payload.v).toBe(FORMAT_VERSION);
      expect(payload.product).toBe(PRODUCT_ID);
      expect(payload.name).toBe('Sahaj Tech Labs');
      expect(payload.years).toBe(2);
      expect(payload.issued).toBe('2026-11-21T00:00:00.000Z');
      expect(payload.expires).toBe('2028-11-21T00:00:00.000Z');
      expect(payload.ip).toBe('203.0.113.195');
    });

    it('rejects invalid or missing IP addresses', () => {
      expect(() => buildPayload({ ...validParams, ip: 'invalid-ip' })).toThrow(LicenseError);
      expect(() => buildPayload({ ...validParams, ip: '' })).toThrow(LicenseError);
    });

    it('rejects empty or whitespace-only name', () => {
      expect(() => buildPayload({ ...validParams, name: '   ' })).toThrow(LicenseError);
    });

    it('rejects name exceeding MAX_NAME (120 chars)', () => {
      const longName = 'A'.repeat(MAX_NAME + 1);
      expect(() => buildPayload({ ...validParams, name: longName })).toThrow(LicenseError);
    });

    it('rejects invalid duration in years (< 1, > MAX_YEARS, or non-integer)', () => {
      expect(() => buildPayload({ ...validParams, years: 0 })).toThrow(LicenseError);
      expect(() => buildPayload({ ...validParams, years: MAX_YEARS + 1 })).toThrow(LicenseError);
      expect(() => buildPayload({ ...validParams, years: 2.5 })).toThrow(LicenseError);
    });
  });

  describe('parsePayload Shape Validation', () => {
    const good = {
      v: FORMAT_VERSION,
      product: PRODUCT_ID,
      id: 'lic-valid-id',
      name: 'Valid Customer',
      years: 1,
      issued: '2026-01-01T00:00:00.000Z',
      expires: '2027-01-01T00:00:00.000Z',
      issuer: 'Smaran Register',
      ip: '127.0.0.1',
    };

    it('parses valid payload successfully', () => {
      const parsed = parsePayload(good);
      expect(parsed.id).toBe('lic-valid-id');
      expect(parsed.name).toBe('Valid Customer');
    });

    it('throws LicenseError if payload is not an object or null', () => {
      expect(() => parsePayload(null)).toThrow(LicenseError);
      expect(() => parsePayload('string payload')).toThrow(LicenseError);
    });

    it('throws LicenseError if format version does not match', () => {
      expect(() => parsePayload({ ...good, v: 99 })).toThrow(LicenseError);
    });

    it('throws LicenseError if dates are missing or invalid ISO', () => {
      expect(() => parsePayload({ ...good, issued: 'not-a-date' })).toThrow(LicenseError);
      expect(() => parsePayload({ ...good, expires: 'not-a-date' })).toThrow(LicenseError);
    });
  });
});
