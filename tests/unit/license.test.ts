import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addYears,
  buildPayload,
  capacity,
  checkPayload,
  containerFromImage,
  crc32,
  decodeContainer,
  decodePng,
  embedBits,
  encodeContainer,
  encodePng,
  extractBits,
  fromBase64,
  isIp,
  isJpeg,
  isPng,
  jpegLicense,
  jpegWithLicense,
  LicenseError,
  parsePayload,
  payloadBytes,
  PRODUCT_ID,
  toBase64,
  type LicensePayload,
} from '@shared/license/core';
import { LICENSE_FILE, LicenseStore } from '../../src/main/license/LicenseStore';

const NOW = new Date('2026-10-15T12:00:00Z');
const IP = '203.0.113.7';
const inflate = (d: Uint8Array) => new Uint8Array(inflateSync(d));
const deflate = (d: Uint8Array) => new Uint8Array(deflateSync(d));

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const PUBLIC_X = publicKey.export({ format: 'jwk' }).x as string;
const other = generateKeyPairSync('ed25519');

function payload(patch: Partial<LicensePayload> = {}): LicensePayload {
  return {
    ...buildPayload({ name: 'Asha Rao', years: 2, id: 'id-1', now: NOW, issuer: 'test', ip: IP }),
    ...patch,
  };
}

function container(p: LicensePayload = payload(), key = privateKey): Uint8Array {
  const bytes = payloadBytes(p);
  return encodeContainer(bytes, new Uint8Array(sign(null, bytes, key)));
}

/** A license PNG, like the signing script makes. */
function licensePng(c: Uint8Array = container(), width = 64, height = 64): Uint8Array {
  const rgba = new Uint8Array(width * height * 4).map((_, i) =>
    i % 4 === 3 ? 255 : (i * 37) & 0xff,
  );
  embedBits(rgba, c);
  return encodePng({ width, height, rgba }, deflate);
}

describe('license payload', () => {
  it('builds a payload with the product, dates and the IP address', () => {
    const p = buildPayload({
      name: '  Asha   Rao ',
      years: 3,
      id: 'x',
      now: NOW,
      issuer: 't',
      ip: IP,
    });
    expect(p).toMatchObject({ v: 1, product: PRODUCT_ID, name: 'Asha Rao', years: 3 });
    expect(p.issued).toBe(NOW.toISOString());
    expect(p.expires).toBe('2029-10-15T12:00:00.000Z');
    expect(p.ip).toBe(IP);
    const withIp = buildPayload({
      name: 'A',
      years: 1,
      id: 'x',
      now: NOW,
      issuer: 't',
      ip: '203.0.113.7',
    });
    expect(withIp.ip).toBe('203.0.113.7');
  });

  it('rejects bad names and durations', () => {
    expect(() =>
      buildPayload({ name: ' ', years: 1, id: 'x', now: NOW, issuer: 't', ip: IP }),
    ).toThrow(LicenseError);
    expect(() =>
      buildPayload({ name: 'A', years: 0, id: 'x', now: NOW, issuer: 't', ip: IP }),
    ).toThrow(LicenseError);
    expect(() =>
      buildPayload({ name: 'A', years: 1.5, id: 'x', now: NOW, issuer: 't', ip: IP }),
    ).toThrow(LicenseError);
    expect(() =>
      buildPayload({ name: 'A'.repeat(121), years: 1, id: 'x', now: NOW, issuer: 't', ip: IP }),
    ).toThrow(LicenseError);
  });

  it('requires the IP address, and refuses older licenses without one', () => {
    expect(() =>
      buildPayload({ name: 'A', years: 1, id: 'x', now: NOW, issuer: 't', ip: '' }),
    ).toThrow(/IP address/);
    expect(() =>
      buildPayload({ name: 'A', years: 1, id: 'x', now: NOW, issuer: 't', ip: 'not an ip' }),
    ).toThrow(/IP address/);
    expect(isIp('2001:db8::1')).toBe(true);
    expect(isIp('256.1.1.1')).toBe(false);
    const { ip: _ip, ...old } = payload();
    expect(() => parsePayload(old)).toThrow(/older version/);
  });

  it('adds years keeping the day, and 29 Feb falls back to 28 Feb', () => {
    expect(addYears(new Date('2028-02-29T00:00:00Z'), 1).toISOString()).toBe(
      '2029-02-28T00:00:00.000Z',
    );
    expect(addYears(new Date('2026-01-31T05:00:00Z'), 2).toISOString()).toBe(
      '2028-01-31T05:00:00.000Z',
    );
  });

  it('checks product and dates', () => {
    expect(checkPayload(payload(), NOW)).toBe('valid');
    expect(checkPayload(payload(), new Date('2029-01-01T00:00:00Z'))).toBe('expired');
    expect(checkPayload(payload(), new Date('2026-10-10T00:00:00Z'))).toBe('not-yet-valid');
    expect(PRODUCT_ID).toBe('smaran.sahaj.si');
    expect(checkPayload(payload({ product: 'com.sahaj.smaran' }), NOW)).toBe('valid');
    expect(() => checkPayload(payload({ product: 'com.other.app' }), NOW)).toThrow(
      /different product/,
    );
  });

  it('parses only well-formed payloads', () => {
    expect(parsePayload(payload())).toMatchObject({ name: 'Asha Rao' });
    for (const bad of [
      null,
      5,
      { ...payload(), v: 2 },
      { ...payload(), years: 0 },
      { ...payload(), issued: 'soon' },
    ])
      expect(() => parsePayload(bad)).toThrow(LicenseError);
  });
});

