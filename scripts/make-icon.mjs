// Copies the designed icons from branding/ into the places the app and installer read them from.
// To change the design, edit branding/generator and rebuild the kit first (see branding/README.md).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(root, 'branding');
const copies = [
  ['app-icon/app-icon.ico', 'build/icon.ico'],
  ['app-icon/png/app-icon-256.png', 'resources/icon.png'],
  ['tray/tray-light.ico', 'resources/tray/tray-light.ico'],
  ['tray/tray-dark.ico', 'resources/tray/tray-dark.ico'],
];
for (const [from, to] of copies) {
  mkdirSync(dirname(join(root, to)), { recursive: true });
  copyFileSync(join(brand, from), join(root, to));
  console.log(`${from} -> ${to}`);
}
