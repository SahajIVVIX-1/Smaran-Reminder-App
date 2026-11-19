// Creates release/<version>/installer and release/<version>/portable before electron-builder runs.
// NSIS will not create a missing output folder, so the artifactName subfolders must exist up front.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

for (const kind of ['installer', 'portable']) {
  const dir = join(root, 'release', version, kind);
  mkdirSync(dir, { recursive: true });
  try {
    for (const f of readdirSync(dir)) {
      rmSync(join(dir, f), { force: true });
    }
  } catch {
    // ignore
  }
}
console.log(`Prepared release/${version}/{installer,portable}`);

// Bundle HFS engine into resources/engine.tar.gz for self-contained, lightning-fast distribution
const targetArchive = join(root, 'resources', 'engine.tar.gz');
const targetEngineDir = join(root, 'resources', 'engine', 'dist');

if (!existsSync(targetArchive) && existsSync(targetEngineDir)) {
  console.log(`Packaging engine archive ${targetArchive} from ${targetEngineDir}...`);
  try {
    const { execFileSync } = await import('node:child_process');
    execFileSync('tar.exe', ['-czf', targetArchive, '-C', targetEngineDir, '.'], {
      windowsHide: true,
    });
    console.log(`Packed ${targetArchive}`);
  } catch (err) {
    console.warn(`Failed to package engine archive: ${err.message}`);
  }
}

if (existsSync(targetArchive)) {
  console.log(`Self-contained HFS engine archive verified at ${targetArchive}`);
} else {
  console.warn(`Warning: Engine archive ${targetArchive} not found!`);
}



