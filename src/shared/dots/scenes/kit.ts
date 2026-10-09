/**
 * Scene-building kit: maths, motion helpers, 3D projection, and builders
 * for dances (moving dots) and shapes (three-stroke drawings).
 * Coordinates: 64×64 box, centre (32, 32), y grows downward, angles in degrees.
 */
import { N, dotPts, resample, type Pt } from '../dotsGeometry';
import {
  DOT_IDENTITY,
  DOT_W,
  LINE_W,
  type ColorToken,
  type DotsScene,
  type Frame,
  type StrokeTarget,
} from '../dotsTypes';

export { N, DOT_W, LINE_W };
export type { Pt, Frame, StrokeTarget, ColorToken, DotsScene };

export const C = 32;
export const TAU = Math.PI * 2;
export const PI = Math.PI;
const DEG = PI / 180;

// ── scalar maths ───────────────────────────────────────────────────────────
export const frac = (x: number): number => x - Math.floor(x);
export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const clamp01 = (x: number): number => clamp(x, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const seg = (u: number, a: number, b: number): number => clamp01((u - a) / (b - a));
export const easeInOut = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
export const easeIn = (x: number): number => x * x * x;
export const easeOut = (x: number): number => 1 - (1 - x) ** 3;
export const easeOutBack = (x: number): number =>
  1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
export const easeOutElastic = (x: number): number =>
  x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * PI) / 3)) + 1;
export const smooth = (x: number): number => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
/** periodic 0 → 1 → 0 */
export const hump = (p: number): number => 0.5 - 0.5 * Math.cos(TAU * p);
/** sine in cycles */
export const wave = (p: number, k = 1, ph = 0): number => Math.sin(TAU * (k * p + ph));
/** periodic smooth bump centred at c, half-width w (p in cycles) */
export const bump = (p: number, c: number, w: number): number => {
  let d = p - c;
  d -= Math.round(d);
  return Math.abs(d) < w ? 0.5 + 0.5 * Math.cos((PI * d) / w) : 0;
};
/** triangle wave 0..1..0 over one cycle */
export const tri = (p: number): number => 1 - Math.abs(2 * frac(p) - 1);
/** smooth pseudo-random wander in [-1, 1], continuous in t */
export const wander = (t: number, seed: number): number =>
  Math.sin(t * 1.13 + seed * 7.1) * 0.5 +
  Math.sin(t * 2.31 + seed * 3.3) * 0.3 +
  Math.sin(t * 4.07 + seed * 1.7) * 0.2;
/** draws in (0→1) over [a,b], then retracts (1→0) over [c,d] — loops seamlessly */
export const drawUndo = (u: number, a: number, b: number, c: number, d: number): number =>
  Math.max(0.02, u < c ? easeInOut(seg(u, a, b)) : 1 - easeInOut(seg(u, c, d)));
/** smooth step-hold: holds on integers, moves between them during the last `move` fraction */
export const stepHold = (x: number, move = 0.35): number =>
  Math.floor(x) + easeInOut(seg(frac(x), 1 - move, 1));

// ── points ─────────────────────────────────────────────────────────────────
export const polar = (r: number, deg: number, cx = C, cy = C): Pt => [
  cx + r * Math.cos(deg * DEG),
  cy + r * Math.sin(deg * DEG),
];
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const mixPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const rotPt = (p: Pt, deg: number, cx = C, cy = C): Pt => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c];
};

// ── polylines ──────────────────────────────────────────────────────────────
export const line = (...pts: Pt[]): Pt[] => pts;
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 48): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) out.push(polar(r, a0 + ((a1 - a0) * i) / steps, cx, cy));
  return out;
}
export const circle = (cx: number, cy: number, r: number, start = -90): Pt[] =>
  arc(cx, cy, r, start, start + 360, 64);
