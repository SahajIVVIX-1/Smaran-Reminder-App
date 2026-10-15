// Makes a Smaran license image in the browser: payload → Ed25519 signature (WebCrypto, with the
// private key file the user picks; nothing is uploaded) → hidden in a PNG's pixels.
import {
  buildPayload,
  embedBits,
  encodeContainer,
  extractBits,
  decodeContainer,
  jpegWithLicense,
  payloadBytes,
} from './license-core.js';

/** The public key bundled in the app (src/shared/license/publicKey.ts). */
const APP_PUBLIC_KEY = 'ETy6dgHw3Qhi1XK2ihXl6buklNrdfnzWLbjtjzyrNjg';

const $ = (id) => document.getElementById(id);
const form = $('form');
const message = $('message');

function say(text, tone = '') {
  message.textContent = text;
  message.className = `message ${tone}`;
}

async function readKey(file) {
  let jwk;
  try {
    jwk = JSON.parse(await file.text());
  } catch {
    throw new Error('That key file isn’t valid JSON. Choose private-key.json.');
  }
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.d || !jwk.x)
    throw new Error('That file isn’t a Smaran signing key (Ed25519 private key).');
  if (jwk.x !== APP_PUBLIC_KEY)
    throw new Error(
      'This key doesn’t match the one built into Smaran, so the app would reject its licenses.',
    );
  if (!crypto.subtle)
    throw new Error('This browser can’t sign here. Use scripts/license-sign.mjs.');
  try {
    const sign = await crypto.subtle.importKey(
      'jwk',
      { kty: 'OKP', crv: 'Ed25519', x: jwk.x, d: jwk.d },
      { name: 'Ed25519' },
      false,
      ['sign'],
    );
    const verify = await crypto.subtle.importKey(
      'jwk',
      { kty: 'OKP', crv: 'Ed25519', x: jwk.x },
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return { sign, verify };
  } catch {
    throw new Error(
      'This browser doesn’t support Ed25519 signing. Use a current Chrome, Edge or Firefox, or scripts/license-sign.mjs.',
    );
  }
}

async function publicIp() {
  const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
  if (!res.ok) throw new Error('lookup failed');
  const { ip } = await res.json();
  return typeof ip === 'string' && ip.length <= 64 ? ip : undefined;
}

const longDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** The visible card: Smaran's warm dark look, the S mark, and the license details. */
function drawCard(ctx, p) {
  const { width: w, height: h } = ctx.canvas;
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#2b2b29');
  bg.addColorStop(1, '#1f1e1d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, w * 0.6);
  glow.addColorStop(0, 'rgba(217,119,87,0.28)');
  glow.addColorStop(1, 'rgba(217,119,87,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // The colour light round the border.
  const ring = ctx.createLinearGradient(0, 0, w, 0);
  ['#4285f4', '#ea4335', '#fbbc05', '#34a853'].forEach((c, i) => ring.addColorStop(i / 3, c));
  ctx.strokeStyle = ring;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(28, 28, w - 56, h - 56, 36);
  ctx.stroke();

  // The S mark: two arcs and a dot (64-unit box, scaled).
  const s = 2.2;
  const ox = 90;
  const oy = 80;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#f5f4ef';
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.arc(ox + 32 * s, oy + 22 * s, 10 * s, (-30 * Math.PI) / 180, (-270 * Math.PI) / 180, true);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ox + 32 * s, oy + 42 * s, 10 * s, (-90 * Math.PI) / 180, (150 * Math.PI) / 180);
  ctx.stroke();
  ctx.fillStyle = '#8b8df8';
  ctx.beginPath();
  ctx.arc(
    ox + (32 + 25 * Math.cos(-Math.PI / 4)) * s,
    oy + (32 + 25 * Math.sin(-Math.PI / 4)) * s,
    5 * s,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const serif = "'Source Serif 4 Variable', Georgia, serif";
  const sans = "'Inter Variable', 'Segoe UI', sans-serif";
  const mono = "'JetBrains Mono Variable', Consolas, monospace";
  ctx.fillStyle = '#f5f4ef';
  ctx.font = `italic 500 64px ${serif}`;
  ctx.fillText('Smaran', 260, 160);
  ctx.fillStyle = '#d97757';
  ctx.font = `600 22px ${sans}`;
  ctx.fillText('LICENSE', 264, 200);

  ctx.fillStyle = '#a6a39a';
  ctx.font = `20px ${sans}`;
  ctx.fillText('Licensed to', 96, 330);
  ctx.fillStyle = '#f5f4ef';
  let size = 58;
  ctx.font = `600 ${size}px ${serif}`;
  while (ctx.measureText(p.name).width > w - 200 && size > 24) {
    size -= 2;
    ctx.font = `600 ${size}px ${serif}`;
  }
  ctx.fillText(p.name, 96, 400);

  const rows = [
    ['Duration', `${p.years} year${p.years === 1 ? '' : 's'}`],
    ['Issued', longDate(p.issued)],
    ['Expires', longDate(p.expires)],
  ];
  rows.forEach(([k, v], i) => {
    const x = 96 + i * 340;
    ctx.fillStyle = '#a6a39a';
    ctx.font = `18px ${sans}`;
    ctx.fillText(k, x, 490);
    ctx.fillStyle = '#f5f4ef';
    ctx.font = `600 28px ${serif}`;
    ctx.fillText(v, x, 530);
  });
  ctx.fillStyle = '#75736c';
  ctx.font = `16px ${mono}`;
  ctx.fillText(`ID ${p.id}`, 96, 640);
  ctx.font = `italic 18px ${serif}`;
  ctx.fillText('Gentle reminders, on your schedule.', 96, 675);
}

const blobOf = (canvas, type, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not make the image.'))),
      type,
      quality,
    ),
  );

let urls = [];

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('make');
  button.disabled = true;
  say('Signing…');
  try {
    const name = $('name').value;
    const years = Number($('years').value);
    const file = $('key').files?.[0];
    if (!file) throw new Error('Choose your private-key.json signing key.');
    const keys = await readKey(file);
    let ip;
    if ($('ip').checked) {
      try {
        ip = await publicIp();
      } catch {
        throw new Error(
          'Couldn’t look up the IP address. Untick the box to make the license without it.',
        );
      }
    }
    const payload = buildPayload({
      name,
      years,
      id: crypto.randomUUID(),
      now: new Date(),
      issuer: 'Smaran Register',
      ip,
    });
    const bytes = payloadBytes(payload);
    const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', keys.sign, bytes));
    const container = encodeContainer(bytes, signature);

    const canvas = $('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await document.fonts.ready;
    drawCard(ctx, payload);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    embedBits(image.data, container);
    ctx.putImageData(image, 0, 0);

    // Check the round trip before handing it over: read it back and verify the signature.
    const back = decodeContainer(
      extractBits(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
    );
    const ok = await crypto.subtle.verify(
      'Ed25519',
      keys.verify,
      back.signature,
      back.payloadBytes,
    );
    if (!ok || back.payload.id !== payload.id)
      throw new Error('The license didn’t read back correctly. Try again.');

    const png = await blobOf(canvas, 'image/png');
    const jpegBytes = new Uint8Array(
      await (await blobOf(canvas, 'image/jpeg', 0.95)).arrayBuffer(),
    );
    const jpg = new Blob([jpegWithLicense(jpegBytes, container)], { type: 'image/jpeg' });

    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [URL.createObjectURL(png), URL.createObjectURL(jpg)];
    const safe = payload.name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'license';
    $('preview').src = urls[0];
    $('png').href = urls[0];
    $('png').download = `Smaran-License-${safe}.png`;
    $('jpg').href = urls[1];
    $('jpg').download = `Smaran-License-${safe}.jpg`;
    const dl = $('details');
    dl.replaceChildren();
    for (const [k, v] of [
      ['Name', payload.name],
      ['License ID', payload.id],
      ['Product', payload.product],
      ['Duration', `${payload.years} year(s)`],
      ['Issued', longDate(payload.issued)],
      ['Expires', longDate(payload.expires)],
      ['IP address', payload.ip ?? 'Not included'],
    ]) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    }
    $('result').hidden = false;
    say('License created and checked. Download the PNG.', 'ok');
  } catch (error) {
    say(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    button.disabled = false;
    $('key').value = ''; // don't keep the key selected
  }
});
