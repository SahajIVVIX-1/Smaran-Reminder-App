// Creates release/<version>/installer and release/<version>/portable before electron-builder runs.
// NSIS will not create a missing output folder, so the artifactName subfolders must exist up front.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

for (const kind of ['installer', 'portable']) {
  mkdirSync(join(root, 'release', version, kind), { recursive: true });
}
console.log(`Prepared release/${version}/{installer,portable}`);
