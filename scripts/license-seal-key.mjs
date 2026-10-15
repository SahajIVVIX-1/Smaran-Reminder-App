// Locks the license signing key with a passphrase so the /Register page can sign from any browser.
//
//   npm run license:seal-key
//
// Reads %USERPROFILE%\.smaran-license\private-key.json, asks for a passphrase twice (hidden), and
// writes site/Register/key.enc.json: the key encrypted with AES-256-GCM under a key derived from
// the passphrase (PBKDF2-SHA256, 600,000 iterations). The plain key never goes into site/ or git.
//
// key.enc.json is published with the website, so anyone can download it and try passphrases on
// their own computer. Use a long passphrase nobody could guess (four or more random words), and
// run this again with a new passphrase whenever someone who knew it should no longer issue
// licenses. Existing licenses stay valid: the key itself doesn't change.

import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ITERATIONS = 600_000;
const MIN_LENGTH = 12;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyDir = process.env.SMARAN_LICENSE_KEY_DIR || join(homedir(), '.smaran-license');
const keyFile = join(keyDir, 'private-key.json');
const outFile = join(root, 'site', 'Register', 'key.enc.json');

/** Reads a line without echoing what is typed. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let asked = false;
    rl._writeToOutput = (text) => {
      if (!asked) {
        process.stdout.write(text);
        asked = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

if (!process.stdin.isTTY) {
  console.error('Run this in a terminal: it asks for the passphrase without showing it.');
  process.exit(1);
}
if (!fs.existsSync(keyFile)) {
  console.error(`No private key at ${keyFile}. Run: npm run license:keygen`);
  process.exit(1);
}
const jwk = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.d || !jwk.x) {
  console.error(`${keyFile} is not an Ed25519 private key.`);
  process.exit(1);
}

const pass = await askHidden(`Passphrase (at least ${MIN_LENGTH} characters, not shown): `);
if (pass.length < MIN_LENGTH) {
  console.error(
    `Too short. Use at least ${MIN_LENGTH} characters; four or more random words is best.`,
  );
  process.exit(1);
}
const again = await askHidden('Type it again: ');
if (again !== pass) {
  console.error('The two passphrases are different. Nothing was written.');
  process.exit(1);
}

const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(pass.normalize('NFC'), salt, ITERATIONS, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const plain = Buffer.from(
  JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: jwk.x, d: jwk.d }),
  'utf8',
);
// WebCrypto's AES-GCM expects the 16-byte tag after the ciphertext.
const ct = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
plain.fill(0);
key.fill(0);

const sealed = {
  v: 1,
  kdf: 'PBKDF2-SHA256',
  iter: ITERATIONS,
  cipher: 'AES-256-GCM',
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  ct: ct.toString('base64'),
  /** The public key, so the page can tell a stale file from a wrong passphrase. */
  x: jwk.x,
};
fs.writeFileSync(outFile, `${JSON.stringify(sealed, null, 2)}\n`, 'utf8');
console.log(`Locked key written to ${outFile}`);
console.log('Commit it and publish the site; /Register will then ask for this passphrase.');
