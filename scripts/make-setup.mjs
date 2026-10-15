// Makes release/<version>/installer/Smaran-Setup-<version>.exe from the portable exe.
// They are the same file: started under a name containing "Setup", Smaran shows its install
// window and installs itself (see src/main/setup).
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version, productName } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const dir = join(root, 'release', version);

const portable = join(dir, 'portable', `${productName}-${version}-portable.exe`);
const setup = join(dir, 'installer', `${productName}-Setup-${version}.exe`);
mkdirSync(dirname(setup), { recursive: true });
copyFileSync(portable, setup);
console.log(`Made ${setup}`);