export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0,
  a0 = 0,
  a1 = 360,
  steps = 64,
): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + ((a1 - a0) * i) / steps) * DEG;
    out.push(rotPt([cx + rx * Math.cos(a), cy + ry * Math.sin(a)], rot, cx, cy));
  }
  return out;
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
export function quad(p0: Pt, p1: Pt, p2: Pt, steps = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const m = 1 - t;
    out.push([
      m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0],
      m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1],
    ]);
  }
  return out;
}
export const join = (...parts: ReadonlyArray<ReadonlyArray<Pt>>): Pt[] =>
  parts.flatMap((p) => p.slice());
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
  [x, y],
];
export function roundRect(x: number, y: number, w: number, h: number, r: number): Pt[] {
  return join(
    arc(x + w - r, y + r, r, -90, 0, 8),
    arc(x + w - r, y + h - r, r, 0, 90, 8),
    arc(x + r, y + h - r, r, 90, 180, 8),
    arc(x + r, y + r, r, 180, 270, 8),
    [[x + w - r, y]],
  );
}
export function polygon(sides: number, r: number, rot = -90, cx = C, cy = C): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= sides; i++) out.push(polar(r, rot + (360 * i) / sides, cx, cy));
  return out;
}
export function star(points: number, r1: number, r2: number, rot = -90, cx = C, cy = C): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= points * 2; i++)
    out.push(polar(i % 2 ? r2 : r1, rot + (180 * i) / points, cx, cy));
  return out;
}
/** horizontal wave from x0 to x1 */
export function waveLine(
  x0: number,
  x1: number,
  y: number,
  amp: number,
  cycles: number,
  phase = 0,
  steps = 48,
): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    out.push([lerp(x0, x1, u), y + amp * Math.sin(TAU * (cycles * u + phase))]);
  }
  return out;
}
/** generic parametric curve, u in [0,1] */
export function curve(fn: (u: number) => Pt, steps = 64): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) out.push(fn(i / steps));
  return out;
}
export const tf = {
  rotate: (pts: ReadonlyArray<Pt>, deg: number, cx = C, cy = C): Pt[] =>
    pts.map((p) => rotPt(p, deg, cx, cy)),
  scale: (pts: ReadonlyArray<Pt>, sx: number, sy = sx, cx = C, cy = C): Pt[] =>
    pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy] as Pt),
  move: (pts: ReadonlyArray<Pt>, dx: number, dy: number): Pt[] =>
    pts.map(([x, y]) => [x + dx, y + dy] as Pt),
  /** keep the first fraction of a polyline (for "drawing" effects) */
  trim: (pts: ReadonlyArray<Pt>, from: number, to: number): Pt[] => {
    const r = resample(pts, 120);
    const a = Math.floor(clamp01(Math.min(from, to)) * 119);
    const b = Math.ceil(clamp01(Math.max(from, to)) * 119);
    return r.slice(a, Math.max(a + 1, b) + 1);
  },
};

// ── 3D ─────────────────────────────────────────────────────────────────────
export interface P3 {
  x: number;
  y: number;
  z: number;
}
export const rotX = (p: P3, deg: number): P3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
};
export const rotY = (p: P3, deg: number): P3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
};
export const rotZ = (p: P3, deg: number): P3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
};
/** perspective projection; returns screen point, scale (for size) and depth (higher = nearer) */
export const project = (p: P3, cam = 90): { pt: Pt; s: number; depth: number } => {
  const s = cam / (cam + p.z);
  return { pt: [C + p.x * s, C + p.y * s], s, depth: -p.z };
};

// ── stroke targets ─────────────────────────────────────────────────────────
type Slot = 0 | 1 | 2;
export interface DotOpts {
  width?: number;
  opacity?: number;
  z?: number;
  teleport?: boolean;
  color?: ColorToken;
}
/** a round dot for slot i (identity colour unless given) */
export const dot = (p: Pt, i: Slot, o: DotOpts = {}): StrokeTarget => ({
  pts: dotPts(p[0], p[1]),
  width: o.width ?? DOT_W,
  color: o.color ?? DOT_IDENTITY[i],
  ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
  ...(o.z !== undefined ? { z: o.z } : {}),
  ...(o.teleport ? { teleport: true } : {}),
});
/** a capsule (stretched dot) centred at p along angle, length len */
export const capsule = (
  p: Pt,
  deg: number,
  len: number,
  i: Slot,
  o: DotOpts = {},
): StrokeTarget => {
  const a = polar(len / 2, deg + 180, p[0], p[1]);
  const b = polar(len / 2, deg, p[0], p[1]);
  return { ...dot(p, i, o), pts: resample(len < 0.01 ? [p] : [a, b], N) };
};
/** any polyline as a slot-i stroke */
export const path = (pts: ReadonlyArray<Pt>, i: Slot, o: DotOpts = {}): StrokeTarget => ({
  ...dot([C, C], i, { width: LINE_W, ...o }),
  pts: resample(pts, N),
});

