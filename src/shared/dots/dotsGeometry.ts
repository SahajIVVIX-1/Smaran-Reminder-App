/**
 * Geometry helpers. Everything lives in a 64×64 box, centre (32, 32).
 * Every stroke is resampled to exactly N evenly spaced points, so any stroke
 * can morph into any other stroke (or collapse into a dot) point-by-point.
 */

export type Pt = readonly [number, number];

/** points per stroke */
export const N = 40;
export const CX = 32;
export const CY = 32;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Resample a polyline to n points spaced evenly along its length. */
export function resample(poly: ReadonlyArray<Pt>, n = N): Pt[] {
  const first = poly[0];
  if (!first) return Array.from({ length: n }, () => [CX, CY] as const);
  if (poly.length === 1) return Array.from({ length: n }, () => first);

  const cum: number[] = [0];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1] ?? first;
    const b = poly[i] ?? first;
    cum.push((cum[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[cum.length - 1] ?? 0;
  if (total === 0) return Array.from({ length: n }, () => first);

  const out: Pt[] = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    while (seg < poly.length - 1 && (cum[seg] ?? 0) < d) seg++;
    const a = poly[seg - 1] ?? first;
    const b = poly[seg] ?? first;
    const d0 = cum[seg - 1] ?? 0;
    const len = (cum[seg] ?? 0) - d0;
    const u = len > 0 ? (d - d0) / len : 0;
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

/** A dot: n copies of one point (renders as a round dot thanks to round caps). */
export function dotPts(x: number, y: number, n = N): Pt[] {
  return Array.from({ length: n }, () => [x, y] as const);
}

export function line(...pts: Pt[]): Pt[] {
  return pts;
}

/** arc from angle a0 to a1 (degrees, 0 = right, 90 = down) */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 48): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + ((a1 - a0) * i) / steps) * DEG;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export function circle(cx: number, cy: number, r: number, start = -90): Pt[] {
  return arc(cx, cy, r, start, start + 360, 64);
}

export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 32): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const m = 1 - t;
    out.push([
      m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
      m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** join polylines end-to-start into one */
export function join(...parts: ReadonlyArray<ReadonlyArray<Pt>>): Pt[] {
  const out: Pt[] = [];
  for (const p of parts) out.push(...p);
  return out;
}

export function rotate(pts: ReadonlyArray<Pt>, deg: number, cx = CX, cy = CY): Pt[] {
  if (deg === 0) return pts.slice();
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return pts.map(
    ([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c] as const,
  );
}

export function scale(pts: ReadonlyArray<Pt>, k: number, cx = CX, cy = CY): Pt[] {
  if (k === 1) return pts.slice();
  return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as const);
}

export function translate(pts: ReadonlyArray<Pt>, dx: number, dy: number): Pt[] {
  if (dx === 0 && dy === 0) return pts.slice();
  return pts.map(([x, y]) => [x + dx, y + dy] as const);
}

// ── small maths helpers shared by scenes ────────────────────────────────────
export const frac = (x: number): number => x - Math.floor(x);
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeInOut = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
export const hump = (p: number): number => 0.5 - 0.5 * Math.cos(TAU * p);
export const polar = (r: number, deg: number, cx = CX, cy = CY): Pt =>
  [cx + r * Math.cos(deg * DEG), cy + r * Math.sin(deg * DEG)] as const;
export { TAU };
