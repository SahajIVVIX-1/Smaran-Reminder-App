/** Dances · Physics */
import {
  C,
  DOT_W,
  PI,
  TAU,
  capsule,
  dot,
  dots3,
  easeIn,
  easeOut,
  frac,
  lerp,
  motion,
  polar,
  seg,
  smeared,
  smooth,
  trio,
  wander,
  type Pt,
} from './kit';

const CAT = 'Physics';
const ROW = [20, 32, 44] as const;

/** deterministic pseudo-random in [0,1) */
const hash = (n: number): number => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

export const PHYSICS_DANCES = [
  dots3('cradle', "Newton's cradle", CAT, 2.4, (t) => {
    const s = Math.sin((TAU * t) / 1.2);
    const left = Math.max(0, -s);
    const right = Math.max(0, s);
    return [
      [ROW[0] - 9 * left, C - 5 * left * left],
      [ROW[1], C],
      [ROW[2] + 9 * right, C - 5 * right * right],
    ];
  }),

  dots3(
    'pendulum-wave',
    'Pendulum wave',
    CAT,
    4,
    (t) => {
      const x = (k: number): number => C + 17 * Math.sin((TAU * t * (15 + k)) / 12);
      return [
        [x(0), 18],
        [x(1), 32],
        [x(2), 46],
      ];
    },
    { smear: 0.4 },
  ),

  dots3(
    'coupled-pendulums',
    'Coupled pendulums',
    CAT,
    4,
    (t) => {
      const w = (TAU * t) / 1.1;
      const env = (TAU * t) / 8;
      const th1 = 0.55 * Math.cos(env) * Math.sin(w);
      const th2 = 0.55 * Math.sin(env) * Math.sin(w - PI / 2);
      const bob = (px: number, th: number): Pt => [px + 26 * Math.sin(th), 10 + 26 * Math.cos(th)];
      const a = bob(22, th1);
      const b = bob(42, th2);
      return [
        a,
        [lerp(22 + 12 * Math.sin(th1), 42 + 12 * Math.sin(th2), 0.5), 22 + 2 * Math.cos(w)],
        b,
      ];
    },
    { widths: () => [DOT_W, 5, DOT_W] },
  ),

  dots3('spring-chain', 'Spring chain modes', CAT, 4, (t) => {
    const r2 = Math.SQRT2;
    const w1 = Math.sqrt(2 - r2);
    const w2 = r2;
    const w3 = Math.sqrt(2 + r2);
    const base = TAU * t * 0.9;
    const m1 = 4 * Math.sin(w1 * base);
    const m2 = 3 * Math.sin(w2 * base + 1);
    const m3 = 2 * Math.sin(w3 * base + 2);
    return [
      [ROW[0] + 0.5 * m1 + 0.707 * m2 + 0.5 * m3, C],
      [ROW[1] + 0.707 * m1 - 0.707 * m3, C],
      [ROW[2] + 0.5 * m1 - 0.707 * m2 + 0.5 * m3, C],
    ];
  }),

  dots3('magnets', 'Magnets', CAT, 3.4, (t) => {
    const u = frac(t / 2.2);
    const pull = u < 0.45 ? easeIn(u / 0.45) : u < 0.6 ? 1 : 1 - easeOut((u - 0.6) / 0.4);
    const d = 3.5 + 13 * (1 - pull);
    const a = 20 * Math.sin((TAU * t) / 4.4);
    return [polar(d, 180 + a), polar(d, a), polar(19, (360 * t) / 3.3 + 90)];
  }),

  dots3('tautochrone', 'Tautochrone race', CAT, 3.6, (t) => {
    // on a cycloid, every ball reaches the bottom at the same moment — whatever its start
    const R = 6.5;
    const p = (amp: number, sign: number): Pt => {
      const s = amp * Math.cos((TAU * t) / 2.2) * sign;
      const phi = 2 * Math.asin(Math.max(-0.999, Math.min(0.999, s / (4 * R))));
      return [C + R * (phi + Math.sin(phi)), 46 - R * (1 - Math.cos(phi))];
    };
    return [p(24, 1), p(14, -1), p(7, 1)];
  }),

  dots3('centrifuge', 'Centrifuge', CAT, 3.4, (t) => {
    const spin = 0.5 - 0.5 * Math.cos((TAU * t) / 4);
    const angle = 360 * (t / 1.2) + 120 * Math.sin((TAU * t) / 4);
    const r = 5 + 15 * spin;
    return [polar(r, angle), polar(r, angle + 120), polar(r, angle + 240)];
  }),

  motion('drop-splash', 'Drop and splash', CAT, 3.2, (t) => {
    const u = frac(t / 1.8);
    const fall = seg(u, 0, 0.42);
    const after = seg(u, 0.42, 1);
    const drop: Pt = [C, lerp(8, 46, easeIn(fall))];
    const dropW =
      u < 0.42 ? DOT_W * smooth(seg(u, 0, 0.08)) : DOT_W * (1 - smooth(seg(after, 0, 0.25)));
    const splash = (dir: number): ReturnType<typeof dot> => {
      const v = easeOut(after);
      const p: Pt = [C + dir * 18 * v, 46 - 16 * Math.sin(PI * Math.min(1, after * 1.4))];
      const w = 7 * Math.sin(PI * Math.min(1, after * 1.15)) * (u > 0.42 ? 1 : 0);
      return dot(p, dir < 0 ? 1 : 2, { width: Math.max(0, w), teleport: true });
    };
    return [
      u < 0.42
        ? capsule(drop, 90, 6 * fall, 0, { width: dropW, teleport: true })
        : capsule([C, 47], 0, 10 * (1 - after), 0, { width: dropW, teleport: true }),
      splash(-1),
      splash(1),
    ];
  }),

  motion('water-drip', 'Water drip', CAT, 3.2, (t) => {
    const u = frac(t / 2);
    const grow = smooth(seg(u, 0, 0.5));
    const fall = seg(u, 0.55, 0.85);
    const neck = u < 0.55 ? 3 + 7 * grow : 0;
    const drop: Pt = u < 0.55 ? [C, 14 + neck / 2] : [C, lerp(19, 47, easeIn(fall))];
    const dropW = (u < 0.55 ? 4 + 5 * grow : 9) * (1 - smooth(seg(u, 0.85, 0.9)));
    const ripple = seg(u, 0.85, 1);
    return [
      capsule([C, 9], 0, 12, 0, { width: 6 }),
      u < 0.55
        ? capsule(drop, 90, neck, 1, { width: dropW, teleport: true })
        : capsule(drop, 90, 4 * fall, 1, { width: dropW, teleport: true }),
      capsule([C, 50], 0, 6 + 22 * easeOut(ripple), 2, {
        width: 4 * (1 - ripple) + 2,
        opacity: 1 - 0.7 * ripple,
      }),
    ];
  }),

  dots3(
    'lava-lamp',
    'Lava lamp',
    CAT,
    4,
    (t) => {
      const p = (k: number): Pt => [
        C + 7 * wander(t * 0.6, k + 1),
        C + 16 * Math.sin((TAU * t) / (4.2 + k * 1.3) + k * 2),
      ];
      return [p(0), p(1), p(2)];
    },
    {
      smear: 0,
      widths: (t) => [
        12 + 3 * Math.sin(t * 1.3),
        10 + 3 * Math.sin(t * 1.7 + 1),
        13 + 2 * Math.sin(t * 1.1 + 2),
      ],
    },
  ),

  dots3(
    'cell-division',
    'Cell division',
    CAT,
    3.6,
    (t) => {
      const u = frac(t / 3.6);
      const split1 = smooth(seg(u, 0.1, 0.35));
      const split2 = smooth(seg(u, 0.4, 0.62));
      const merge = smooth(seg(u, 0.75, 0.97));
      const k = 1 - merge;
      const a: Pt = [C - 8 * split1 * k, C - 7 * split2 * k];
      const b: Pt = [C + 8 * split1 * k, C];
      const c: Pt = [C - 8 * split1 * k, C + 7 * split2 * k];
      return [a, b, c];
    },
    {
      smear: 0,
      widths: (t) => {
        const u = frac(t / 3.6);
        const s = 12 - 2 * smooth(seg(u, 0.1, 0.62)) + 2 * smooth(seg(u, 0.75, 0.97));
        return [s, s, s];
      },
    },
  ),

  dots3(
    'dipole-field',
    'Magnetic field lines',
    CAT,
    3.6,
    (t) => {
      const loop = (L: number, side: number, ph: number): Pt => {
        const th = PI * frac(t / 2.4 + ph);
        const r = L * Math.sin(th) ** 2;
        return [C + side * r * Math.sin(th), C - r * Math.cos(th)];
      };
      return [loop(24, 1, 0), loop(24, -1, 0.5), loop(13, 1, 0.25)];
    },
    { smear: 0.4 },
  ),

  dots3(
    'standing-wave',
    'Standing wave',
    CAT,
    3.2,
    (t) => {
      const y = (x: number): number => {
        const v = (x - 10) / 44;
        return (
          C +
          11 * Math.sin(PI * v) * Math.cos((TAU * t) / 1.2) +
          6 * Math.sin(2 * PI * v) * Math.cos((TAU * t) / 0.6 + 1)
        );
      };
      return [
        [21, y(21)],
        [32, y(32)],
        [43, y(43)],
      ];
    },
    { smear: 0.4 },
  ),

  dots3('rolling-wheel', 'Rolling wheel', CAT, 3.6, (t) => {
    const r = 9;
    const xc = C + 15 * Math.sin((TAU * t) / 3.4);
    const phi = ((xc - C) / r) * (180 / PI);
    return [polar(r, phi - 90, xc, 38), polar(r, phi + 30, xc, 38), polar(r, phi + 150, xc, 38)];
  }),

  dots3(
    'buoyancy',
    'Buoyancy',
    CAT,
    3.6,
    (t) => {
      const bob = (k: number, level: number): number => {
        const u = frac(t / 3.6 + k * 0.15);
        const drop =
          u < 0.25
            ? lerp(8, level + 9, easeIn(u / 0.25))
            : level + 9 * Math.exp(-4 * (u - 0.25)) * Math.cos(TAU * 2.2 * (u - 0.25));
        const lift = smooth(seg(u, 0.9, 1));
        return lerp(drop, 8, lift);
      };
      return [
        [20, bob(0, 30)],
        [32, bob(1, 36)],
        [44, bob(2, 42)],
      ];
    },
    { widths: () => [7, 10, 12] },
  ),

  motion('galton', 'Galton board', CAT, 3.6, (t) =>
    trio((k) => {
      const period = 2.1;
      const tt = t + k * 0.7;
      const cycle = Math.floor(tt / period);
      const u = frac(tt / period);
      const rows = 5;
      const pos = u * rows;
      const row = Math.floor(pos);
      let x = C;
      for (let i = 0; i < row; i++) x += hash(cycle * 31 + k * 7 + i) < 0.5 ? -4 : 4;
      const dir = hash(cycle * 31 + k * 7 + row) < 0.5 ? -4 : 4;
      const f = frac(pos);
      const px = x + dir * smooth(f);
      const py = 10 + 38 * u - 3 * Math.sin(PI * f);
      const w = DOT_W * 0.8 * smooth(seg(u, 0, 0.06)) * (1 - smooth(seg(u, 0.94, 1)));
      return dot([px, py], k, { width: w, teleport: true });
    }),
  ),

  motion('gravity-flip', 'Gravity flip', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 2.4);
      const down = u < 0.5;
      const v = down ? u / 0.5 : (u - 0.5) / 0.5;
      const delay = k * 0.08;
      const f = easeIn(seg(v, delay, 0.75 + delay * 0.5));
      const land = seg(v, 0.75 + delay * 0.5, 1);
      const bounce = 3 * Math.sin(PI * land) * (1 - land);
      const y = down ? lerp(14, 50, f) - bounce : lerp(50, 14, f) + bounce;
      return smeared(() => [ROW[k], y], t, k, { amount: 0 });
    }),
  ),
] as const;
