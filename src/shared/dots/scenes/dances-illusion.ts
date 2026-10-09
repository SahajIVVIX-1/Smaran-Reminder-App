/** Dances · Illusions — "how is that even possible?" */
import {
  C,
  DOT_W,
  PI,
  TAU,
  dot,
  dots3,
  ellipse,
  frac,
  lerp,
  line,
  motion,
  path,
  polar,
  project,
  rotX,
  rotY,
  seg,
  smooth,
  trio,
  wander,
  type P3,
  type Pt,
} from './kit';

const CAT = 'Illusions';

const proj3 = (p: P3, k: 0 | 1 | 2, size = DOT_W, extra: { opacity?: number } = {}) => {
  const r = project(p);
  return dot(r.pt, k, { width: size * r.s, z: r.depth, ...extra });
};

export const ILLUSION_DANCES = [
  // three dots that only ever move in straight lines — yet together they roll around a circle
  dots3(
    'tusi-couple',
    'Tusi couple',
    CAT,
    3.6,
    (t) => {
      const w = (TAU * t) / 2.4;
      const p = (k: number): Pt => {
        const a = (k * PI) / 3;
        const d = 16 * Math.cos(w - a);
        return [C + d * Math.cos(a), C + d * Math.sin(a)];
      };
      return [p(0), p(1), p(2)];
    },
    { smear: 0 },
  ),

  // they bounce off each other… but the colours make it look like they pass straight through
  motion(
    'ghost-pass',
    'Ghost pass-through',
    CAT,
    3.6,
    (t) => {
      const n = Math.floor(t / 2 + 0.5);
      const u = frac(t / 2);
      const d = 15 * smooth(Math.abs(2 * u - 1)) ** 1.4 + 1;
      const swapped = n % 2 === 1;
      return [
        dot([C - d, C], 0, { color: swapped ? 'accent' : 'primary' }),
        dot([C + d, C], 1, { color: swapped ? 'primary' : 'accent' }),
        dot([C, 16 + 3 * Math.sin(TAU * u)], 2, { width: 6, color: 'accent2' }),
      ];
    },
    'slot',
  ),

  motion(
    'portal',
    'Portal',
    CAT,
    3.6,
    (t) => {
      const u = frac(t / 1.8);
      const x = lerp(14, 50, u);
      const w = DOT_W * Math.min(1, smooth((x - 14) / 7), smooth((50 - x) / 7));
      const y = C + 7 * Math.sin(TAU * u);
      const glow = 0.75 + 0.25 * Math.sin((TAU * t) / 0.9);
      return [
        path(ellipse(14, C, 3.5, 12), 0, { color: 'accent', width: 4, opacity: glow }),
        path(ellipse(50, C, 3.5, 12), 1, { color: 'accent2', width: 4, opacity: glow }),
        dot([x, y], 2, { width: w, teleport: true, color: 'primary' }),
      ];
    },
    'slot',
  ),

  motion('infinite-zoom', 'Infinite zoom', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 2.4 + k / 3);
      const r = 26 * u ** 1.8;
      const th = 120 * k + 200 * u + 30 * t;
      const w = (2 + 14 * u) * smooth(seg(u, 0, 0.08)) * (1 - smooth(seg(u, 0.8, 1)));
      return dot(polar(r, th), k, { width: w, teleport: true, z: u });
    }),
  ),

  motion('kinetic-depth', 'Kinetic depth', CAT, 3.6, (t) =>
    trio((k) => {
      const a = (TAU * k) / 3;
      let p: P3 = { x: 15 * Math.cos(a), y: 6 * (k - 1), z: 15 * Math.sin(a) };
      p = rotY(p, 70 * t);
      p = rotX(p, 18 * Math.sin((TAU * t) / 5));
      return proj3(p, k, DOT_W * 1.1);
    }),
  ),

  motion('reflection', 'Reflection', CAT, 3.4, (t) => {
    const u = frac(t / 1.4);
    const h = 4 * u * (1 - u);
    const x = C + 10 * Math.sin((TAU * t) / 2.8);
    const y = 34 - 24 * h;
    const ripple = Math.max(0, 1 - h * 4);
    const wobble = 1.2 * Math.sin(t * 9);
    return [
      dot([x, y], 0),
      dot([x + wobble, 76 - y], 1, { opacity: 0.35, color: 'primary' }),
      path(
        line(
          [10, 38],
          [x - 6 - 3 * ripple, 38 + ripple],
          [x, 38 - ripple * 0.5],
          [x + 6 + 3 * ripple, 38 + ripple],
          [54, 38],
        ),
        2,
        { width: 2.5 },
      ),
    ];
  }),

  motion('parallax', 'Parallax depth', CAT, 3.6, (t) =>
    trio((k) => {
      const depth = [0.45, 0.75, 1.15][k] ?? 1;
      const u = frac((t * depth) / 2.4 + k * 0.37);
      const x = lerp(4, 60, u);
      const w = DOT_W * depth * Math.min(1, smooth(u / 0.1), smooth((1 - u) / 0.1));
      return dot([x, C + (k - 1) * 9], k, {
        width: w,
        teleport: true,
        opacity: 0.45 + 0.55 * (depth / 1.15),
        z: depth,
      });
    }),
  ),

  motion('mobius-3d', 'Möbius strip (3D)', CAT, 3.8, (t) =>
    trio((k) => {
      const u = TAU * (t / 3 + k / 3);
      const v = 0.85;
      const R = 13;
      let p: P3 = {
        x: (R + v * 6 * Math.cos(u / 2)) * Math.cos(u),
        y: (R + v * 6 * Math.cos(u / 2)) * Math.sin(u),
        z: v * 6 * Math.sin(u / 2),
      };
      p = rotX(p, 62);
      p = rotY(p, 12 * Math.sin((TAU * t) / 6));
      return proj3(p, k);
    }),
  ),

  motion('trefoil-3d', 'Trefoil knot (3D)', CAT, 3.8, (t) =>
    trio((k) => {
      const s = TAU * (t / 3.4 + k / 3);
      let p: P3 = {
        x: 5.2 * (Math.sin(s) + 2 * Math.sin(2 * s)),
        y: 5.2 * (Math.cos(s) - 2 * Math.cos(2 * s)),
        z: -5.2 * Math.sin(3 * s),
      };
      p = rotY(p, 30 * t);
      return proj3(p, k);
    }),
  ),

  motion('dna-helix', 'DNA helix (3D)', CAT, 3.8, (t) =>
    trio((k) => {
      const u = frac(t / 2.2 + (k === 2 ? 0.5 : 0));
      const y = lerp(-26, 26, u);
      const phi = (y / 52) * TAU * 1.2 + (TAU * t) / 2 + (k === 1 ? PI : 0);
      const p: P3 = { x: 12 * Math.cos(phi), y, z: 12 * Math.sin(phi) };
      const fade = Math.min(1, smooth(u / 0.12), smooth((1 - u) / 0.12));
      const r = project(p);
      return dot(r.pt, k, { width: DOT_W * r.s * fade, z: r.depth, teleport: true });
    }),
  ),

  motion('tennis-seam', 'Tennis-ball seam (3D)', CAT, 3.8, (t) =>
    trio((k) => {
      const s = TAU * (t / 3 + k / 3);
      const a = 0.4;
      let p: P3 = {
        x: 16 * (Math.cos(s) * (1 - a) + a * Math.cos(3 * s)),
        y: 16 * (Math.sin(s) * (1 - a) - a * Math.sin(3 * s)),
        z: 16 * 2 * Math.sqrt(a * (1 - a)) * Math.sin(2 * s),
      };
      p = rotX(rotY(p, 25 * t), 20);
      return proj3(p, k);
    }),
  ),

  motion(
    'sundial-shadow',
    'Moving shadow',
    CAT,
    3.6,
    (t) => {
      const a = 180 + 180 * frac(t / 3.6);
      const sun = polar(22, a, C, 44);
      const elev = Math.max(0.12, Math.sin((-a * PI) / 180));
      const up = sun[1] < 44;
      const len = Math.min(18, 7 / Math.tan(Math.asin(Math.min(1, elev))));
      const dir = sun[0] < C ? 1 : -1;
      const sunW = DOT_W * smooth(seg(-Math.sin((a * PI) / 180), 0, 0.15));
      return [
        dot(sun, 0, { color: 'accent2', width: sunW, teleport: true }),
        dot([C, 37], 1, { color: 'primary', width: 9 }),
        path(line([C, 44], [C + dir * len, 44]), 2, {
          color: 'primary',
          width: 4 * (sunW / DOT_W),
          opacity: up ? 0.35 : 0,
          teleport: true,
        }),
      ];
    },
    'slot',
  ),

  motion('magic-swap', 'Magic swap', CAT, 3.6, (t) => {
    const n = Math.floor(t / 1.2);
    const u = frac(t / 1.2);
    const blink = Math.min(smooth(seg(u, 0.72, 0.8)), 1) * (1 - smooth(seg(u, 0.84, 0.95)));
    // positions permute while the dots are invisible
    const perm = [
      [0, 1, 2],
      [2, 0, 1],
      [1, 2, 0],
    ][n % 3] ?? [0, 1, 2];
    const spots: Pt[] = [polar(13, -90), polar(13, 30), polar(13, 150)];
    const swapNow = u > 0.8;
    return trio((k) => {
      const slot = perm[k] ?? k;
      const nextSlot =
        ([
          [0, 1, 2],
          [2, 0, 1],
          [1, 2, 0],
        ][(n + 1) % 3] ?? [0, 1, 2])[k] ?? k;
      const p = spots[swapNow ? nextSlot : slot] ?? [C, C];
      return dot(p, k, {
        width: DOT_W * (1 - blink) * (1 + 0.08 * Math.sin(TAU * u)),
        teleport: true,
      });
    });
  }),

  dots3('kaleidoscope', 'Kaleidoscope', CAT, 3.6, (t) => {
    const lead: Pt = [C + 13 * wander(t * 0.9, 1), C - 4 + 9 * wander(t * 0.9, 2)];
    return [lead, rotate120(lead, 120), rotate120(lead, 240)];
  }),

  motion('orbit-swap-depth', 'Pass behind (3D)', CAT, 3.4, (t) =>
    trio((k) => {
      const s = TAU * (t / 2.4) + (k * TAU) / 3;
      let p: P3 = { x: 17 * Math.sin(s), y: 0, z: 9 * Math.cos(s) };
      p = rotX(p, 10 + 8 * Math.sin((TAU * t) / 4));
      return proj3(p, k, DOT_W * 1.15, { opacity: 0.55 + (0.45 * (Math.cos(s) + 1)) / 2 });
    }),
  ),

  dots3('breathing-square', 'Square that breathes', CAT, 3.4, (t) => {
    // the dots run round a square's corners, but timing makes the square seem to swell
    const p = (k: number): Pt => {
      const s = frac(t / 2.4 + k / 3) * 4;
      const side = Math.floor(s);
      const f = smooth(frac(s));
      const r = 13 + 3 * Math.sin((TAU * t) / 2.4);
      const corners: Pt[] = [
        [C - r, C - r],
        [C + r, C - r],
        [C + r, C + r],
        [C - r, C + r],
      ];
      const a = corners[side % 4] ?? [C, C];
      const b = corners[(side + 1) % 4] ?? [C, C];
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
    };
    return [p(0), p(1), p(2)];
  }),
] as const;

function rotate120(p: Pt, deg: number): Pt {
  const c = Math.cos((deg * PI) / 180);
  const s = Math.sin((deg * PI) / 180);
  return [C + (p[0] - C) * c - (p[1] - C) * s, C + (p[0] - C) * s + (p[1] - C) * c];
}
