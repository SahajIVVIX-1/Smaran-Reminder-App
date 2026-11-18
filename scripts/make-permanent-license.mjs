// Generates a permanent 100-year Smaran license with a premium, high-fidelity UI card image.
import { randomUUID, createPrivateKey, sign } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { execSync } from 'node:child_process';
import {
  buildPayload,
  embedBits,
  encodeContainer,
  encodePng,
  decodePng,
  containerFromImage,
  decodeContainer,
  checkPayload,
  payloadBytes,
} from './license-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = path.join(path.dirname(__filename), '..');

// Load private key
const keyPath = path.join(root, '.smaran-license', 'private-key.json');
if (!fs.existsSync(keyPath)) {
  console.error(`Private key not found at ${keyPath}`);
  process.exit(1);
}

const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
const privateKey = createPrivateKey({ key: keyData, format: 'jwk' });

const name = 'Sahaj';
const years = 100;
const now = new Date();
const id = randomUUID();
const ip = '127.0.0.1';

const payload = buildPayload({
  name,
  years,
  id,
  now,
  issuer: 'Smaran Lifetime Authority',
  ip,
});

const pBytes = payloadBytes(payload);
const signature = new Uint8Array(sign(null, pBytes, privateKey));
const container = encodeContainer(pBytes, signature);

const tempHtml = path.join(root, 'temp-card.html');
const tempPng = path.join(root, 'temp-card.png');
const outLicense = path.join(root, 'Smaran-Permanent-License.png');

const issuedStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const expiresStr = 'November 2126 (Perpetual)';

