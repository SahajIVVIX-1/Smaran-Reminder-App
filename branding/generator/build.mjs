// Builds the Smaran brand kit into ../ (svg, logo, tray, app-icon, previews). Run: node build.mjs, then render.
import { mkdirSync, writeFileSync } from 'node:fs';
import { f } from './geo.mjs';
import { GRID, parts, symbolSvg } from './symbol.mjs';
import { tileSvg, TILE_GRID } from './tile.mjs';
import { W as WM_W, wordmark } from './wordmark.mjs';

export const C = { accent: '#C96442', ink: '#1F1E1D', paper: '#F5F4EF', white: '#FFFFFF', trayInk: '#1A1A1A' };
const OUT = '..';
for (const d of ['svg', 'logo', 'tray', 'app-icon', 'previews']) mkdirSync(`${OUT}/${d}`, { recursive: true });
const jobs = [];
const svgOut = (path, svg) => writeFileSync(`${OUT}/${path}`, svg + '\n');
const png = (svgPath, w, h, out) => jobs.push({ svg: `${OUT}/${svgPath}`, w, h, out: `${OUT}/${out}` });

// ---- symbol (24 px master grid) ----
const m = parts(24);
const symbolInner = (inkAttr) =>
  `<path ${inkAttr} d="${m.d}" fill="none" stroke-width="${m.w}" stroke-linecap="round"/>` +
  `<circle cx="${m.badge[0]}" cy="${m.badge[1]}" r="${m.badge[2]}" fill="${C.accent}"/>`;
const adaptiveStyle = (cls = 'ink') =>
  `<style>.${cls}{stroke:${C.ink}}.${cls}-fill{fill:${C.ink}}@media (prefers-color-scheme:dark){.${cls}{stroke:${C.paper}}.${cls}-fill{fill:${C.paper}}}</style>`;
const sym = (ink, size = 24) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${symbolInner(`stroke="${ink}"`)}</svg>`;
svgOut('svg/symbol-light.svg', sym(C.ink));
svgOut('svg/symbol-dark.svg', sym(C.paper));
svgOut('svg/symbol-adaptive.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${adaptiveStyle()}${symbolInner('class="ink"')}</svg>`);
svgOut('svg/symbol-currentcolor.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${symbolInner('stroke="currentColor"')}</svg>`);
for (const [name, ink] of [['light', C.ink], ['dark', C.paper]])
  for (const s of [64, 128, 256, 512]) png(`svg/symbol-${name}.svg`, s, s, `logo/symbol-${name}-${s}.png`);

// ---- lockups ----
const wm = wordmark();
const k = 35 / 21; // the symbol's S stands a little taller than the wordmark's capital S
const symX = 0, symY = 20 - 22 * k; // S bottom on the baseline
const gap = 9;
const wmX = 22 * k + gap;
const lockupInner = (inkAttr) =>
  `<g transform="translate(${symX} ${f(symY)}) scale(${f(k)})">${symbolInner(inkAttr)}</g>` +
  `<path ${inkAttr} transform="translate(${f(wmX)} 0)" d="${wm.d}" fill="none" stroke-width="${WM_W}" stroke-linecap="round" stroke-linejoin="round"/>`;
const pad = 4;
const hx = -pad, hy = f(symY + k - pad), hw = f(wmX + wm.width + 2 * pad), hh = f(20 - (symY + k) + 2 * pad);
const horiz = (inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${f(hw * 4)}" height="${f(hh * 4)}" viewBox="${hx} ${hy} ${hw} ${hh}">${extra}${inner}</svg>`;
svgOut('svg/logo-horizontal-light.svg', horiz(lockupInner(`stroke="${C.ink}"`)));
svgOut('svg/logo-horizontal-dark.svg', horiz(lockupInner(`stroke="${C.paper}"`)));
svgOut('svg/logo-horizontal-adaptive.svg', horiz(lockupInner('class="ink"'), adaptiveStyle()));
// Stacked: symbol above, wordmark centred below.
const sk = 2.6, symW = 24 * sk;
const stW = Math.max(symW, wm.width) + 2 * pad;
const stackInner = (inkAttr) =>
  `<g transform="translate(${f((stW - symW) / 2 - pad + 0.5 * sk)} 0) scale(${sk})">${symbolInner(inkAttr)}</g>` +
  `<path ${inkAttr} transform="translate(${f((stW - wm.width) / 2 - pad)} ${f(24 * sk + 14)})" d="${wm.d}" fill="none" stroke-width="${WM_W}" stroke-linecap="round" stroke-linejoin="round"/>`;
const stH = 24 * sk + 14 + 20 + 2 * pad;
const stack = (inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${f(stW * 4)}" height="${f(stH * 4)}" viewBox="${-pad} ${-pad} ${f(stW)} ${f(stH)}">${extra}${inner}</svg>`;
svgOut('svg/logo-stacked-light.svg', stack(stackInner(`stroke="${C.ink}"`)));
svgOut('svg/logo-stacked-dark.svg', stack(stackInner(`stroke="${C.paper}"`)));
svgOut('svg/logo-stacked-adaptive.svg', stack(stackInner('class="ink"'), adaptiveStyle()));
for (const name of ['light', 'dark']) {
  png(`svg/logo-horizontal-${name}.svg`, Math.round(hw * 8), Math.round(hh * 8), `logo/logo-horizontal-${name}.png`);
  png(`svg/logo-stacked-${name}.svg`, Math.round(stW * 6), Math.round(stH * 6), `logo/logo-stacked-${name}.png`);
}

// ---- tray: monochrome, pixel-tuned per size ----
const icoJobs = [];
mkdirSync(`${OUT}/tray/svg`, { recursive: true });
mkdirSync(`${OUT}/tray/png`, { recursive: true });
for (const [variant, ink] of [['light', C.trayInk], ['dark', C.white]]) {
  const pngs = [];
  for (const s of Object.keys(GRID).map(Number)) {
    svgOut(`tray/svg/tray-${variant}-${s}.svg`, symbolSvg(s, ink, ink));
    png(`tray/svg/tray-${variant}-${s}.svg`, s, s, `tray/png/tray-${variant}-${s}.png`);
    pngs.push(`${OUT}/tray/png/tray-${variant}-${s}.png`);
  }
  icoJobs.push({ ico: `${OUT}/tray/tray-${variant}.ico`, pngs: pngs.filter((p) => !p.endsWith('-40.png')) });
}

// ---- app icon ----
const look = { tile: C.accent, ink: C.white, dot: C.white };
svgOut('svg/app-icon.svg', tileSvg(1024, look));
png('svg/app-icon.svg', 1024, 1024, 'app-icon/app-icon-1024.png');
mkdirSync(`${OUT}/app-icon/png`, { recursive: true });
const appPngs = [];
for (const s of [16, 20, 24, 32, 40, 48, 64, 128, 256]) {
  if (TILE_GRID[s]) {
    svgOut(`svg/app-icon-${s}.svg`, tileSvg(s, look));
    png(`svg/app-icon-${s}.svg`, s, s, `app-icon/png/app-icon-${s}.png`);
  } else png('svg/app-icon.svg', s, s, `app-icon/png/app-icon-${s}.png`);
  appPngs.push(`${OUT}/app-icon/png/app-icon-${s}.png`);
}
icoJobs.push({ ico: `${OUT}/app-icon/app-icon.ico`, pngs: appPngs });
writeFileSync('jobs.json', JSON.stringify([...jobs, ...icoJobs]));
console.log(jobs.length, 'renders,', icoJobs.length, 'icons');
