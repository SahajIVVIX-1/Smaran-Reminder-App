/**
 * Smaran's offline licenses. A license is a small JSON payload, signed with Ed25519, hidden inside
 * an image. Pure code (Uint8Array in, Uint8Array out) so the same file runs in the app, in the
 * /Register page and in the signing script (scripts/ bundle it with esbuild).
 *
 * Layout of the hidden bytes ("container"):
 *   "SMRNLIC" + format version (1 byte) + payload length (uint32, big-endian) + payload (UTF-8
 *   JSON) + Ed25519 signature of the payload (64 bytes).
 *
 * PNG: the container is written into the lowest bit of each pixel's red, green and blue values,
 * pixel by pixel from the top left. Invisible, and exact because PNG is lossless.
 * JPEG: compression destroys those bits, so a JPEG copy carries the container in a comment
 * segment instead. PNG is the recommended license format.
 *
 * This deters copying and editing; like any offline check it can't be made impossible to bypass.
 */

export const PRODUCT_ID = 'smaran.sahaj.si';
/** Product ids of licenses issued before the current one; still accepted. */
export const EARLIER_PRODUCT_IDS: readonly string[] = ['com.sahaj.smaran'];
export const PRODUCT_NAME = 'Smaran';
export const FORMAT_VERSION = 1;
const MAGIC = 'SMRNLIC';
const HEADER = MAGIC.length + 1 + 4;
export const SIGNATURE_BYTES = 64;
/** Payloads are small; anything bigger is not ours. */
const MAX_PAYLOAD = 16 * 1024;
export const MAX_YEARS = 100;
export const MAX_NAME = 120;

export interface LicensePayload {
  /** Payload format version. */
  v: number;
  product: string;
  /** Unique license id (UUID). */
  id: string;
  name: string;
  years: number;
  /** ISO times. */
  issued: string;
  expires: string;
  /** Who made it, e.g. "Smaran Register" or "license-sign". */
  issuer: string;
  /** The public IP address the license was issued from (required since 2.16). */
  ip: string;
}

/** An IPv4 or IPv6 address, as public-IP services return them. */
export function isIp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 45) return false;
  const v4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  return v4.test(value) || (/^[0-9a-f:.]+$/i.test(value) && value.includes(':'));
}

export interface Container {
  payload: LicensePayload;
  /** The exact signed bytes. */
  payloadBytes: Uint8Array;
  signature: Uint8Array;
}

export class LicenseError extends Error {
  constructor(
    readonly code:
      | 'no-license'
      | 'damaged'
      | 'bad-signature'
      | 'wrong-product'
      | 'expired'
      | 'not-yet-valid'
      | 'unsupported'
      | 'too-small',
    message: string,
  ) {
    super(message);
    this.name = 'LicenseError';
  }
}

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder('utf-8', { fatal: true });

// ---------- payload ----------

/** Adds whole years, keeping the day (29 Feb becomes 28 Feb in a non-leap year). */
export function addYears(from: Date, years: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function buildPayload(input: {
  name: string;
  years: number;
  id: string;
  now: Date;
  issuer: string;
  ip: string;
}): LicensePayload {
  const name = cleanName(input.name);
  if (!isIp(input.ip))
    throw new LicenseError('damaged', 'The IP address used to make the license is missing.');
  if (!name) throw new LicenseError('damaged', 'Enter the licensee’s name.');
  if (name.length > MAX_NAME) throw new LicenseError('damaged', 'The name is too long.');
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > MAX_YEARS)
    throw new LicenseError('damaged', `Choose between 1 and ${MAX_YEARS} years.`);
  return {
    v: FORMAT_VERSION,
    product: PRODUCT_ID,
    id: input.id,
    name,
    years: input.years,
    issued: input.now.toISOString(),
    expires: addYears(input.now, input.years).toISOString(),
    issuer: input.issuer,
    ip: input.ip,
  };
}

const isIso = (s: unknown): s is string => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/** Checks the shape of a decoded payload (not its signature or dates). */
export function parsePayload(value: unknown): LicensePayload {
  const p = value as Partial<LicensePayload> | null;
  const ok =
    typeof p === 'object' &&
    p !== null &&
    p.v === FORMAT_VERSION &&
    typeof p.product === 'string' &&
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    p.id.length <= 64 &&
    typeof p.name === 'string' &&
    p.name.length > 0 &&
    p.name.length <= MAX_NAME &&
    typeof p.years === 'number' &&
    Number.isInteger(p.years) &&
    p.years >= 1 &&
    p.years <= MAX_YEARS &&
    isIso(p.issued) &&
    isIso(p.expires) &&
    typeof p.issuer === 'string';
  if (!ok) throw new LicenseError('damaged', 'This license isn’t valid.');
  // Licenses from before 2.16 didn't record the IP address; they must be issued again.
  if (!isIp(p.ip))
    throw new LicenseError(
      'damaged',
      'This license isn’t valid any more. Ask for a new license.',
    );
  return p as LicensePayload;
}

export type LicenseState = 'valid' | 'expired' | 'not-yet-valid';

