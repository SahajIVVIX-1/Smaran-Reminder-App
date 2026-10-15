// Bundles src/shared/license/core.ts (the license format the app reads) for the two places that
// write licenses: the /Register page and scripts/license-sign.mjs. Run after changing core.ts:
//
//   npm run license:core

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const common = {
  entryPoints: [join(root, 'src', 'shared', 'license', 'core.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  legalComments: 'none',
  banner: { js: '// Generated from src/shared/license/core.ts by scripts/build-license-core.mjs.' },
};
await build({ ...common, outfile: join(root, 'site', 'Register', 'license-core.js') });
await build({ ...common, outfile: join(root, 'scripts', 'license-core.mjs'), platform: 'node' });
console.log('Bundled the license core for the Register page and the signing script.');
