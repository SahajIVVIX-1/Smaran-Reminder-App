// "Smaran" wordmark: monoline geometric letters drawn with the same round stroke as the symbol.
// Units: x-height 20 (y 0..20), cap height 28 (y -8..20), stroke W.
import { sPath, f } from './geo.mjs';
import { A0 } from './symbol.mjs';
export const W = 4.2;
const h = W / 2, base = 20 - h, top = h;
const L = {
  S: (x) => { const r = (28 - W) / 4; const cx = x + h + r; return { d: sPath(cx, -8 + h + 2 * r, r, A0), w: 2 * r + W }; },
  m: (x) => { const R = 5.2, s = x + h;
    return { d: `M${s} ${base}V${top}M${s} ${f(top + R)}A${R} ${R} 0 0 1 ${f(s + 2 * R)} ${f(top + R)}V${base}M${f(s + 2 * R)} ${f(top + R)}A${R} ${R} 0 0 1 ${f(s + 4 * R)} ${f(top + R)}V${base}`, w: 4 * R + W }; },
  n: (x) => { const R = 6.4, s = x + h;
    return { d: `M${s} ${base}V${top}M${s} ${f(top + R)}A${R} ${R} 0 0 1 ${f(s + 2 * R)} ${f(top + R)}V${base}`, w: 2 * R + W }; },
  r: (x) => { const R = 6.6, s = x + h;
    return { d: `M${s} ${base}V${top}M${s} ${f(top + R)}A${R} ${R} 0 0 1 ${f(s + R)} ${top}`, w: R + W }; },
  a: (x) => { const R = 10 - h, cx = x + h + R;
    return { d: `M${f(cx + R)} 10A${R} ${R} 0 1 0 ${f(cx - R)} 10A${R} ${R} 0 1 0 ${f(cx + R)} 10M${f(cx + R)} ${top}V${base}`, w: 2 * R + W }; },
};
// Optical gaps between letters (outer edge to outer edge).
const GAPS = { Sm: 3.4, ma: 3.4, ar: 3.2, ra: 2.4, an: 3.4 };
export function wordmark(word = 'Smaran') {
  let x = 0, d = '';
  for (let i = 0; i < word.length; i++) {
    const g = L[word[i]](x); d += g.d; x += g.w;
    if (i < word.length - 1) x += GAPS[word[i] + word[i + 1]] ?? 4;
  }
  return { d, width: x, top: -8, height: 28 };
}
export function wordmarkPath(color) {
  const w = wordmark();
  return `<path d="${w.d}" fill="none" stroke="${color}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
