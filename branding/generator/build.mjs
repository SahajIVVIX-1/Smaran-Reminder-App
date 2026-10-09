// Builds the Smaran brand kit into ../. Run from this folder:
//   npx electron render.cjs measure.json   (once, measures the wordmark)
//   node build.mjs && npx electron render.cjs jobs.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { markAdaptive, markInner, markSvg } from './dotsMark.mjs';

export const C = { accent: '#C96442', ink: '#1F1E1D', paper: '#F5F4EF' };
const FONT = '../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2';
const WORD = { text: 'Smaran', size: 100, weight: 600 };
const OUT = '..';

if (!existsSync('measure-out.json')) {
  writeFileSync('measure.json', JSON.stringify([{ measure: { font: FONT, ...WORD }, out: 'measure-out.json' }]));
  console.log('Run: npx electron render.cjs measure.json, then build again.');
  process.exit(0);
}
const M = JSON.parse(readFileSync('measure-out.json', 'utf8'));
for (const d of ['svg', 'logo', 'tray/png', 'tray/svg', 'app-icon/png', 'previews']) mkdirSync(`${OUT}/${d}`, { recursive: true });
const jobs = [];
const save = (path, svg) => writeFileSync(`${OUT}/${path}`, svg + '\n');
const png = (svg, w, h, out) => jobs.push({ svg: `${OUT}/${svg}`, w, h, out: `${OUT}/${out}` });
const fontFace = `@font-face{font-family:'Smaran Serif';src:url(data:font/woff2;base64,${readFileSync(FONT).toString('base64')});font-weight:200 900}`;
const textAttrs = `font-family="'Smaran Serif','Source Serif 4',Georgia,serif" font-size="${WORD.size}" font-weight="${WORD.weight}" letter-spacing="-1"`;
const inkStyle = `.ink{fill:${C.ink}}@media (prefers-color-scheme:dark){.ink{fill:${C.paper}}}`;

// ---- symbol ----
save('svg/symbol-light.svg', markSvg('light', 512));
save('svg/symbol-dark.svg', markSvg('dark', 512));
save('svg/symbol-adaptive.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">${markAdaptive()}</svg>`);
for (const mode of ['light', 'dark']) for (const s of [64, 128, 256, 512]) png(`svg/symbol-${mode}.svg`, s, s, `logo/symbol-${mode}-${s}.png`);

// ---- lockups: the wordmark is Source Serif 4 SemiBold, embedded so the SVG renders anywhere ----
const textW = M.width - 6; // letter-spacing -1 over six letters
const gap = 30, sym = 118; // symbol a little taller than the capitals
const capTop = 100 - M.ascent; // baseline at y = 100
const symY = capTop + M.ascent / 2 - sym / 2;
const hW = sym + gap + textW + 8, hTop = Math.min(symY, capTop) - 6, hH = Math.max(symY + sym, 100 + M.descent) - hTop + 6;
const horiz = (mode, adaptive) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(hW * 1.2)}" height="${Math.round(hH * 1.2)}" viewBox="-4 ${hTop.toFixed(1)} ${hW.toFixed(1)} ${hH.toFixed(1)}">` +
  `<style>${fontFace}${adaptive ? inkStyle : ''}</style>` +
  `<svg x="0" y="${symY.toFixed(1)}" width="${sym}" height="${sym}" viewBox="0 0 64 64">${adaptive ? markAdaptive() : markInner(mode)}</svg>` +
  `<text x="${sym + gap}" y="100" ${textAttrs} ${adaptive ? 'class="ink"' : `fill="${mode === 'light' ? C.ink : C.paper}"`}>Smaran</text></svg>`;
const sSym = 190, sW = Math.max(sSym, textW) + 40, sH = sSym + 34 + M.ascent + M.descent + 20;
const stacked = (mode, adaptive) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(sW)}" height="${Math.round(sH)}" viewBox="0 0 ${sW.toFixed(1)} ${sH.toFixed(1)}">` +
  `<style>${fontFace}${adaptive ? inkStyle : ''}</style>` +
  `<svg x="${((sW - sSym) / 2).toFixed(1)}" y="10" width="${sSym}" height="${sSym}" viewBox="0 0 64 64">${adaptive ? markAdaptive() : markInner(mode)}</svg>` +
  `<text x="${(sW / 2).toFixed(1)}" y="${(10 + sSym + 34 + M.ascent).toFixed(1)}" text-anchor="middle" ${textAttrs} ${adaptive ? 'class="ink"' : `fill="${mode === 'light' ? C.ink : C.paper}"`}>Smaran</text></svg>`;
for (const mode of ['light', 'dark']) {
  save(`svg/logo-horizontal-${mode}.svg`, horiz(mode, false));
  save(`svg/logo-stacked-${mode}.svg`, stacked(mode, false));
  png(`svg/logo-horizontal-${mode}.svg`, Math.round(hW * 3), Math.round(hH * 3), `logo/logo-horizontal-${mode}.png`);
  png(`svg/logo-stacked-${mode}.svg`, Math.round(sW * 2), Math.round(sH * 2), `logo/logo-stacked-${mode}.png`);
}
save('svg/logo-horizontal-adaptive.svg', horiz('light', true));
save('svg/logo-stacked-adaptive.svg', stacked('light', true));

// ---- tray: still fallback icons (the app animates them at run time); dark S on light taskbars ----
const ico = [];
for (const [variant, mode] of [['light', 'light'], ['dark', 'dark']]) {
  const files = [];
  for (const s of [16, 20, 24, 32, 40, 48]) {
    save(`tray/svg/tray-${variant}-${s}.svg`, markSvg(mode, s));
    png(`tray/svg/tray-${variant}-${s}.svg`, s, s, `tray/png/tray-${variant}-${s}.png`);
    if (s !== 40) files.push(`${OUT}/tray/png/tray-${variant}-${s}.png`);
  }
  ico.push({ ico: `${OUT}/tray/tray-${variant}.ico`, pngs: files });
}

// ---- app icon: the dots S in colour, no tile ----
save('svg/app-icon.svg', markSvg('app', 1024));
png('svg/app-icon.svg', 1024, 1024, 'app-icon/app-icon-1024.png');
const appFiles = [];
for (const s of [16, 20, 24, 32, 40, 48, 64, 128, 256]) {
  if (s <= 32) {
    save(`svg/app-icon-${s}.svg`, markSvg('app', s));
    png(`svg/app-icon-${s}.svg`, s, s, `app-icon/png/app-icon-${s}.png`);
  } else png('svg/app-icon.svg', s, s, `app-icon/png/app-icon-${s}.png`);
  appFiles.push(`${OUT}/app-icon/png/app-icon-${s}.png`);
}
ico.push({ ico: `${OUT}/app-icon/app-icon.ico`, pngs: appFiles });
writeFileSync('jobs.json', JSON.stringify([...jobs, ...ico]));
console.log(jobs.length, 'renders,', ico.length, 'icons');
