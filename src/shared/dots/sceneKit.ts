/**
 * Scene toolkit: shared types and helpers for every Smaran dots scene.
 *
 * Coordinates live in a 64×64 box, centre (32, 32). A scene returns three
 * strokes of N points for any moment t. A dot is a stroke whose points all
 * coincide. The engine springs every point toward its target, so scenes can
 * be written as plain maths and still look smooth.
 */

import { CX, CY, N, TAU, clamp01, dotPts, frac, resample, type Pt } from './dotsGeometry';

export type ColorToken = 'primary' | 'accent' | 'accent2' | 'alert' | 'success' | 'error';
export const COLOR_TOKENS: readonly ColorToken[] = [
  'primary',
  'accent',
  'accent2',
  'alert',
  'success',
  'error',
];
/** colour each dot keeps while dancing */
export const DOT_IDENTITY: readonly [ColorToken, ColorToken, ColorToken] = [
  'primary',
  'accent',
  'accent2',
];

export interface StrokeTarget {
  /** exactly N points */
  pts: Pt[];
  /** stroke width in the 64×64 box (a dot's diameter when all points coincide); 0 hides it */
  width: number;
  color: ColorToken;
  /** depth: higher draws on top (used for 3D passes in front / behind). Default 0 */
  z?: number;
}

export type Frame = readonly [StrokeTarget, StrokeTarget, StrokeTarget];

export type SceneKind = 'dance' | 'shape';

export interface DotsScene {
  readonly key: string;
  readonly name: string;
  readonly kind: SceneKind;
  /** gallery grouping, e.g. "Cosmic", "Illusions", "Weather" */
  readonly category: string;
  /** how long auto mode stays on this scene, seconds */
  readonly hold: number;
  /** t = seconds since the scene started (speed-scaled) */
  readonly frame: (t: number) => Frame;
}

export const DOT_W = 10;
export const LINE_W = 5;
export const ROW = [20, 32, 44] as const;

// ── scene builders ──────────────────────────────────────────────────────────

export type Trio = readonly [Pt, Pt, Pt];

/** one dancing dot */
export const dot = (p: Pt, i: 0 | 1 | 2, width = DOT_W, z = 0): StrokeTarget => ({
  pts: dotPts(p[0], p[1]),
  width,
  color: DOT_IDENTITY[i],
  z,
});

/** a dance from three positions */
export const dance = (
  key: string,
  name: string,
  category: string,
  hold: number,
  pos: (t: number) => Trio,
): DotsScene => ({
  key,
  name,
  kind: 'dance',
  category,
  hold,
  frame: (t) => {
    const [a, b, c] = pos(t);
    return [dot(a, 0), dot(b, 1), dot(c, 2)];
  },
});

/** a dance with full control (sizes, depth, trails) */
export const danceRaw = (
  key: string,
  name: string,
  category: string,
  hold: number,
  frame: (t: number) => Frame,
): DotsScene => ({ key, name, kind: 'dance', category, hold, frame });

export const shape = (
  key: string,
  name: string,
  category: string,
  frame: (t: number) => Frame,
  hold = 3.2,
): DotsScene => ({ key, name, kind: 'shape', category, hold, frame });

/** a drawn stroke (any polyline, resampled to N points) */
export const stroke = (
  pts: ReadonlyArray<Pt>,
  color: ColorToken,
  width = LINE_W,
  z = 0,
): StrokeTarget => ({
  pts: resample(pts, N),
  width,
  color,
  z,
});

/** a stroke that stays a dot inside a shape */
export const still = (p: Pt, color: ColorToken, width = DOT_W * 0.8, z = 0): StrokeTarget => ({
  pts: dotPts(p[0], p[1]),
  width,
  color,
  z,
});

/**
 * A dot with a motion trail ("light painting"): the stroke's points are the
 * dot's own positions over the last `span` seconds. Reads as a glowing streak.
 */
