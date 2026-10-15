// Issues a Smaran license from the command line, signed with the private key on this PC.
//
//   node scripts/license-sign.mjs --name "Asha Rao" --years 2 [--out license.png] [--ip 203.0.113.7]
//
// Without --ip, the public IP address is looked up (api.ipify.org) and stored in the license.
// Writes a PNG with the signed license hidden in its pixels. The /Register page makes the same
// license with a designed card; this is the offline fallback. Run `npm run license:keygen` first.

import { randomUUID, createPrivateKey, sign } from 'node:crypto';
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  buildPayload,
  embedBits,
  encodeContainer,
  encodePng,
  payloadBytes,
} from './license-core.mjs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const name = arg('name');
const years = Number(arg('years'));
if (!name || !Number.isInteger(years)) {
  console.error(
    'Usage: node scripts/license-sign.mjs --name "Full Name" --years 2 [--out file.png] [--ip address]',
  );
  process.exit(1);
}
const keyDir = process.env.SMARAN_LICENSE_KEY_DIR || join(homedir(), '.smaran-license');
const keyFile = join(keyDir, 'private-key.json');
if (!fs.existsSync(keyFile)) {
  console.error(`No private key at ${keyFile}. Run: npm run license:keygen`);
  process.exit(1);
}
const key = createPrivateKey({ key: JSON.parse(fs.readFileSync(keyFile, 'utf8')), format: 'jwk' });

// Every license records the public IP address it was issued from: given, or looked up now.
let ip = arg('ip');
if (!ip) {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    ip = (await res.json()).ip;
  } catch {
    console.error(
      'Couldn’t look up this PC’s public IP address. Connect to the internet or pass --ip.',
    );
    process.exit(1);
  }
}
console.log(`IP address stored in the license: ${ip}`);

const payload = buildPayload({
  name,
  years,
  id: randomUUID(),
  now: new Date(),
  issuer: 'license-sign',
  ip,
});
const bytes = payloadBytes(payload);
const container = encodeContainer(bytes, new Uint8Array(sign(null, bytes, key)));

// A plain card: Smaran's warm dark background with its three dots. The license is in the pixels.
const width = 1200;
const height = 720;
const rgba = new Uint8Array(width * height * 4);
const dots = [
  [520, 360, 46, [245, 244, 239]],
  [640, 330, 46, [139, 141, 248]],
  [700, 420, 46, [252, 196, 25]],
];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const t = (x + y) / (width + height);
    let c = [38 + 12 * t, 38 + 6 * t, 36 + 2 * t];
    for (const [cx, cy, r, col] of dots) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) c = col;
    rgba[i] = c[0];
    rgba[i + 1] = c[1];
    rgba[i + 2] = c[2];
    rgba[i + 3] = 255;
  }
}
embedBits(rgba, container);
const png = encodePng({ width, height, rgba }, (d) => deflateSync(d, { level: 9 }));

const safe = payload.name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'license';
const out = resolve(arg('out') || `Smaran-License-${safe}.png`);
fs.writeFileSync(out, png);
console.log(
  `License for ${payload.name}, ${payload.years} year(s), until ${payload.expires.slice(0, 10)}`,
);
console.log(`ID ${payload.id}`);
console.log(`Saved ${out}`);
