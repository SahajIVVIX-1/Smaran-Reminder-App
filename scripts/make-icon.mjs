// Generates the placeholder app icon (build/icon.ico + resources/icon.png) with no extra dependencies.
// Design: indigo rounded square with a white ring and dot. Replace with a designed icon before release.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Coverage (0..1) of a rounded square, a ring and a dot, sampled at pixel centre with a 1px soft edge.
function pixel(x, y, size) {
  const s = size;
  const r = s * 0.22;
  const half = s / 2;
  const qx = Math.abs(x - half) - (half - r);
  const qy = Math.abs(y - half) - (half - r);
  const dBox = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  const boxA = clamp01(0.5 - dBox);

  const dist = Math.hypot(x - half, y - half);
  const ringR = s * 0.27;
  const ringW = s * 0.07;
  const ringA = clamp01(0.5 - (Math.abs(dist - ringR) - ringW / 2));
  const dotA = clamp01(0.5 - (dist - s * 0.08));
  const white = Math.max(ringA, dotA);

  const t = y / s;
  const bg = [Math.round(79 - 20 * t), Math.round(70 - 25 * t), Math.round(229 - 40 * t)];
  const rgb = bg.map((c) => Math.round(c * (1 - white) + 255 * white));
  return [...rgb, Math.round(255 * boxA)];
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ico(sizes) {
  const images = sizes.map(png);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map((img, i) => {
    const e = Buffer.alloc(16);
    const s = sizes[i];
    e[0] = s >= 256 ? 0 : s;
    e[1] = s >= 256 ? 0 : s;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(img.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images]);
}

mkdirSync(join(root, 'build'), { recursive: true });
mkdirSync(join(root, 'resources'), { recursive: true });
writeFileSync(join(root, 'build', 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]));
writeFileSync(join(root, 'resources', 'icon.png'), png(256));
console.log('Wrote build/icon.ico and resources/icon.png');
