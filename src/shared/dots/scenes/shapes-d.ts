/** Shapes · Science & symbols, Letters & digits */
import { N, resample } from '../dotsGeometry';
import {
  C,
  DOT_W,
  P,
  PI,
  S,
  TAU,
  all,
  arc,
  circle,
  cubic,
  curve,
  easeInOut,
  ellipse,
  frac,
  join,
  line,
  mixPt,
  polar,
  polygon,
  seg,
  shape,
  smooth,
  tf,
  stepHold,
  drawUndo,
  type Pt,
} from './kit';

const SCI = 'Science & symbols';
const TYPE = 'Letters & digits';
const L = (a: Pt, b: Pt): Pt[] => line(a, b);

const morph = (a: ReadonlyArray<Pt>, b: ReadonlyArray<Pt>, k: number): Pt[] => {
  const ra = resample(a, N);
  const rb = resample(b, N);
  return ra.map((p, i) => mixPt(p, rb[i] ?? p, k));
};

const lemniscate = (u: number): Pt => {
  const th = TAU * u;
  const d = 1 + Math.sin(th) ** 2;
  return [C + (20 * Math.cos(th)) / d, C + (20 * Math.sin(th) * Math.cos(th)) / d];
};

/** a digit or letter with its own small life motion */
const glyph = (
  key: string,
  name: string,
  strokes: [Pt[], Pt[] | null],
  dot: Pt,
  motion: (t: number, p: Pt[]) => Pt[],
) =>
  shape(key, name, TYPE, (t) => [
    S(motion(t, strokes[0]), 'primary'),
    strokes[1]
      ? S(motion(t, strokes[1]), 'primary')
      : P(motion(t, [dot])[0] ?? dot, 'accent2', { width: 0 }),
    P(motion(t, [dot])[0] ?? dot, 'accent', { width: DOT_W * (0.75 + 0.15 * Math.sin(t * 3)) }),
  ]);

const flip = (t: number, p: Pt[]): Pt[] =>
  tf.scale(p, 1, 0.3 + 0.7 * Math.abs(Math.cos((PI * t) / 2.4)) ** 0.5);
const bob = (t: number, p: Pt[]): Pt[] => tf.move(p, 0, -2.5 * Math.abs(Math.sin((PI * t) / 0.9)));
const swing = (t: number, p: Pt[]): Pt[] => tf.rotate(p, 8 * Math.sin((TAU * t) / 2), C, 12);
const wobble = (t: number, p: Pt[]): Pt[] =>
  tf.rotate(p, 6 * Math.sin((TAU * t) / 1.2) * Math.sin((TAU * t) / 4.8), C, 52);
const spin3d = (t: number, p: Pt[]): Pt[] => tf.scale(p, Math.cos((TAU * t) / 3.2), 1);
const pulse = (t: number, p: Pt[]): Pt[] => tf.scale(p, 1 + 0.06 * Math.sin((TAU * t) / 1.2));
const lean = (t: number, p: Pt[]): Pt[] =>
  p.map(([x, y]) => [x + (C - y) * 0.15 * Math.sin((TAU * t) / 2.2), y] as Pt);
const hop = (t: number, p: Pt[]): Pt[] => {
  const u = frac(t / 1.2);
  const h = u < 0.4 ? Math.sin(PI * (u / 0.4)) : 0;
  return tf.scale(tf.move(p, 0, -6 * h), 1 + 0.08 * (u > 0.4 && u < 0.5 ? 1 : 0), 1, C, 52);
};