const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 720px;
    background: #0d0d0c;
    color: #f5f4ef;
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card-container {
    position: relative;
    width: 1140px;
    height: 660px;
    border-radius: 32px;
    background: radial-gradient(circle at 85% 15%, rgba(217, 119, 87, 0.22), transparent 50%),
                radial-gradient(circle at 15% 85%, rgba(91, 91, 214, 0.20), transparent 50%),
                linear-gradient(135deg, #222120 0%, #181716 50%, #100f0e 100%);
    box-shadow: 0 35px 80px rgba(0, 0, 0, 0.85);
    padding: 52px 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    border: 3.5px solid transparent;
    background-clip: padding-box;
  }
  /* Continuous neon perimeter border */
  .neon-border {
    position: absolute;
    inset: -3.5px;
    border-radius: 32px;
    padding: 3.5px;
    background: linear-gradient(135deg, #8b8df8, #4285f4 25%, #34a853 50%, #fbbc05 75%, #ea4335 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    box-shadow: 0 0 30px rgba(139, 141, 248, 0.35);
  }
  .inner-border {
    position: absolute;
    inset: 12px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    pointer-events: none;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 2;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .dots-logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }
  .dot-1 { background: #f5f4ef; box-shadow: 0 0 14px rgba(245, 244, 239, 0.8); }
  .dot-2 { background: #8b8df8; box-shadow: 0 0 14px rgba(139, 141, 248, 0.8); transform: translateY(-4px); }
  .dot-3 { background: #fcc419; box-shadow: 0 0 14px rgba(252, 196, 25, 0.8); transform: translateY(4px); }
  .brand-name {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 42px;
    font-weight: 700;
    font-style: italic;
    color: #f5f4ef;
    letter-spacing: -0.5px;
  }
  .badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 999px;
    background: rgba(252, 196, 25, 0.12);
    border: 1.5px solid rgba(252, 196, 25, 0.5);
    color: #fcc419;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    box-shadow: 0 0 16px rgba(252, 196, 25, 0.15);
  }
  .body {
    z-index: 2;
  }
  .licensed-label {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: #9c9991;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .licensee-name {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 68px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.1;
    letter-spacing: -0.5px;
  }
  .edition-subtitle {
    margin-top: 6px;
    font-size: 18px;
    color: #d97757;
    font-weight: 500;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-top: 36px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .grid-item .label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1px;
    color: #8c8982;
    text-transform: uppercase;
  }
  .grid-item .value {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 600;
    color: #f5f4ef;
    margin-top: 4px;
  }
  .footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 2;
  }
  .meta-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .meta-left .key-id {
    font-family: Consolas, "Lucida Console", monospace;
    font-size: 12px;
    color: #6b6862;
  }
  .meta-left .crypto {
    font-size: 13px;
    color: #8c8982;
  }
  .meta-left .motto {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 15px;
    font-style: italic;
    color: #b5b2aa;
    margin-top: 4px;
  }
  .seal {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-radius: 12px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.35);
  }
  .seal-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 10px #22c55e;
  }
  .seal-text {
    font-size: 13px;
    font-weight: 700;
    color: #86efac;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
</style>
</head>
<body>
  <div class="card-container">
    <div class="neon-border"></div>
    <div class="inner-border"></div>

    <div class="header">
      <div class="brand">
        <div class="dots-logo">
          <div class="dot dot-1"></div>
          <div class="dot dot-2"></div>
          <div class="dot dot-3"></div>
        </div>
        <div class="brand-name">Smaran</div>
      </div>
      <div class="badge">
        <span>★</span>
        <span>Lifetime Official License</span>
      </div>
    </div>

    <div class="body">
      <div class="licensed-label">Licensed To</div>
      <div class="licensee-name">${name}</div>
      <div class="edition-subtitle">VIP Permanent License · Unlimited Offline Desktop Access</div>

      <div class="grid">
        <div class="grid-item">
          <div class="label">Edition</div>
          <div class="value">Lifetime 3.0</div>
        </div>
        <div class="grid-item">
          <div class="label">Duration</div>
          <div class="value">100 Years</div>
        </div>
        <div class="grid-item">
          <div class="label">Issued</div>
          <div class="value">${issuedStr}</div>
        </div>
        <div class="grid-item">
          <div class="label">Expires</div>
          <div class="value">${expiresStr}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="meta-left">
        <div class="key-id">ID: ${id}</div>
        <div class="crypto">Cryptography: Ed25519 Elliptic-Curve Signature · Offline Verified</div>
        <div class="motto">Gentle reminders, on your schedule.</div>
      </div>
      <div class="seal">
        <div class="seal-dot"></div>
        <div class="seal-text">Cryptographically Sealed</div>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(tempHtml, htmlContent, 'utf8');

console.log('Rendering high-resolution UI card using headless Edge...');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
execSync(
  `"${edgePath}" --headless --disable-gpu "--screenshot=${tempPng}" --window-size=1200,720 "${tempHtml}"`,
  { stdio: 'inherit' },
);

if (!fs.existsSync(tempPng)) {
  console.error('Failed to capture card screenshot.');
  process.exit(1);
}

const renderedPngBytes = fs.readFileSync(tempPng);
const decoded = decodePng(renderedPngBytes, inflateSync);
console.log(`Card rendered at ${decoded.width}x${decoded.height}`);

// Embed steganographic license bits into pixel LSBs
embedBits(decoded.rgba, container);

// Re-encode PNG
const finalPngBytes = encodePng(
  { width: decoded.width, height: decoded.height, rgba: decoded.rgba },
  (d) => deflateSync(d, { level: 9 }),
);

fs.writeFileSync(outLicense, finalPngBytes);

// Cleanup temp files
try {
  fs.unlinkSync(tempHtml);
  fs.unlinkSync(tempPng);
} catch {
  // best effort cleanup
}

console.log('\n======================================================');
console.log('🎉 Permanent License Generated Successfully!');
console.log(`File: ${outLicense}`);
console.log(`Licensee: ${payload.name}`);
console.log(`Duration: ${payload.years} years (Expires: ${payload.expires})`);
console.log(`ID: ${payload.id}`);
console.log('======================================================\n');

// Self-verify
const readContainer = containerFromImage(finalPngBytes, inflateSync);
const verifiedDecoded = decodeContainer(readContainer, 'ETy6dgHw3Qhi1XK2ihXl6buklNrdfnzWLbjtjzyrNjg');
const verifyStatus = checkPayload(verifiedDecoded.payload, new Date());
console.log(`Verification Check: STATUS = ${verifyStatus} (Valid Ed25519 Signature)`);
