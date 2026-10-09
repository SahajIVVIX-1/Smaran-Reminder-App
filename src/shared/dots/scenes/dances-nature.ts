/** Dances · Nature & life */
import {
  C,
  DOT_W,
  PI,
  TAU,
  capsule,
  dot,
  dots3,
  easeIn,
  easeInOut,
  easeOutBack,
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

const CAT = 'Nature & life';

const leader = (t: number): Pt => [
  C + 17 * Math.sin((TAU * t) / 3.2),
  C + 9 * Math.sin((2 * TAU * t) / 3.2),
];

export const NATURE_DANCES = [
  motion('fireflies', 'Fireflies', CAT, 4, (t) =>
    trio((k) => {
      const p: Pt = [C + 18 * wander(t * 0.5, k * 3 + 1), C + 14 * wander(t * 0.45, k * 3 + 2)];
      const glow = 0.5 + 0.5 * Math.sin(t * (2.1 + k * 0.7) + k * 2);
      return dot(p, k, { width: 6 + 5 * glow, opacity: 0.35 + 0.65 * glow });
    }),
  ),

  dots3(
    'bees',
    'Bees round a flower',
    CAT,
    3.6,
    (t) => {
      const p = (k: number): Pt => {
        const a = (360 * t) / (1.1 + 0.3 * k) + 120 * k;
        const r = 10 + 4 * Math.sin(t * 3 + k);
        const base = polar(r, a);
        return [base[0] + 2.5 * wander(t * 6, k + 4), base[1] + 2.5 * wander(t * 6, k + 9)];
      };
      return [p(0), p(1), p(2)];
    },
    { widths: () => [8, 8, 8] },
  ),

  dots3(
    'fish-school',
    'School of fish',
    CAT,
    3.6,
    (t) => [leader(t), leader(t - 0.18), leader(t - 0.36)],
    { smear: 1.6 },
  ),

  dots3('v-formation', 'Bird V-formation', CAT, 3.6, (t) => {
    const base: Pt = [C + 6 * Math.sin((TAU * t) / 3.6), C + 4 * Math.sin((TAU * t) / 1.8)];
    const flap = (ph: number): number => 1.5 * Math.sin((TAU * t) / 0.5 + ph);
    return [
      [base[0] - 12, base[1] + 7 + flap(0.6)],
      [base[0], base[1] + flap(0)],
      [base[0] + 12, base[1] + 7 + flap(1.2)],
    ];
  }),

  motion('rain', 'Rain', CAT, 3.2, (t) =>
    trio((k) => {
      const u = frac(t / 1 + k * 0.37);
      const x = [18, 32, 46][k] ?? C;
      const y = lerp(4, 50, easeIn(u));
      const w = DOT_W * 0.7 * smooth(seg(u, 0, 0.1)) * (1 - smooth(seg(u, 0.88, 1)));
      return capsule([x + 4 * u, y], 80, 2 + 9 * u, k, { width: w, teleport: true });
    }),
  ),

  motion('bubbles', 'Bubbles', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 2.6 + k / 3);
      const x = [20, 32, 44][k] ?? C;
      const y = lerp(54, 10, u);
      const w = (5 + 8 * u) * smooth(seg(u, 0, 0.1)) * (1 - smooth(seg(u, 0.9, 0.97)));
      return dot([x + 3 * Math.sin(TAU * 2 * u + k), y], k, {
        width: w,
        teleport: true,
        opacity: 0.7 + 0.3 * u,
      });
    }),
  ),

  motion('snowfall', 'Snowfall', CAT, 3.8, (t) =>
    trio((k) => {
      const u = frac(t / 4 + k / 3);
      const x = [20, 34, 46][k] ?? C;
      const w = 7 * Math.min(1, smooth(u / 0.1), smooth((1 - u) / 0.1));
      return dot([x + 6 * Math.sin(TAU * 1.5 * u + k * 2), lerp(6, 56, u)], k, {
        width: w,
        teleport: true,
      });
    }),
  ),

  dots3('inchworm', 'Inchworm', CAT, 3.6, (t) => {
    const step = 8;
    const n = Math.floor(t / 0.9);
    const u = frac(t / 0.9);
    const cycle = n % 6;
    const dir = cycle < 3 ? 1 : -1;
    const done = cycle < 3 ? cycle : 6 - cycle;
    const base = 16 + done * step;
    const head =
      base + 16 + (dir > 0 ? easeInOut(seg(u, 0, 0.5)) * step : -easeInOut(seg(u, 0.5, 1)) * step);
    const tail =
      base + (dir > 0 ? easeInOut(seg(u, 0.5, 1)) * step : -easeInOut(seg(u, 0, 0.5)) * step);
    const gap = head - tail;
    const arch = Math.max(0, 16 - gap) * 1.4;
    return [
      [tail, 42],
      [(head + tail) / 2, 42 - arch],
      [head, 42],
    ];
  }),

  motion('frog-hop', 'Frog and lily pads', CAT, 3.4, (t) => {
    const u = frac(t / 1);
    const right = Math.floor(t) % 2 === 0;
    const from = right ? 18 : 46;
    const to = right ? 46 : 18;
    const air = seg(u, 0.25, 0.8);
    const x = lerp(from, to, easeInOut(air));
    const y = 38 - 22 * Math.sin(PI * air);
    const squash = 1 - Math.min(1, Math.abs(u - 0.15) * 8);
    const padBob = (px: number): number => 0.8 * Math.sin(t * 4 + px);
    return [
      capsule([x, y + 2 * squash], 0, 5 * squash, 0, { width: DOT_W * (1 - 0.1 * squash) }),
      capsule([18, 45 + padBob(18)], 0, 9, 1, { width: 4.5 }),
      capsule([46, 45 + padBob(46)], 0, 9, 2, { width: 4.5 }),
    ];
  }),

  dots3('jellyfish', 'Jellyfish', CAT, 3.6, (t) => {
    const u = frac(t / 1.8);
    const squeeze = u < 0.25 ? smooth(u / 0.25) : 1 - smooth(seg(u, 0.25, 1));
    const rise = 6 * (u < 0.35 ? easeOutBack(u / 0.35) : 1 - easeInOut(seg(u, 0.35, 1)));
    const spread = 13 - 7 * squeeze;
    const cy = 36 - rise;
    return [
      [C - spread, cy + 4 * squeeze],
      [C, cy - 6],
      [C + spread, cy + 4 * squeeze],
    ];
  }),

  motion('popcorn', 'Popcorn', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 1.6 + k * 0.33);
      const x = [20, 32, 44][k] ?? C;
      const pop = seg(u, 0.3, 0.9);
      const h = pop > 0 ? 4 * pop * (1 - pop) : 0;
      const wiggle = u < 0.3 ? 1.2 * Math.sin(t * 40 + k) * seg(u, 0.1, 0.3) : 0;
      const w = u < 0.3 ? 7 : 7 + 4 * Math.sin(PI * pop);
      return smeared(() => [x + wiggle, 46 - 30 * h], 0, k, { amount: 0, width: w });
    }),
  ),

  motion('firefly-sync', 'Fireflies in sync', CAT, 4, (t) => {
    const cycle = frac(t / 8);
    const sync = smooth(seg(cycle, 0.05, 0.7));
    return trio((k) => {
      const phase = (1 - sync) * k * 2.1;
      const glow = Math.max(0, Math.sin((TAU * t) / 1.2 + phase)) ** 3;
      const p = polar(13, 120 * k + 15 * Math.sin(t * 0.7 + k), C, C);
      return dot([p[0] + 2 * wander(t, k), p[1] + 2 * wander(t, k + 5)], k, {
        width: 5 + 7 * glow,
        opacity: 0.3 + 0.7 * glow,
      });
    });
  }),

  motion('dandelion', 'Dandelion seeds', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 3 + k / 3);
      const x = lerp(6, 58, u);
      const y = 40 - 18 * u + 4 * Math.sin(TAU * 2 * u + k);
      const w = 7 * Math.min(1, smooth(u / 0.08), smooth((1 - u) / 0.08));
      return capsule([x, y], 90 + 25 * Math.sin(TAU * 3 * u), 3, k, { width: w, teleport: true });
    }),
  ),

  dots3(
    'heartbeat-trio',
    'Heartbeat',
    CAT,
    3.2,
    (t) => {
      const p = frac(t / 1);
      const lub = Math.max(0, Math.cos(TAU * (p - 0.08) * 4)) * (p < 0.2 ? 1 : 0);
      const dub = Math.max(0, Math.cos(TAU * (p - 0.3) * 4)) * (p > 0.2 && p < 0.42 ? 1 : 0);
      const k = 1 - 0.25 * lub - 0.15 * dub;
      return [polar(13 * k, -90), polar(13 * k, 30), polar(13 * k, 150)];
    },
    {
      widths: (t) => {
        const p = frac(t);
        const b =
          Math.max(0, 1 - Math.abs(p - 0.1) * 8) + 0.6 * Math.max(0, 1 - Math.abs(p - 0.3) * 8);
        return [DOT_W + 3 * b, DOT_W + 3 * b, DOT_W + 3 * b];
      },
    },
  ),

  motion('tadpoles', 'Tadpoles', CAT, 3.6, (t) =>
    trio((k) => {
      const a = (360 * t) / 3 + 120 * k;
      const p = polar(14 + 2 * Math.sin(t * 2 + k), a);
      const heading = a + 90;
      return capsule(p, heading + 25 * Math.sin(t * 14 + k), 7, k, { width: 7 });
    }),
  ),

  motion('sunflower', 'Sunflower growth', CAT, 3.8, (t) =>
    trio((k) => {
      const life = t / 1.1 + k / 3;
      const u = frac(life / 3);
      const n = Math.floor(life / 3) * 3 + k;
      const r = 22 * Math.sqrt(u);
      const th = 137.508 * n + 20 * t;
      const w = (4 + 7 * u) * smooth(seg(u, 0, 0.1)) * (1 - smooth(seg(u, 0.85, 1)));
      return dot(polar(r, th), k, { width: w, teleport: true });
    }),
  ),

  motion('ant-trail', 'Ant trail', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 3 - k * 0.12);
      const x = lerp(4, 60, u);
      const y = C + 8 * Math.sin(TAU * 1.3 * u) + 1.5 * Math.abs(Math.sin(t * 12 + k));
      const w = 7 * Math.min(1, smooth(u / 0.08), smooth((1 - u) / 0.08));
      return capsule(
        [x, y],
        Math.atan2(8 * TAU * 1.3 * Math.cos(TAU * 1.3 * u), 56) * (180 / PI),
        4,
        k,
        { width: w, teleport: true },
      );
    }),
  ),
] as const;
