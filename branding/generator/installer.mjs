// Installer artwork from the app icon (resources/icon.png): the side panel on the welcome and
// finish pages (164 x 314) and the header on the other pages (150 x 57), as 24-bit BMPs for NSIS.
// Run: node installer.mjs && npx electron render.cjs installer-jobs.json
import { readFileSync, writeFileSync } from 'node:fs';

const icon = readFileSync('../../resources/icon.png').toString('base64');
const font = readFileSync('../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2').toString('base64');
const head = `<head><meta charset="utf-8"><style>@font-face{font-family:S;src:url(data:font/woff2;base64,${font});font-weight:200 900}
html,body{margin:0}body{font-family:S,Georgia,serif;-webkit-font-smoothing:antialiased}</style></head>`;

const sidebar = `<html>${head}<body style="width:164px;height:314px;background:#F5F4EF;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
<img src="data:image/png;base64,${icon}" width="96" height="96">
<div style="font-size:26px;font-weight:600;color:#1F1E1D;letter-spacing:-0.3px">Smaran</div>
<div style="font-size:12.5px;font-style:italic;color:#6B6A63;text-align:center;line-height:1.35">Gentle reminders,<br>on your schedule.</div>
</body></html>`;
const header = `<html>${head}<body style="width:150px;height:57px;background:#FFFFFF;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-right:12px;box-sizing:border-box">
<div style="font-size:19px;font-weight:600;color:#1F1E1D">Smaran</div>
<img src="data:image/png;base64,${icon}" width="38" height="38">
</body></html>`;

writeFileSync('.cache/sidebar.html', sidebar);
writeFileSync('.cache/header.html', header);
writeFileSync(
  'installer-jobs.json',
  JSON.stringify([
    { html: '.cache/sidebar.html', w: 164, h: 314, out: '../../build/installerSidebar.bmp', bmp: true },
    { html: '.cache/header.html', w: 150, h: 57, out: '../../build/installerHeader.bmp', bmp: true },
    { html: '.cache/sidebar.html', w: 164, h: 314, out: '.cache/sidebar-preview.png' },
    { html: '.cache/header.html', w: 150, h: 57, out: '.cache/header-preview.png' },
  ]),
);
