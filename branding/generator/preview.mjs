import { writeFileSync } from 'node:fs';
const img = (p, w, h = w, style = '') => `<img src="data:image/png;base64,%%../${p}%%" width="${w}" height="${h}" style="${style}">`;
const taskbar = (bg, fg, tray, app) => `
<div style="height:48px;background:${bg};display:flex;align-items:center;padding:0 14px;gap:14px;border-radius:8px;color:${fg};font:12px 'Segoe UI'">
  <div style="flex:1;display:flex;gap:10px;justify-content:center">${img(app, 24)}<span style="opacity:.0">.</span></div>
  <span style="opacity:.7">^</span>${img(`tray/png/tray-${tray}-16.png`, 16)}
  <span style="opacity:.8">ENG</span><div style="text-align:right;line-height:15px">10:30<br>09-10-2026</div>
</div>`;
const html = `<html><head><meta charset="utf-8"></head><body style="margin:0;width:1200px;height:1170px;background:#ECEAE4;font:13px 'Segoe UI';color:#3d3c38">
<div style="padding:28px 32px">
<div style="font-size:22px;font-weight:600;color:#1F1E1D;margin-bottom:4px">Smaran brand kit</div>
<div style="margin-bottom:22px;color:#6b6a63">Symbol: a geometric S with a reminder dot. One accent, #C96442.</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
  <div style="background:#FFFFFF;border-radius:14px;height:180px;display:flex;align-items:center;justify-content:center">${img('logo/logo-horizontal-light.png', 340, 'auto')}</div>
  <div style="background:#1F1F1F;border-radius:14px;height:180px;display:flex;align-items:center;justify-content:center">${img('logo/logo-horizontal-dark.png', 340, 'auto')}</div>
  <div style="background:#FFFFFF;border-radius:14px;height:230px;display:flex;align-items:center;justify-content:space-evenly">${img('logo/logo-stacked-light.png', 150, 'auto')}${img('logo/symbol-light-128.png', 96)}${img('tray/png/tray-light-48.png', 48)}</div>
  <div style="background:#1F1F1F;border-radius:14px;height:230px;display:flex;align-items:center;justify-content:space-evenly">${img('logo/logo-stacked-dark.png', 150, 'auto')}${img('logo/symbol-dark-128.png', 96)}${img('tray/png/tray-dark-48.png', 48)}</div>
</div>
<div style="margin:26px 0 10px;font-weight:600;color:#1F1E1D">Windows 11 taskbar (tray icon at 16 px, app icon at 24 px, actual size)</div>
${taskbar('#EEF0F3', '#1a1a1a', 'light', 'app-icon/png/app-icon-24.png')}
<div style="height:10px"></div>
${taskbar('#202020', '#ffffff', 'dark', 'app-icon/png/app-icon-24.png')}
<div style="margin:26px 0 10px;font-weight:600;color:#1F1E1D">Tray icon, every size (shown 4x, pixel for pixel)</div>
<div style="display:flex;gap:14px;align-items:flex-end">
  ${[16, 20, 24, 32].map((s) => `<div style="background:#EEF0F3;padding:8px;border-radius:8px">${img(`tray/png/tray-light-${s}.png`, s * 4, s * 4, 'image-rendering:pixelated')}<div>${s}</div></div>`).join('')}
  ${[16, 20, 24, 32].map((s) => `<div style="background:#202020;color:#bbb;padding:8px;border-radius:8px">${img(`tray/png/tray-dark-${s}.png`, s * 4, s * 4, 'image-rendering:pixelated')}<div>${s}</div></div>`).join('')}
</div>
<div style="margin:26px 0 10px;font-weight:600;color:#1F1E1D">App icon</div>
<div style="display:flex;gap:22px;align-items:flex-end">
  ${img('app-icon/app-icon-1024.png', 180)}
  ${[256, 128, 64, 48, 32, 24, 16].map((s) => `<div style="text-align:center">${img(`app-icon/png/app-icon-${Math.min(s, 256)}.png`, Math.min(s, 128))}<div>${s}</div></div>`).join('')}
  <div style="display:flex;flex-direction:column;gap:8px;margin-left:auto">
    <div style="display:flex;gap:10px;align-items:center"><div style="width:44px;height:44px;border-radius:10px;background:#C96442"></div><div><b>Accent #C96442</b><br>3.9:1 on #FFFFFF · 4.2:1 on #1F1F1F</div></div>
    <div style="display:flex;gap:10px;align-items:center"><div style="width:44px;height:44px;border-radius:10px;background:#1F1E1D"></div><div><b>Ink #1F1E1D</b> (light mode)</div></div>
    <div style="display:flex;gap:10px;align-items:center"><div style="width:44px;height:44px;border-radius:10px;background:#F5F4EF;border:1px solid #ccc"></div><div><b>Paper #F5F4EF</b> (dark mode)</div></div>
  </div>
</div>
</div></body></html>`;
writeFileSync('prev.tpl', html);
