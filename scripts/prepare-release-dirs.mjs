// Creates release/<version>/installer and release/<version>/portable before electron-builder runs.
// NSIS will not create a missing output folder, so the artifactName subfolders must exist up front.
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

for (const kind of ['installer', 'portable']) {
  mkdirSync(join(root, 'release', version, kind), { recursive: true });
}
console.log(`Prepared release/${version}/{installer,portable}`);

// Bundle HFS engine into resources/engine/dist for self-contained distribution
const hfsDistDir = 'D:\\03_Projects\\hfs-3.4.1\\dist';
const targetEngineDir = join(root, 'resources', 'engine', 'dist');

if (existsSync(hfsDistDir)) {
  console.log(`Bundling Smaran HFS engine from ${hfsDistDir} to ${targetEngineDir}...`);
  mkdirSync(targetEngineDir, { recursive: true });
  cpSync(hfsDistDir, targetEngineDir, { recursive: true });
  console.log('Smaran HFS engine bundled into resources/engine/dist.');
} else {
  console.warn(`[WARN] HFS dist not found at ${hfsDistDir}; skipping resource bundle.`);
}

