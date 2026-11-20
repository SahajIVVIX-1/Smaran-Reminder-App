// Creates release/<version>/installer and release/<version>/portable before electron-builder runs.
// NSIS will not create a missing output folder, so the artifactName subfolders must exist up front.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

// Bundle and strictly verify HFS engine into resources/engine.tar.gz
const targetArchive = join(root, 'resources', 'engine.tar.gz');
const targetEngineDir = join(root, 'resources', 'engine', 'dist');

if (existsSync(targetEngineDir)) {
  console.log(`Packaging engine archive ${targetArchive} from ${targetEngineDir}...`);
  try {
    if (existsSync(targetArchive)) {
      rmSync(targetArchive, { force: true });
    }
    execFileSync('tar.exe', ['-czf', targetArchive, '-C', targetEngineDir, '.'], {
      windowsHide: true,
    });
    console.log(`Packed ${targetArchive}`);
  } catch (err) {
    console.error(`FATAL: Failed to package engine archive: ${err.message}`);
    process.exit(1);
  }
}

// Strict archive integrity verification
if (!existsSync(targetArchive)) {
  console.error(`FATAL: Required HFS engine archive missing at ${targetArchive}`);
  process.exit(1);
}

const archiveStat = statSync(targetArchive);
if (archiveStat.size < 1_000_000) {
  console.error(`FATAL: HFS engine archive is incomplete or truncated (${archiveStat.size} bytes)`);
  process.exit(1);
}

try {
  const list = execFileSync('tar.exe', ['-ztf', targetArchive], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  const lines = list.split(/\r?\n/).map((l) => l.trim().replace(/^\.\//, ''));
  const required = ['src/index.js', 'package.json', 'central.json'];
  for (const req of required) {
    if (!lines.includes(req)) {
      console.error(`FATAL: Engine archive is missing required root entry point: ${req}`);
      process.exit(1);
    }
  }
  if (lines.some((l) => l.startsWith('dist/src/index.js'))) {
    console.error(`FATAL: Engine archive has invalid 'dist/' prefix! Must be packed from root.`);
    process.exit(1);
  }
  console.log(
    `[PASS] Self-contained HFS engine archive verified (${(archiveStat.size / (1024 * 1024)).toFixed(2)} MB, all root entry points valid).`,
  );
} catch (err) {
  console.error(`FATAL: Failed to inspect engine archive integrity: ${err.message}`);
  process.exit(1);
}

// Execute real packaged HFS engine automated smoke test
console.log('Running automated HFS engine smoke test validation...');
try {
  execFileSync(process.execPath, [join(root, 'scripts', 'test-hfs-smoke.mjs')], {
    stdio: 'inherit',
    windowsHide: true,
  });
} catch (err) {
  console.error(`FATAL: Packaged HFS engine smoke test failed: ${err.message}. Aborting release build.`);
  process.exit(1);
}
