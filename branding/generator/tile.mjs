// The app icon: the symbol on a rounded-square tile, tuned per size for small icons.
import { sPath, f } from './geo.mjs';
import { A0, GRID } from './symbol.mjs';
export const TILE_GRID = {
  16: { w: 2, r: 2.5, left: 3, top: 2, badge: [12.5, 3.5, 1.5] },
  20: { w: 2, r: 3, left: 4, top: 3, badge: [15, 5, 2] },
  24: { w: 2, r: 3.5, left: 5, top: 4, badge: [18, 6, 2] },
  32: { w: 3, r: 4.5, left: 7, top: 5, badge: [22.5, 7.5, 2.5] },
  40: { w: 4, r: 5.5, left: 8, top: 7, badge: [27, 9, 3] },
  48: { w: 4, r: 6.5, left: 10, top: 9, badge: [32.5, 11.5, 3.5] },
};
export function tileSvg(size, { tile, ink, dot }) {
  const g = TILE_GRID[size];
  const rad = f(size * 0.225);
  let sym;
  if (g) {
    const cx = g.left + g.w / 2 + g.r, cy = g.top + g.w / 2 + 2 * g.r;
    sym = `<path d="${sPath(cx, cy, g.r, A0)}" fill="none" stroke="${ink}" stroke-width="${g.w}" stroke-linecap="round"/><circle cx="${g.badge[0]}" cy="${g.badge[1]}" r="${g.badge[2]}" fill="${dot}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${rad}" fill="${tile}"/>${sym}</svg>`;
  }
  // Large sizes: the 24 px master, scaled into the tile (a 1024 unit design space).
  const m = GRID[24];
  const cx = m.left + m.w / 2 + m.r, cy = m.top + m.w / 2 + 2 * m.r;
  const S = 1024, inset = 40, k = (0.66 * S) / 24;
  sym = `<g transform="translate(${f(512 - 12.5 * k)} ${f(512 - 11.5 * k)}) scale(${f(k)})"><path d="${sPath(cx, cy, m.r, A0)}" fill="none" stroke="${ink}" stroke-width="3.3" stroke-linecap="round"/><circle cx="${m.badge[0]}" cy="${m.badge[1]}" r="${m.badge[2]}" fill="${dot}"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${S} ${S}"><rect x="${inset}" y="${inset}" width="${S - 2 * inset}" height="${S - 2 * inset}" rx="${f((S - 2 * inset) * 0.225)}" fill="${tile}"/>${sym}</svg>`;
}