describe('container', () => {
  it('round-trips payload and signature', () => {
    const c = decodeContainer(container());
    expect(c.payload.id).toBe('id-1');
    expect(c.signature).toHaveLength(64);
  });

  it('refuses foreign, truncated, newer and damaged data', () => {
    expect(() => decodeContainer(new Uint8Array(40))).toThrow(/doesn’t contain/);
    expect(() => decodeContainer(container().slice(0, 30))).toThrow(LicenseError);
    const newer = container();
    newer[7] = 9;
    expect(() => decodeContainer(newer)).toThrow(/newer Smaran/);
    const junk = encodeContainer(new TextEncoder().encode('{nope'), new Uint8Array(64));
    expect(() => decodeContainer(junk)).toThrow(/damaged/);
    expect(() => encodeContainer(new Uint8Array(3), new Uint8Array(10))).toThrow();
  });
});

describe('steganography and images', () => {
  it('hides the container in pixel low bits, leaving alpha and high bits alone', () => {
    const rgba = new Uint8Array(32 * 32 * 4).fill(200);
    const c = container();
    embedBits(rgba, c);
    expect(extractBits(rgba)).toEqual(c);
    expect(rgba.every((v, i) => (i % 4 === 3 ? v === 200 : v === 200 || v === 201))).toBe(true);
  });

  it('says when the image is too small or holds no license', () => {
    expect(capacity(8)).toBe(3);
    expect(() => embedBits(new Uint8Array(16), container())).toThrow(/too small/);
    expect(() => extractBits(new Uint8Array(64 * 64 * 4))).toThrow(/doesn’t contain/);
    expect(() => extractBits(new Uint8Array(8))).toThrow(LicenseError);
  });

  it('encodes and decodes PNG (RGBA and RGB) exactly', () => {
    const png = licensePng();
    expect(isPng(png)).toBe(true);
    const bmp = decodePng(png, inflate);
    expect(bmp.width).toBe(64);
    expect(decodeContainer(extractBits(bmp.rgba)).payload.name).toBe('Asha Rao');
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082);
  });

  it('decodes every PNG row filter', () => {
    // 2×2 RGB image, one row per filter type would need 5 rows: use 5 rows of 1 pixel.
    const rows = [0, 1, 2, 3, 4].map((f) => [f, 10 + f, 20 + f, 30 + f]);
    const raw = new Uint8Array(rows.flat());
    const ihdr = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 5, 8, 2, 0, 0, 0]);
    const chunk = (type: string, data: Uint8Array) => {
      const out = new Uint8Array(12 + data.length);
      const v = new DataView(out.buffer);
      v.setUint32(0, data.length);
      out.set(new TextEncoder().encode(type), 4);
      out.set(data, 8);
      v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
      return out;
    };
    const parts = [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflate(raw)),
      chunk('IEND', new Uint8Array(0)),
    ];
    const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      png.set(p, o);
      o += p.length;
    }
    const bmp = decodePng(png, inflate);
    expect(bmp.height).toBe(5);
    expect(Array.from(bmp.rgba.slice(0, 4))).toEqual([10, 20, 30, 255]);
    // Row 2 (Up filter) adds the row above.
    expect(bmp.rgba[8]).toBe((12 + bmp.rgba[4]!) & 0xff);
  });

  it('carries the license in a JPEG comment, and reads it back', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x01, 0x02, 0xff, 0xda, 0, 0, 0xff, 0xd9,
    ]);
    const c = container();
    const withLicense = jpegWithLicense(jpeg, c);
    expect(isJpeg(withLicense)).toBe(true);
    expect(jpegLicense(withLicense)).toEqual(c);
    expect(jpegLicense(jpeg)).toBeNull();
    expect(containerFromImage(withLicense, inflate)).toEqual(c);
    expect(() => containerFromImage(jpeg, inflate)).toThrow(/original PNG/);
    expect(() => jpegWithLicense(new Uint8Array([1, 2, 3]), c)).toThrow();
  });

  it('base64 round-trips', () => {
    const bytes = new Uint8Array([0, 1, 254, 255, 128]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe('LicenseStore', () => {
  let dir: string;
  let now = NOW;
  const store = () => new LicenseStore(dir, { now: () => now, publicKey: PUBLIC_X });
  const write = (name: string, bytes: Uint8Array) => {
    const path = join(dir, name);
    writeFileSync(path, bytes);
    return path;
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smaran-license-'));
    now = NOW;
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('starts with no license', () => {
    expect(store().info()).toMatchObject({ status: 'missing', license: null });
    expect(store().valid).toBe(false);
  });

  it('imports a genuine license, keeps it, and re-verifies it on every start', () => {
    const info = store().importFile(write('a.png', licensePng()));
    expect(info.license?.ip).toBe(IP);
    expect(info).toMatchObject({
      status: 'valid',
      license: { name: 'Asha Rao', years: 2, id: 'id-1' },
    });
    expect(store().valid).toBe(true);
    const saved = JSON.parse(readFileSync(join(dir, LICENSE_FILE), 'utf8'));
    expect(saved.container).toBeTypeOf('string');
  });

  it('refuses forged, edited and other-product licenses, keeping the current one', () => {
    store().importFile(write('good.png', licensePng()));
    const forged = licensePng(container(payload({ name: 'Forger' }), other.privateKey));
    expect(() => store().importFile(write('forged.png', forged))).toThrow(/isn’t genuine/);
    const wrong = licensePng(container(payload({ product: 'com.other.app' })));
    expect(() => store().importFile(write('wrong.png', wrong))).toThrow(/different product/);
    expect(store().info().license?.name).toBe('Asha Rao');
  });

  it('refuses expired licenses and images without one', () => {
    now = new Date('2029-01-01T00:00:00Z');
    expect(() => store().importFile(write('old.png', licensePng()))).toThrow(/expired/);
    expect(() =>
      store().importFile(
        write(
          'plain.png',
          encodePng({ width: 64, height: 64, rgba: new Uint8Array(64 * 64 * 4) }, deflate),
        ),
      ),
    ).toThrow(/doesn’t contain/);
    expect(() => store().importFile(join(dir, 'missing.png'))).toThrow(/could not be opened/);
  });

  it('notices an edited license file, expiry and a clock set back', () => {
    store().importFile(write('a.png', licensePng()));
    const file = join(dir, LICENSE_FILE);
    const saved = JSON.parse(readFileSync(file, 'utf8'));

    now = new Date('2026-12-01T00:00:00Z');
    expect(store().valid).toBe(true); // moves lastSeen forward
    now = new Date('2026-11-01T00:00:00Z');
    expect(store().info()).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/date/),
    });

    now = new Date('2030-01-01T00:00:00Z');
    expect(store().info().status).toBe('expired');

    const raw = fromBase64(saved.container);
    raw[20] = (raw[20] ?? 0) ^ 1;
    writeFileSync(file, JSON.stringify({ ...saved, container: toBase64(raw) }));
    expect(store().info().status).toBe('invalid');
    writeFileSync(file, '{ not json');
    expect(store().info()).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/damaged/),
    });
  });
});
