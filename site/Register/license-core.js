// Generated from src/shared/license/core.ts by scripts/build-license-core.mjs.

// src/shared/license/core.ts
var PRODUCT_ID = "com.sahaj.smaran";
var PRODUCT_NAME = "Smaran";
var FORMAT_VERSION = 1;
var MAGIC = "SMRNLIC";
var HEADER = MAGIC.length + 1 + 4;
var SIGNATURE_BYTES = 64;
var MAX_PAYLOAD = 16 * 1024;
var MAX_YEARS = 100;
var MAX_NAME = 120;
var LicenseError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "LicenseError";
  }
};
var utf8 = new TextEncoder();
var fromUtf8 = new TextDecoder("utf-8", { fatal: true });
function addYears(from, years) {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
function cleanName(name) {
  return name.replace(/\s+/g, " ").trim();
}
function buildPayload(input) {
  const name = cleanName(input.name);
  if (!name) throw new LicenseError("damaged", "Enter the licensee\u2019s name.");
  if (name.length > MAX_NAME) throw new LicenseError("damaged", "The name is too long.");
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > MAX_YEARS)
    throw new LicenseError("damaged", `Choose between 1 and ${MAX_YEARS} years.`);
  return {
    v: FORMAT_VERSION,
    product: PRODUCT_ID,
    id: input.id,
    name,
    years: input.years,
    issued: input.now.toISOString(),
    expires: addYears(input.now, input.years).toISOString(),
    issuer: input.issuer,
    ...input.ip ? { ip: input.ip } : {}
  };
}
var isIso = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s));
function parsePayload(value) {
  const p = value;
  const ok = typeof p === "object" && p !== null && p.v === FORMAT_VERSION && typeof p.product === "string" && typeof p.id === "string" && p.id.length > 0 && p.id.length <= 64 && typeof p.name === "string" && p.name.length > 0 && p.name.length <= MAX_NAME && typeof p.years === "number" && Number.isInteger(p.years) && p.years >= 1 && p.years <= MAX_YEARS && isIso(p.issued) && isIso(p.expires) && typeof p.issuer === "string" && (p.ip === void 0 || typeof p.ip === "string" && p.ip.length <= 64);
  if (!ok) throw new LicenseError("damaged", "The license data inside this image is damaged.");
  return p;
}
function checkPayload(payload, now) {
  if (payload.product !== PRODUCT_ID)
    throw new LicenseError("wrong-product", "This license is for a different product.");
  const day = 864e5;
  if (now.getTime() < Date.parse(payload.issued) - day) return "not-yet-valid";
  if (now.getTime() >= Date.parse(payload.expires)) return "expired";
  return "valid";
}
function payloadBytes(payload) {
  return utf8.encode(JSON.stringify(payload));
}
function encodeContainer(payload, signature) {
  if (signature.length !== SIGNATURE_BYTES) throw new Error("An Ed25519 signature is 64 bytes.");
  const out = new Uint8Array(HEADER + payload.length + SIGNATURE_BYTES);
  out.set(utf8.encode(MAGIC), 0);
  out[MAGIC.length] = FORMAT_VERSION;
  new DataView(out.buffer).setUint32(MAGIC.length + 1, payload.length);
  out.set(payload, HEADER);
  out.set(signature, HEADER + payload.length);
  return out;
}
function containerLength(head) {
  if (head.length < HEADER) return null;
  for (let i = 0; i < MAGIC.length; i++) if (head[i] !== MAGIC.charCodeAt(i)) return null;
  if (head[MAGIC.length] !== FORMAT_VERSION)
    throw new LicenseError(
      "unsupported",
      "This license was made for a newer Smaran. Update Smaran, then import it again."
    );
  const length = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(
    MAGIC.length + 1
  );
  if (length === 0 || length > MAX_PAYLOAD)
    throw new LicenseError("damaged", "The license data inside this image is damaged.");
  return HEADER + length + SIGNATURE_BYTES;
}
function decodeContainer(bytes) {
  const total = containerLength(bytes);
  if (total === null || bytes.length < total)
    throw new LicenseError("no-license", "This image doesn\u2019t contain a Smaran license.");
  const payloadBytes2 = bytes.slice(HEADER, total - SIGNATURE_BYTES);
  const signature = bytes.slice(total - SIGNATURE_BYTES, total);
  let json;
  try {
    json = JSON.parse(fromUtf8.decode(payloadBytes2));
  } catch {
    throw new LicenseError("damaged", "The license data inside this image is damaged.");
  }
  return { payload: parsePayload(json), payloadBytes: payloadBytes2, signature };
}
function capacity(pixels) {
  return Math.floor(pixels * 3 / 8);
}
function embedBits(rgba, data) {
  if (data.length > capacity(rgba.length / 4))
    throw new LicenseError("too-small", "The image is too small to hold the license.");
  let bit = 0;
  for (let i = 0; i < rgba.length && bit < data.length * 8; i++) {
    if (i % 4 === 3) continue;
    const value = (data[bit >> 3] ?? 0) >> 7 - (bit & 7) & 1;
    rgba[i] = (rgba[i] ?? 0) & 254 | value;
    bit++;
  }
}
function readBits(rgba, count) {
  const out = new Uint8Array(count);
  let bit = 0;
  for (let i = 0; i < rgba.length && bit < count * 8; i++) {
    if (i % 4 === 3) continue;
    out[bit >> 3] = (out[bit >> 3] ?? 0) | ((rgba[i] ?? 0) & 1) << 7 - (bit & 7);
    bit++;
  }
  if (bit < count * 8)
    throw new LicenseError("no-license", "This image doesn\u2019t contain a Smaran license.");
  return out;
}
function extractBits(rgba) {
  const total = containerLength(readBits(rgba, HEADER));
  if (total === null)
    throw new LicenseError("no-license", "This image doesn\u2019t contain a Smaran license.");
  return readBits(rgba, total);
}
var JPEG_TAG = "SMRNLIC-B64:";
function jpegWithLicense(jpeg, container) {
  if (jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error("Not a JPEG.");
  const text = utf8.encode(JPEG_TAG + toBase64(container));
  if (text.length + 2 > 65535) throw new Error("License too large for a JPEG comment.");
  const seg = new Uint8Array(4 + text.length);
  seg[0] = 255;
  seg[1] = 254;
  seg[2] = text.length + 2 >> 8;
  seg[3] = text.length + 2 & 255;
  seg.set(text, 4);
  const out = new Uint8Array(jpeg.length + seg.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(seg, 2);
  out.set(jpeg.subarray(2), 2 + seg.length);
  return out;
}
function jpegLicense(jpeg) {
  if (jpeg[0] !== 255 || jpeg[1] !== 216) return null;
  let i = 2;
  while (i + 4 <= jpeg.length) {
    if (jpeg[i] !== 255) return null;
    const marker = jpeg[i + 1] ?? 0;
    if (marker === 217 || marker === 218) return null;
    if (marker === 255) {
      i++;
      continue;
    }
    const len = (jpeg[i + 2] ?? 0) << 8 | (jpeg[i + 3] ?? 0);
    if (len < 2) return null;
    if (marker === 254) {
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
var PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
function isPng(bytes) {
  return PNG_SIG.every((b, i) => bytes[i] === b);
}
function isJpeg(bytes) {
  return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}
var CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 4294967295;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 255] ?? 0) ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function decodePng(bytes, inflate) {
  if (!isPng(bytes)) throw new LicenseError("no-license", "This file isn\u2019t a PNG image.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat = [];
  while (pos + 8 <= bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      const depth = data[8];
      colorType = data[11] === 0 ? data[9] ?? -1 : -2;
      if (depth !== 8 || colorType !== 2 && colorType !== 6)
        throw new LicenseError(
          "unsupported",
          "This PNG has been re-saved in a format Smaran can\u2019t read the license from. Use the original image."
        );
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!width || !height || idat.length === 0)
    throw new LicenseError("damaged", "This PNG image is damaged.");
  if (width * height > 4e7)
    throw new LicenseError("unsupported", "This image is too large to be a license.");
  const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let o = 0;
  for (const d of idat) {
    joined.set(d, o);
    o += d.length;
  }
  let raw;
  try {
    raw = inflate(joined);
  } catch {
    throw new LicenseError("damaged", "This PNG image is damaged.");
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  if (raw.length < height * (stride + 1))
    throw new LicenseError("damaged", "This PNG image is damaged.");
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] ?? 0 : 0;
      const b = prev ? prev[x] ?? 0 : 0;
      const c = prev && x >= bpp ? prev[x - bpp] ?? 0 : 0;
      const s = src[x] ?? 0;
      let v;
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
          v = s + (a + b >> 1);
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
          throw new LicenseError("damaged", "This PNG image is damaged.");
      }
      row[x] = v & 255;
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
function encodePng(bitmap, deflate) {
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
    chunk("IHDR", ihdr),
    chunk("IDAT", deflate(raw)),
    chunk("IEND", new Uint8Array(0))
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
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(utf8.encode(type), 4);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function containerFromImage(bytes, inflate, decodeOther) {
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
    }
  }
  throw new LicenseError(
    "no-license",
    isJpeg(bytes) ? "This JPG doesn\u2019t contain a Smaran license. JPG compression often destroys it: use the original PNG license." : "This image doesn\u2019t contain a Smaran license. Use the PNG license image you were given."
  );
}
function toBase64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromBase64(text) {
  const s = atob(text.trim());
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export {
  FORMAT_VERSION,
  LicenseError,
  MAX_NAME,
  MAX_YEARS,
  PRODUCT_ID,
  PRODUCT_NAME,
  SIGNATURE_BYTES,
  addYears,
  buildPayload,
  capacity,
  checkPayload,
  cleanName,
  containerFromImage,
  crc32,
  decodeContainer,
  decodePng,
  embedBits,
  encodeContainer,
  encodePng,
  extractBits,
  fromBase64,
  isJpeg,
  isPng,
  jpegLicense,
  jpegWithLicense,
  parsePayload,
  payloadBytes,
  toBase64
};