/** Product and dates, for a payload whose signature is already verified. */
export function checkPayload(payload: LicensePayload, now: Date): LicenseState {
  if (payload.product !== PRODUCT_ID && !EARLIER_PRODUCT_IDS.includes(payload.product))
    throw new LicenseError('wrong-product', 'This license isn’t valid.');
  // A day's grace either side for clocks and time zones.
  const day = 86_400_000;
  if (now.getTime() < Date.parse(payload.issued) - day) return 'not-yet-valid';
  if (now.getTime() >= Date.parse(payload.expires)) return 'expired';
  return 'valid';
}

export function payloadBytes(payload: LicensePayload): Uint8Array {
  return utf8.encode(JSON.stringify(payload));
}

// ---------- container ----------

export function encodeContainer(payload: Uint8Array, signature: Uint8Array): Uint8Array {
  if (signature.length !== SIGNATURE_BYTES) throw new Error('An Ed25519 signature is 64 bytes.');
  const out = new Uint8Array(HEADER + payload.length + SIGNATURE_BYTES);
  out.set(utf8.encode(MAGIC), 0);
  out[MAGIC.length] = FORMAT_VERSION;
  new DataView(out.buffer).setUint32(MAGIC.length + 1, payload.length);
  out.set(payload, HEADER);
  out.set(signature, HEADER + payload.length);
  return out;
}

/** Total container length from its first HEADER bytes, or null if they aren't ours. */
function containerLength(head: Uint8Array): number | null {
  if (head.length < HEADER) return null;
  for (let i = 0; i < MAGIC.length; i++) if (head[i] !== MAGIC.charCodeAt(i)) return null;
  if (head[MAGIC.length] !== FORMAT_VERSION)
    throw new LicenseError(
      'unsupported',
      'This license was made for a newer Smaran. Update Smaran, then import it again.',
    );
  const length = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(
    MAGIC.length + 1,
  );
  if (length === 0 || length > MAX_PAYLOAD)
    throw new LicenseError('damaged', 'This license isn’t valid.');
  return HEADER + length + SIGNATURE_BYTES;
}

export function decodeContainer(bytes: Uint8Array): Container {
  const total = containerLength(bytes);
  if (total === null || bytes.length < total)
    throw new LicenseError('no-license', 'This image doesn’t contain a Smaran license.');
  const payloadBytes = bytes.slice(HEADER, total - SIGNATURE_BYTES);
  const signature = bytes.slice(total - SIGNATURE_BYTES, total);
  let json: unknown;
  try {
    json = JSON.parse(fromUtf8.decode(payloadBytes));
  } catch {
    throw new LicenseError('damaged', 'This license isn’t valid.');
  }
  return { payload: parsePayload(json), payloadBytes, signature };
}

// ---------- least-significant-bit steganography (RGBA pixels) ----------

/** How many bytes fit in `pixels` RGBA pixels: 3 bits per pixel. */
export function capacity(pixels: number): number {
  return Math.floor((pixels * 3) / 8);
}

/** Writes `data` into the low bit of R, G and B of each pixel, in order. Alpha is left alone. */
export function embedBits(rgba: Uint8Array | Uint8ClampedArray, data: Uint8Array): void {
  if (data.length > capacity(rgba.length / 4))
    throw new LicenseError('too-small', 'The license image couldn’t be made.');
  let bit = 0;
  for (let i = 0; i < rgba.length && bit < data.length * 8; i++) {
    if (i % 4 === 3) continue;
    const value = ((data[bit >> 3] ?? 0) >> (7 - (bit & 7))) & 1;
    rgba[i] = ((rgba[i] ?? 0) & 0xfe) | value;
    bit++;
  }
}

/** Reads `count` bytes back from the low bits, starting after `skip` bytes. */
function readBits(rgba: Uint8Array | Uint8ClampedArray, count: number): Uint8Array {
  const out = new Uint8Array(count);
  let bit = 0;
  for (let i = 0; i < rgba.length && bit < count * 8; i++) {
    if (i % 4 === 3) continue;
    out[bit >> 3] = (out[bit >> 3] ?? 0) | (((rgba[i] ?? 0) & 1) << (7 - (bit & 7)));
    bit++;
  }
  if (bit < count * 8)
    throw new LicenseError('no-license', 'This image doesn’t contain a Smaran license.');
  return out;
}

export function extractBits(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const total = containerLength(readBits(rgba, HEADER));
  if (total === null)
    throw new LicenseError('no-license', 'This image doesn’t contain a Smaran license.');
  return readBits(rgba, total);
}

// ---------- JPEG comment segment ----------

const JPEG_TAG = 'SMRNLIC-B64:';

