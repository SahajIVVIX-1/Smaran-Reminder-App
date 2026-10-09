/** Extra geometry used by the library scenes (64×64 box, centre 32,32). */

import { arc, cubic, join, polar, type Pt } from '../dotsGeometry';
import { TAU } from '../sceneKit';

export const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
  [x, y],
];

/** rounded rectangle, closed, starting top-left after the corner */
export const roundRect = (x: number, y: number, w: number, h: number, r: number): Pt[] =>
  join(
    arc(x + w - r, y + r, r, -90, 0, 8),
    arc(x + w - r, y + h - r, r, 0, 90, 8),
    arc(x + r, y + h - r, r, 90, 180, 8),
    arc(x + r, y + r, r, 180, 270, 8),
    [[x + w - r, y]],
  );

export const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  start = -90,
  sweep = 360,
  steps = 64,
): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((start + (sweep * i) / steps) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
};

export const closed = (...pts: Pt[]): Pt[] => {
  const first = pts[0];
  return first ? [...pts, first] : pts;
};

/** n-point star outline, closed */
export const star = (
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  n: number,
  rot = -90,
): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    out.push(polar(r, rot + (180 * i) / n, cx, cy));
  }
  return out;
};

/** horizontal wavy line */
export const wavy = (
  x0: number,
  x1: number,
  y: number,
  amp: number,
  cycles: number,
  phase = 0,
  steps = 48,
): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    out.push([x0 + (x1 - x0) * u, y + amp * Math.sin(TAU * cycles * u + phase)]);
  }
  return out;
};

/** Archimedean spiral from r0 to r1 over `turns` */
export const spiral = (
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  turns: number,
  start = 0,
  steps = 96,
): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    out.push(polar(r0 + (r1 - r0) * u, start + 360 * turns * u, cx, cy));
  }
  return out;
};

/** sun-ray zigzag around a circle */
export const zigzagRing = (
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  n: number,
  rot = 0,
): Pt[] => star(cx, cy, r2, r1, n, rot);

/** sample a parametric curve u∈[0,1] */
export const curve = (fn: (u: number) => Pt, steps = 96): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) out.push(fn(i / steps));
  return out;
};

/** partial polyline: the first `amount` (0..1) of its length */
export const partial = (pts: ReadonlyArray<Pt>, amount: number): Pt[] => {
  const a = Math.max(0.0001, Math.min(1, amount));
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1] ?? [0, 0];
    const q = pts[i] ?? [0, 0];
    lens.push((lens[i - 1] ?? 0) + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const total = lens[lens.length - 1] ?? 0;
  const goal = total * a;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i] ?? [0, 0];
    const l = lens[i] ?? 0;
    if (l <= goal) {
      out.push(p);
      continue;
    }
    const prev = pts[i - 1] ?? p;
    const pl = lens[i - 1] ?? 0;
    const u = (goal - pl) / Math.max(1e-9, l - pl);
    out.push([prev[0] + (p[0] - prev[0]) * u, prev[1] + (p[1] - prev[1]) * u]);
    break;
  }
  return out.length > 1 ? out : [pts[0] ?? [0, 0], pts[0] ?? [0, 0]];
};

/** heart outline (parametric), centred */
export const heart = (cx: number, cy: number, s: number): Pt[] =>
  curve((u) => {
    const t = TAU * u;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [cx + (x * s) / 16, cy - (y * s) / 16];
  }, 120);

export { arc, cubic, join, polar };