export const trail = (
  path: (t: number) => Pt,
  t: number,
  span: number,
  color: ColorToken,
  width = DOT_W * 0.8,
  z = 0,
): StrokeTarget => {
  const pts: Pt[] = [];
  for (let i = 0; i < N; i++) pts.push(path(t - (span * i) / (N - 1)));
  return { pts, width, color, z };
};

/** apply a point transform to all three strokes */
export const mapFrame = (f: Frame, fn: (pts: Pt[]) => Pt[]): Frame => [
  { ...f[0], pts: fn(f[0].pts) },
  { ...f[1], pts: fn(f[1].pts) },
  { ...f[2], pts: fn(f[2].pts) },
];

// ── maths ───────────────────────────────────────────────────────────────────

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
export const lerpPt = (a: Pt, b: Pt, u: number): Pt => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];
export const smooth = (x: number): number => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
export const easeOutBack = (x: number): number =>
  1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
export const easeOutCubic = (x: number): number => 1 - (1 - clamp01(x)) ** 3;
export const easeInCubic = (x: number): number => clamp01(x) ** 3;
/** periodic smooth bump centred at c, half-width w */
export const bump = (p: number, c: number, w: number): number => {
  let d = p - c;
  d -= Math.round(d);
  return Math.abs(d) < w ? 0.5 + 0.5 * Math.cos((Math.PI * d) / w) : 0;
};
export const tri = (p: number): number => 1 - Math.abs(2 * frac(p) - 1);
export const breathe = (t: number, amount = 0.025, period = 3): number =>
  1 + amount * Math.sin((TAU * t) / period);
/** three phase offsets 120° apart, in degrees */
export const THIRDS = [0, 120, 240] as const;
export const deg = (r: number): number => (r * 180) / Math.PI;

/** keyframe values (smooth): stops are [u 0..1, value] */
export const keys = (u: number, stops: ReadonlyArray<readonly [number, number]>): number => {
  const first = stops[0];
  if (!first) return 0;
  if (u <= first[0]) return first[1];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (a && b && u <= b[0]) return a[1] + (b[1] - a[1]) * smooth((u - a[0]) / (b[0] - a[0]));
  }
  return stops[stops.length - 1]?.[1] ?? first[1];
};

/** smoothly move through a list of points, `per` seconds each, looping */
export const tour = (pts: ReadonlyArray<Pt>, t: number, per: number, hold = 0.35): Pt => {
  const n = pts.length;
  const i = Math.floor(t / per);
  const u = frac(t / per);
  const a = pts[((i % n) + n) % n] ?? [CX, CY];
  const b = pts[(((i + 1) % n) + n) % n] ?? [CX, CY];
  return lerpPt(a, b, smooth((u - hold) / (1 - hold)));
};

// ── 3D ──────────────────────────────────────────────────────────────────────

export type V3 = readonly [number, number, number];

export const rotX = (p: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
};
export const rotY = (p: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
};
export const rotZ = (p: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
};

/** perspective projection to the 64 box; returns point and scale factor */
export const project = (p: V3, dist = 90): { pt: Pt; k: number; z: number } => {
  const k = dist / (dist - p[2]);
  return { pt: [CX + p[0] * k, CY + p[1] * k], k, z: p[2] };
};

/** a 3D dot: size and draw order follow depth */
export const dot3 = (p: V3, i: 0 | 1 | 2, width = DOT_W): StrokeTarget => {
  const pr = project(p);
  return dot(pr.pt, i, width * pr.k, pr.z);
};

/** a 3D polyline projected to a stroke */
export const stroke3 = (
  pts: ReadonlyArray<V3>,
  color: ColorToken,
  width = LINE_W,
): StrokeTarget => {
  let z = 0;
  const flat = pts.map((p) => {
    const pr = project(p);
    z += pr.z;
    return pr.pt;
  });
  return stroke(flat, color, width, pts.length ? z / pts.length : 0);
};

export const ring3 = (r: number, steps = 48): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (TAU * i) / steps;
    out.push([r * Math.cos(a), r * Math.sin(a), 0]);
  }
  return out;
};

export { CX, CY, N, TAU };
