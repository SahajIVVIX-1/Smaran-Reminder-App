// Electron script: renders SVG files to transparent PNGs. Usage: electron render.cjs jobs.json
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
app.disableHardwareAcceleration();
process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });
app.whenReady().then(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[process.argv.length - 1], 'utf8'));
  const win = new BrowserWindow({ show: false, enableLargerThanScreen: true, useContentSize: true, width: 1100, height: 1100, transparent: true, frame: false,
    backgroundColor: '#00000000', webPreferences: { offscreen: true } });
  win.webContents.setFrameRate(1);
  const { nativeImage } = require('electron');
  for (const j of jobs) {
    if (j.ico) { fs.writeFileSync(j.ico, makeIco(j.pngs.map((p) => nativeImage.createFromPath(p)))); continue; }
    const html = j.html ? fs.readFileSync(j.html, 'utf8') : `<html><body style="margin:0;background:transparent"><img id=i width=${j.w} height=${j.h} src="data:image/svg+xml;base64,${fs.readFileSync(j.svg).toString('base64')}"></body></html>`;
    win.setContentSize(Math.max(j.w, 16), Math.max(j.h, 16));
    await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
    await win.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode().catch(()=>0))).then(()=>document.fonts.ready).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: j.w, height: j.h });
    const sized = img.getSize().width === j.w ? img : img.resize({ width: j.w, height: j.h, quality: 'best' });
    fs.writeFileSync(j.out, sized.toPNG());
  }
  app.quit();
});

// ICO with 32-bit BMP entries below 256 px (best compatibility, incl. the NSIS installer) and PNG at 256.
function makeIco(images) {
  const entries = images.map((img) => {
    const { width: w, height: h } = img.getSize();
    if (w >= 256) return { w, h, data: img.toPNG() };
    const bgra = Buffer.from(img.toBitmap()); // top-down BGRA, possibly premultiplied
    let premul = true;
    for (let i = 0; i < bgra.length; i += 4) if (Math.max(bgra[i], bgra[i + 1], bgra[i + 2]) > bgra[i + 3]) { premul = false; break; }
    if (premul) for (let i = 0; i < bgra.length; i += 4) { const a = bgra[i + 3]; if (a > 0 && a < 255) for (let c = 0; c < 3; c++) bgra[i + c] = Math.min(255, Math.round((bgra[i + c] * 255) / a)); }
    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0); header.writeInt32LE(w, 4); header.writeInt32LE(h * 2, 8);
    header.writeUInt16LE(1, 12); header.writeUInt16LE(32, 14); header.writeUInt32LE(w * h * 4, 20);
    const px = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) bgra.copy(px, (h - 1 - y) * w * 4, y * w * 4, (y + 1) * w * 4);
    const maskRow = Math.ceil(w / 32) * 4;
    const mask = Buffer.alloc(maskRow * h); // all 0: alpha channel decides
    return { w, h, data: Buffer.concat([header, px, mask]) };
  });
  const dir = Buffer.alloc(6 + 16 * entries.length);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(entries.length, 4);
  let offset = dir.length;
  entries.forEach((e, i) => {
    const o = 6 + 16 * i;
    dir.writeUInt8(e.w >= 256 ? 0 : e.w, o); dir.writeUInt8(e.h >= 256 ? 0 : e.h, o + 1);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(e.data.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += e.data.length;
  });
  return Buffer.concat([dir, ...entries.map((e) => e.data)]);
}
