// The still Smaran mark: the three dots settled into the "S" with its reminder dot, taken from
// the same engine the app animates (src/shared/dots). Drawn in the engine's 64 x 64 box.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
mkdirSync('.cache', { recursive: true });
writeFileSync(
  '.cache/entry.ts',
  "export * from '../../../src/shared/dots/dotsEngine';\nexport * from '../../../src/shared/dots/dotsScenes';\nexport { N } from '../../../src/shared/dots/dotsGeometry';\n",
);
buildSync({ entryPoints: ['.cache/entry.ts'], bundle: true, format: 'cjs', platform: 'node', outfile: '.cache/dots.cjs', logLevel: 'error' });
const { DotsEngine, getScene, N } = require('./.cache/dots.cjs');

// Let the dots settle into the S.
const engine = new DotsEngine(getScene('s-mark'));
for (let i = 0; i < 60 * 4; i++) engine.step(1 / 60);
const strokes = [0, 1, 2].map((s) => {
  const pts = [];
  for (let k = 0; k < N; k++) pts.push([engine.pos[(s * N + k) * 2], engine.pos[(s * N + k) * 2 + 1]]);
  const spread = Math.hypot(pts[0][0] - pts[N - 1][0], pts[0][1] - pts[N - 1][1]);
  return { pts, width: engine.width[s], dot: spread < 0.5 };
});

/** S line and reminder dot colours. light/dark: for light or dark backgrounds; app: the .exe icon. */
export const PALETTES = {
  light: { line: '#1f1e1d', dot: '#5b5bd6' },
  dark: { line: '#f5f4ef', dot: '#8b8df8' },
  app: { line: '#5b5bd6', dot: '#f59f00' },
};

/** Small icons zoom in a little and thicken the lines so they stay legible (as the tray does). */
export const ZOOM = 1.12;
export function boostFor(px) {
  return px <= 20 ? 1.6 : px <= 32 ? 1.35 : px <= 64 ? 1.15 : 1.1;
}

const f = (n) => +n.toFixed(2);
function paths(colors, boost, cls) {
  return strokes
    .map((s) => {
      const d = s.dot
        ? `M${f(s.pts[0][0])} ${f(s.pts[0][1])}h0.01`
        : s.pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');
      const color = colors ? (s.dot ? colors.dot : colors.line) : "";
      const paint = cls ? `class="${s.dot ? cls.dot : cls.line}"` : `stroke="${color}"`;
      return `<path d="${d}" fill="none" ${paint} stroke-width="${f(s.width * boost)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
}

/** The mark inside a 64 x 64 viewBox, zoomed about the centre. */
export function markInner(mode = 'light', px = 512) {
  return `<g transform="translate(32 32) scale(${ZOOM}) translate(-32 -32)">${paths(PALETTES[mode], boostFor(px))}</g>`;
}

/** Switches the line colour with prefers-color-scheme. */
export function markAdaptive(px = 512) {
  const css =
    `.ml{stroke:${PALETTES.light.line}}.md{stroke:${PALETTES.light.dot}}` +
    `@media (prefers-color-scheme:dark){.ml{stroke:${PALETTES.dark.line}}.md{stroke:${PALETTES.dark.dot}}}`;
  return `<style>${css}</style><g transform="translate(32 32) scale(${ZOOM}) translate(-32 -32)">${paths(null, boostFor(px), { line: 'ml', dot: 'md' })}</g>`;
}

export const markSvg = (mode, px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64">${markInner(mode, px)}</svg>`;