/** Inserts the container as a comment segment right after the JPEG's start marker. */
export function jpegWithLicense(jpeg: Uint8Array, container: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('Not a JPEG.');
  const text = utf8.encode(JPEG_TAG + toBase64(container));
  if (text.length + 2 > 0xffff) throw new Error('License too large for a JPEG comment.');
  const seg = new Uint8Array(4 + text.length);
  seg[0] = 0xff;
  seg[1] = 0xfe;
  seg[2] = (text.length + 2) >> 8;
  seg[3] = (text.length + 2) & 0xff;
  seg.set(text, 4);
  const out = new Uint8Array(jpeg.length + seg.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(seg, 2);
  out.set(jpeg.subarray(2), 2 + seg.length);
  return out;
}

/** The container from a JPEG's comment segments, or null. */
export function jpegLicense(jpeg: Uint8Array): Uint8Array | null {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= jpeg.length) {
    if (jpeg[i] !== 0xff) return null;
    const marker = jpeg[i + 1] ?? 0;
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / start of scan
    if (marker === 0xff) {
      i++;
      continue;
    }
    const len = ((jpeg[i + 2] ?? 0) << 8) | (jpeg[i + 3] ?? 0);
    if (len < 2) return null;
    if (marker === 0xfe) {
      const text = new TextDecoder().decode(jpeg.subarray(i + 4, i + 2 + len));
      if (text.startsWith(JPEG_TAG)) {
        try {
          return fromBase64(text.slice(JPEG_TAG.length));
        } catch {
          return null;
        }
      }
    }
    i += 2 + len;
  }
  return null;
}

// ---------- PNG (8-bit RGB/RGBA, not interlaced: what browsers and the signing script write) ----

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIG.every((b, i) => bytes[i] === b);
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface Bitmap {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  rgba: Uint8Array;
}

/** Decodes a PNG. `inflate` is zlib's (node:zlib inflateSync in the app). */
export function decodePng(bytes: Uint8Array, inflate: (data: Uint8Array) => Uint8Array): Bitmap {
  if (!isPng(bytes)) throw new LicenseError('no-license', 'This image doesn’t contain a Smaran license.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Uint8Array[] = [];
  while (pos + 8 <= bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      const depth = data[8];
      colorType = data[11] === 0 ? (data[9] ?? -1) : -2; // interlaced → unsupported
      if (depth !== 8 || (colorType !== 2 && colorType !== 6))
        throw new LicenseError(
          'unsupported',
          'This license isn’t valid.',
        );
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!width || !height || idat.length === 0)
    throw new LicenseError('damaged', 'This license isn’t valid.');
  if (width * height > 40_000_000)
    throw new LicenseError('unsupported', 'This image is too large to be a license.');
  const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let o = 0;
  for (const d of idat) {
    joined.set(d, o);
    o += d.length;
  }
  let raw: Uint8Array;
  try {
    raw = inflate(joined);
  } catch {
    throw new LicenseError('damaged', 'This license isn’t valid.');
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  if (raw.length < height * (stride + 1))
    throw new LicenseError('damaged', 'This license isn’t valid.');
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? (row[x - bpp] ?? 0) : 0;
      const b = prev ? (prev[x] ?? 0) : 0;
      const c = prev && x >= bpp ? (prev[x - bpp] ?? 0) : 0;
      const s = src[x] ?? 0;
      let v: number;
      switch (filter) {
        case 0:
          v = s;
          break;
        case 1:
          v = s + a;
          break;
        case 2:
          v = s + b;
          break;
        case 3:
          v = s + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = s + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new LicenseError('damaged', 'This license isn’t valid.');
      }
      row[x] = v & 0xff;
    }
  }
  if (bpp === 4) return { width, height, rgba: pixels };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    rgba[j] = pixels[i] ?? 0;
    rgba[j + 1] = pixels[i + 1] ?? 0;
    rgba[j + 2] = pixels[i + 2] ?? 0;
    rgba[j + 3] = 255;
  }
  return { width, height, rgba };
}

/** Encodes RGBA pixels as a PNG (no filtering). `deflate` is zlib's. */
export function encodePng(bitmap: Bitmap, deflate: (data: Uint8Array) => Uint8Array): Uint8Array {
  const { width, height, rgba } = bitmap;
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++)
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const chunks = [
    chunk('IHDR', ihdr),
    chunk('IDAT', deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(8 + chunks.reduce((n, c) => n + c.length, 0));
  out.set(PNG_SIG, 0);
  let o = 8;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(utf8.encode(type), 4);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

// ---------- reading a license from any image file ----------

/**
 * The container hidden in a license image: LSB pixels for PNG, the comment segment for JPEG.
 * `decodeOther` decodes other formats (or a JPEG without a comment) to RGBA, when available.
 */
export function containerFromImage(
  bytes: Uint8Array,
  inflate: (data: Uint8Array) => Uint8Array,
  decodeOther?: (bytes: Uint8Array) => Bitmap | null,
): Uint8Array {
  if (isPng(bytes)) return extractBits(decodePng(bytes, inflate).rgba);
  if (isJpeg(bytes)) {
    const fromComment = jpegLicense(bytes);
    if (fromComment) return fromComment;
  }
  const other = decodeOther?.(bytes);
  if (other) {
    try {
      return extractBits(other.rgba);
    } catch {
      // fall through to the friendlier message below
    }
  }
  throw new LicenseError(
    'no-license',
    isJpeg(bytes)
      ? 'This image doesn’t contain a Smaran license.'
      : 'This image doesn’t contain a Smaran license.',
  );
}

// ---------- base64 ----------

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  const s = atob(text.trim());
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