export const SHAPES_D = [
  // ── Science & symbols ─────────────────────────────────────────────────
  shape('infinity', 'Infinity', SCI, (t) => {
    const u = frac(t / 2.4);
    const loop = curve(lemniscate, 120);
    // the highlight is sampled straight from the curve, so it wraps round seamlessly
    const glow = curve((v) => lemniscate(u - 0.25 + 0.25 * v), 40);
    return [
      S(loop, 'primary', { opacity: 0.3 }),
      S(glow, 'accent'),
      P(lemniscate(u), 'accent2', { width: 8 }),
    ];
  }),

  shape('atom', 'Atom', SCI, (t) => {
    const orbit = (base: number) =>
      ellipse(C, C, 20, 6 + 2 * Math.sin(t * 1.5 + base / 30), base + 20 * t);
    return [
      S(orbit(0), 'accent', { width: 3.5 }),
      S(orbit(60), 'accent2', { width: 3.5 }),
      S(orbit(120), 'primary', { width: 3.5 }),
    ];
  }),

  shape('dna', 'DNA', SCI, (t) => {
    const strand = (sign: number): Pt[] =>
      curve((u) => [C + sign * 11 * Math.sin(u * TAU * 1.3 + t * 3), 10 + 44 * u], 60);
    const ry = 10 + 44 * frac(t / 2);
    const phi = ((ry - 10) / 44) * TAU * 1.3 + t * 3;
    return [
      S(strand(1), 'accent', { width: 4 }),
      S(strand(-1), 'accent2', { width: 4 }),
      S(L([C + 11 * Math.sin(phi), ry], [C - 11 * Math.sin(phi), ry]), 'primary', {
        width: 3,
        opacity: smooth(seg(frac(t / 2), 0, 0.1)) * (1 - smooth(seg(frac(t / 2), 0.9, 1))),
      }),
    ];
  }),

  shape('yin-yang', 'Yin-yang', SCI, (t) =>
    all(
      [
        S(circle(C, C, 18), 'primary'),
        S(join(arc(C, 23, 9, -90, 90, 24), arc(C, 41, 9, -90, -270, 24)), 'accent'),
        P([C, 41], 'accent2', { width: 6 }),
      ],
      (p) => tf.rotate(p, (360 * t) / 6),
    ),
  ),

  shape('target', 'Target lock', SCI, (t) => {
    const u = frac(t / 1.6);
    // the rings close in on the bullseye and release, always keeping clear gaps
    const r1 = 19 - 4 * easeInOut(seg(u, 0, 0.5)) + 4 * easeInOut(seg(u, 0.6, 1));
    return [
      S(circle(C, C, r1), 'error', { width: 4 }),
      S(circle(C, C, r1 - 8.5), 'error', { width: 4 }),
      P([C, C], 'error', { width: 5 + 3 * Math.sin(PI * seg(u, 0.4, 0.6)) }),
    ];
  }),

  shape('recycle', 'Recycle', SCI, (t) => {
    const arrow = (k: number): Pt[] => {
      const a0 = 120 * k - 80;
      const a1 = a0 + 90;
      const end = polar(16, a1);
      return join(
        arc(C, C, 16, a0, a1, 24),
        [polar(5, a1 + 90 + 150, end[0], end[1])],
        [end],
        [polar(5, a1 + 90 - 150, end[0], end[1])],
      );
    };
    const rot = 60 * t;
    return [
      S(tf.rotate(arrow(0), rot), 'success', { width: 4 }),
      S(tf.rotate(arrow(1), rot), 'success', { width: 4 }),
      S(tf.rotate(arrow(2), rot), 'success', { width: 4 }),
    ];
  }),

  shape('smile', 'Smile', SCI, (t) => {
    const u = frac(t / 3);
    const grin = smooth(seg(u, 0.3, 0.45)) * (1 - smooth(seg(u, 0.7, 0.85)));
    const wink = Math.max(0, 1 - Math.abs(u - 0.55) * 12);
    const smileA = arc(C, 30, 13, 30, 150, 30);
    const smileB = join(L([19, 36], [45, 36]), arc(C, 36, 13, 0, 180, 30));
    return [
      P([23, 23], 'primary', { width: 8 }),
      S(morph(line([41, 23], [41, 23.01]), L([37, 23], [45, 23]), wink), 'primary', {
        width: 8 - 4 * wink,
      }),
      S(morph(smileA, smileB, grin), 'accent'),
    ];
  }),

  shape('globe', 'Globe', SCI, (t) => {
    const a = (TAU * t) / 4;
    return [
      S(circle(C, C, 18), 'accent'),
      S(ellipse(C, C, 18 * Math.abs(Math.cos(a)) + 0.3, 18), 'accent', { width: 3 }),
      S(ellipse(C, C, 18 * Math.abs(Math.sin(a)) + 0.3, 18), 'accent2', { width: 3 }),
    ];
  }),

  shape('golden-spiral', 'Golden spiral', SCI, (t) => {
    const u = frac(t / 3);
    const spiral = curve((v) => {
      const th = v * TAU * 1.45;
      const r = 1.2 * Math.exp(0.3063 * th);
      return [C + r * Math.cos(th + t * 0.6), C + r * Math.sin(th + t * 0.6)];
    }, 120);
    const shown = tf.trim(spiral, 0, drawUndo(u, 0, 0.6, 0.75, 1));
    return [
      S(shown, 'accent2', { width: 4 }),
      P(shown[shown.length - 1] ?? [C, C], 'accent', { width: 7 }),
      S(circle(C, C, 22), 'primary', { opacity: 0.15, width: 3 }),
    ];
  }),

  shape('percent', 'Percent', SCI, (t) => {
    const a = 180 * stepHold(t / 2.4, 0.6);
    return [
      S(L([42, 14], [22, 50]), 'primary'),
      S(tf.rotate(circle(21, 21, 5), a), 'accent'),
      S(tf.rotate(circle(43, 43, 5), a), 'accent2'),
    ];
  }),

  shape('molecule', 'Molecule', SCI, (t) => {
    const v = (k: number): number => 4 * Math.sin(t * 5 + k * 2);
    const pts: Pt[] = [
      [14, 40 + v(0)],
      [24, 24 + v(1)],
      [40, 40 + v(2)],
      [50, 24 + v(3)],
    ];
    return [
      S(line(...pts), 'primary', { width: 3.5 }),
      P(pts[0] ?? [14, 40], 'accent', { width: 10 }),
      P(pts[3] ?? [50, 24], 'accent2', { width: 10 }),
    ];
  }),

  shape('phasor', 'Phasor → sine', SCI, (t) => {
    const w = (TAU * t) / 2;
    const dotP: Pt = [16 + 9 * Math.cos(w), C - 9 * Math.sin(w)];
    const sine = curve((u) => [27 + 28 * u, C - 9 * Math.sin(w - u * TAU * 1.2)], 60);
    return [
      S(circle(16, C, 9), 'primary', { width: 3, opacity: 0.5 }),
      S(join([dotP], sine), 'accent', { width: 3.5 }),
      P(dotP, 'accent2', { width: 7 }),
    ];
  }),

  shape('cube', 'Necker cube', SCI, (t) => {
    const k = smooth(0.5 - 0.5 * Math.cos((TAU * t) / 3.2));
    const up = (a: number): Pt => polar(18, a);
    const yA = line(up(-150), [C, C], up(-30));
    const yB = line(up(150), [C, C], up(30));
    const stemA = L([C, C], [C, 50]);
    const stemB = L([C, C], [C, 14]);
    return [
      S(polygon(6, 18, -90), 'primary'),
      S(morph(yA, yB, k), 'accent'),
      S(morph(stemA, stemB, k), 'accent'),
    ];
  }),

  // ── Letters & digits ──────────────────────────────────────────────────
  shape('s-mark', 'Smaran "S"', TYPE, (t) =>
    all(
      [
        S(arc(32, 22, 10, -30, -270), 'primary'),
        S(arc(32, 42, 10, -90, 150), 'primary'),
        P(polar(25, -45), 'accent', { width: DOT_W }),
      ],
      (p) => tf.scale(p, 1 + 0.025 * Math.sin((TAU * t) / 3)),
    ),
  ),
  glyph(
    'letter-m',
    'Letter M',
    [line([14, 50], [14, 14], [C, 36]), line([C, 36], [50, 14], [50, 50])],
    [54, 10],
    (t, p) => p.map(([x, y]) => [x, y === 36 ? 36 + 4 * Math.sin(t * 3) : y] as Pt),
  ),
  glyph(
    'letter-a',
    'Letter A',
    [line([14, 52], [C, 12], [50, 52]), line([22, 38], [42, 38])],
    [C, 6],
    (t, p) => tf.move(p, 0, -2 * Math.abs(Math.sin((PI * t) / 1.1))),
  ),
  glyph(
    'letter-r',
    'Letter R',
    [
      join(
        L([18, 52], [18, 12]),
        L([18, 12], [34, 12]),
        arc(34, 22, 10, -90, 90, 20),
        L([34, 32], [18, 32]),
      ),
      line([26, 32], [46, 52]),
    ],
    [50, 12],
    lean,
  ),
  glyph(
    'letter-n',
    'Letter N',
    [line([16, 52], [16, 12], [48, 52]), line([48, 52], [48, 12])],
    [52, 8],
    bob,
  ),
  glyph('digit-0', 'Zero', [ellipse(C, C, 12, 18, 0, -90, 270), null], [46, 14], spin3d),
  glyph(
    'digit-1',
    'One',
    [line([25, 19], [34, 12], [34, 52]), line([26, 52], [42, 52])],
    [44, 12],
    hop,
  ),
  glyph(
    'digit-2',
    'Two',
    [join(arc(C, 22, 10, 200, 380, 24), L([41, 26], [20, 52]), L([20, 52], [45, 52])), null],
    [48, 12],
    swing,
  ),
  glyph(
    'digit-3',
    'Three',
    [join(arc(C, 21, 9, -150, 90, 24), arc(C, 41, 11, -90, 150, 24)), null],
    [48, 10],
    wobble,
  ),
  glyph('digit-4', 'Four', [line([40, 52], [40, 12], [16, 40], [48, 40]), null], [50, 12], pulse),
  glyph(
    'digit-5',
    'Five',
    [join(line([44, 12], [22, 12], [20, 30]), arc(31, 39, 12, -130, 140, 30)), null],
    [50, 10],
    flip,
  ),
  glyph(
    'digit-6',
    'Six',
    [join(cubic([42, 14], [22, 10], [18, 32], [20, 40]), circle(C, 40, 12, 180)), null],
    [48, 12],
    bob,
  ),
  glyph(
    'digit-7',
    'Seven',
    [line([16, 12], [48, 12], [28, 52]), line([24, 32], [42, 32])],
    [52, 8],
    swing,
  ),
  glyph(
    'digit-8',
    'Eight',
    [join(circle(C, 22, 9, 90), circle(C, 42, 11, -90)), null],
    [48, 10],
    spin3d,
  ),
  glyph(
    'digit-9',
    'Nine',
    [join(circle(C, 24, 11, 0), cubic([43, 24], [44, 40], [36, 52], [22, 50])), null],
    [48, 50],
    wobble,
  ),
] as const;
