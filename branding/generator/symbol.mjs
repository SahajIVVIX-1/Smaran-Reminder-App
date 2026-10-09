// The Smaran symbol, tuned per pixel size so strokes land on whole pixels.
import { sPath, f } from './geo.mjs';
// w: stroke, r: bowl radius, left/top: outer box of the S, badge: dot centre + radius, all in px.
export const GRID = {
  16: { w: 2, r: 3, left: 2, top: 1, badge: [13, 2, 2] },
  20: { w: 3, r: 3.5, left: 2, top: 2, badge: [15.5, 4.5, 2.5] },
  24: { w: 3, r: 4.5, left: 3, top: 1, badge: [19, 4, 3] },
  32: { w: 4, r: 6, left: 4, top: 2, badge: [25, 5, 4] },
  40: { w: 5, r: 7.5, left: 5, top: 2, badge: [32, 7, 5] },
  48: { w: 6, r: 9, left: 6, top: 3, badge: [38, 8, 6] },
};
export const A0 = -10; // angle of the S's upper terminal
export function parts(size) {
  const g = GRID[size] ?? GRID[24];
  const cx = g.left + g.w / 2 + g.r;
  const cy = g.top + g.w / 2 + 2 * g.r;
  return { d: sPath(cx, cy, g.r, A0), w: g.w, badge: g.badge.map(f), box: GRID[size] ? size : 24 };
}
/** SVG markup for the symbol. ink: S colour; dot: badge colour (null = no badge). */
export function symbolSvg(size, ink, dot, { bg = null, viewSize = size } = {}) {
  const p = parts(size);
  const [bx, by, br] = p.badge;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewSize}" height="${viewSize}" viewBox="0 0 ${p.box} ${p.box}">` +
    (bg ? `<rect width="${p.box}" height="${p.box}" fill="${bg}"/>` : '') +
    `<path d="${p.d}" fill="none" stroke="${ink}" stroke-width="${p.w}" stroke-linecap="round"/>` +
    (dot ? `<circle cx="${bx}" cy="${by}" r="${br}" fill="${dot}"/>` : '') + `</svg>`;
}