/**
 * Motion-blur "smear": a moving dot stretches along its velocity, like the
 * smear frames animators draw. Area is roughly preserved.
 */
export function smeared(
  pos: (t: number) => Pt,
  t: number,
  i: Slot,
  o: DotOpts & { amount?: number } = {},
): StrokeTarget {
  const h = 1 / 120;
  const a = pos(t - h);
  const b = pos(t + h);
  const vx = (b[0] - a[0]) / (2 * h);
  const vy = (b[1] - a[1]) / (2 * h);
  const speed = Math.hypot(vx, vy);
  const len = Math.min(9, speed * 0.028 * (o.amount ?? 1));
  const w = (o.width ?? DOT_W) * (1 - 0.18 * (len / 9));
  if (len < 0.3) return dot(pos(t), i, o);
  return capsule(pos(t), (Math.atan2(vy, vx) * 180) / PI, len, i, { ...o, width: w });
}

// ── scene builders ─────────────────────────────────────────────────────────
type F3 = readonly [StrokeTarget, StrokeTarget, StrokeTarget];

export interface SceneDef<K extends string> extends DotsScene {
  readonly key: K;
}

export function motion<K extends string>(
  key: K,
  name: string,
  category: string,
  hold: number,
  frame: (t: number) => F3,
  colorBy: 'identity' | 'slot' = 'identity',
): SceneDef<K> {
  return { key, name, kind: 'dance', category, hold, colorBy, frame };
}

/** a dance from three position functions; dots smear when fast */
export function dots3<K extends string>(
  key: K,
  name: string,
  category: string,
  hold: number,
  pos: (t: number) => readonly [Pt, Pt, Pt],
  opts: { smear?: number; widths?: (t: number) => readonly [number, number, number] } = {},
): SceneDef<K> {
  const amount = opts.smear ?? 1;
  const fns: Array<(t: number) => Pt> = [0, 1, 2].map((k) => (t: number) => pos(t)[k] ?? [C, C]);
  return motion(key, name, category, hold, (t) => {
    const w = opts.widths?.(t);
    return [0, 1, 2].map((k) => {
      const fn = fns[k] ?? ((): Pt => [C, C]);
      const width = w?.[k] ?? DOT_W;
      return amount > 0
        ? smeared(fn, t, k as Slot, { amount, width })
        : dot(fn(t), k as Slot, { width });
    }) as unknown as F3;
  });
}

/** a shape: three strokes with their own colours */
export function shape<K extends string>(
  key: K,
  name: string,
  category: string,
  frame: (t: number) => F3,
  hold = 3.2,
): SceneDef<K> {
  return { key, name, kind: 'shape', category, hold, colorBy: 'slot', frame };
}

export interface StrokeOpts {
  width?: number;
  opacity?: number;
  z?: number;
  teleport?: boolean;
}
/** a drawn stroke for shapes */
export const S = (pts: ReadonlyArray<Pt>, color: ColorToken, o: StrokeOpts = {}): StrokeTarget => ({
  pts: resample(pts, N),
  width: o.width ?? LINE_W,
  color,
  ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
  ...(o.z !== undefined ? { z: o.z } : {}),
  ...(o.teleport ? { teleport: true } : {}),
});
/** a still dot inside a shape */
export const P = (p: Pt, color: ColorToken, o: StrokeOpts = {}): StrokeTarget => ({
  pts: dotPts(p[0], p[1]),
  width: o.width ?? DOT_W * 0.8,
  color,
  ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
  ...(o.z !== undefined ? { z: o.z } : {}),
  ...(o.teleport ? { teleport: true } : {}),
});
/** build a frame from a per-slot function */
export const trio = (fn: (k: Slot) => StrokeTarget): F3 => [fn(0), fn(1), fn(2)];
/** transform all three strokes */
export const all = (f: F3, fn: (pts: Pt[]) => Pt[]): F3 => [
  { ...f[0], pts: fn(f[0].pts) },
  { ...f[1], pts: fn(f[1].pts) },
  { ...f[2], pts: fn(f[2].pts) },
];
/** gentle breathing scale */
export const breathe = (t: number, amount = 0.025, period = 3): number =>
  1 + amount * Math.sin((TAU * t) / period);
