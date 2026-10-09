/** Dances · Orbits & space */
import {
  C,
  DOT_W,
  PI,
  TAU,
  add,
  dot,
  dots3,
  frac,
  motion,
  polar,
  project,
  rotPt,
  rotX,
  rotY,
  rotZ,
  seg,
  smooth,
  trio,
  type P3,
  type Pt,
} from './kit';

const CAT = 'Orbits & space';

/** solve Kepler's equation; returns position on an ellipse with focus at the centre */
function kepler(meanAnomaly: number, a: number, e: number, rot: number): Pt {
  let E = meanAnomaly;
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
  const b = a * Math.sqrt(1 - e * e);
  const p: Pt = [C + a * (Math.cos(E) - e), C + b * Math.sin(E)];
  return rotPt(p, rot);
}

const ring3d = (
  t: number,
  k: number,
  tiltX: number,
  spinY: number,
  r: number,
  speed: number,
): { pt: Pt; s: number; depth: number } => {
  const a = (TAU * t) / speed + (TAU * k) / 3;
  let p: P3 = { x: r * Math.cos(a), y: 0, z: r * Math.sin(a) };
  p = rotX(p, tiltX);
  p = rotY(p, spinY);
  return project(p);
};

export const SPACE_DANCES = [
  dots3('orbit', 'Orbit', CAT, 2.4, (t) => {
    const a = (360 * t) / 1.6;
    return [polar(13, a - 90), polar(13, a + 30), polar(13, a + 150)];
  }),

  dots3('counter-orbit', 'Counter orbit', CAT, 2.8, (t) => {
    const a = (360 * t) / 1.8;
    return [polar(15, a), polar(15, a + 180), polar(6, (-360 * t) / 1.1)];
  }),

  dots3(
    'binary-star',
    'Binary star',
    CAT,
    3.2,
    (t) => {
      const bary = polar(7, (360 * t) / 4);
      const spin = (360 * t) / 1.1;
      return [
        polar(6, spin, bary[0], bary[1]),
        polar(6, spin + 180, bary[0], bary[1]),
        polar(20, (-360 * t) / 3),
      ];
    },
    { widths: () => [11, 11, 7] },
  ),

  motion('eclipse-3d', 'Eclipse ring (3D)', CAT, 3, (t) => {
    const f = [0, 1, 2].map((k) => ring3d(t, k, 68, 18 * Math.sin((TAU * t) / 6), 16, 2.6));
    return trio((k) => {
      const r = f[k] ?? { pt: [C, C] as Pt, s: 1, depth: 0 };
      return dot(r.pt, k, { width: DOT_W * 1.15 * r.s, z: r.depth });
    });
  }),

  dots3('kepler', 'Kepler orbits', CAT, 3.4, (t) => {
    const M = (k: number): number => TAU * (t / 3 + k / 3);
    return [kepler(M(0), 15, 0.62, -25), kepler(M(1), 15, 0.62, -25), kepler(M(2), 15, 0.62, -25)];
  }),

  dots3('epicycle', 'Epicycles', CAT, 3, (t) => {
    const p = (k: number): Pt => {
      const a = (360 * t) / 3 + 120 * k;
      const base = polar(12, a);
      return add(base, [5 * Math.cos((-4 * a * PI) / 180), 5 * Math.sin((-4 * a * PI) / 180)]);
    };
    return [p(0), p(1), p(2)];
  }),

  dots3('retrograde', 'Retrograde loops', CAT, 3.6, (t) => {
    const p = (k: number): Pt => {
      const tt = t + k * 2;
      const outer = polar(16, (360 * tt) / 6);
      const inner = polar(7, (360 * tt) / 1.5);
      return [C + (outer[0] - C) - (inner[0] - C) * 0.9, C + (outer[1] - C) - (inner[1] - C) * 0.9];
    };
    return [p(0), p(1), p(2)];
  }),

  motion('slingshot', 'Gravity slingshot', CAT, 3.4, (t) => {
    const e = 1.45;
    const thMax = Math.acos(-1 / e) * 0.93;
    const fly = (phase: number, rot: number, k: 1 | 2) => {
      const u = 2 * frac(t / 2.6 + phase) - 1;
      const th = thMax * Math.sin((PI / 2) * u);
      const r = 7 / (1 + e * Math.cos(th));
      const p = rotPt([C + r * Math.cos(th), C + r * Math.sin(th)], rot);
      const fade = 1 - smooth(seg(Math.abs(u), 0.72, 0.9));
      return dot(p, k, { width: DOT_W * 0.85 * fade, teleport: true });
    };
    const wob: Pt = [C + 0.8 * Math.sin((TAU * t) / 0.9), C + 0.8 * Math.cos((TAU * t) / 1.3)];
    return [dot(wob, 0, { width: 13 }), fly(0, 200, 1), fly(0.5, 20, 2)];
  }),

  dots3('precession', 'Precessing ellipse', CAT, 3.6, (t) => {
    const rot = 40 * t;
    const p = (k: number): Pt => {
      const a = TAU * (t / 1.4 + k / 3);
      return rotPt([C + 16 * Math.cos(a), C + 7 * Math.sin(a)], rot);
    };
    return [p(0), p(1), p(2)];
  }),

  dots3(
    'sun-earth-moon',
    'Sun, earth and moon',
    CAT,
    3.6,
    (t) => {
      const earth = polar(15, (360 * t) / 5);
      const moon = polar(6, (360 * t) / 0.9, earth[0], earth[1]);
      return [[C, C], earth, moon];
    },
    { widths: (t) => [13 + 1.2 * Math.sin((TAU * t) / 1.6), 8, 5] },
  ),

  dots3(
    'comet',
    'Comet pass',
    CAT,
    3.6,
    (t) => [
      kepler(TAU * (t / 3.2), 17, 0.82, 35),
      polar(9, (360 * t) / 2),
      polar(15, (360 * t) / 4.5 + 140),
    ],
    { smear: 2, widths: () => [9, 8, 8] },
  ),

  motion('black-hole', 'Black hole', CAT, 3.6, (t) => {
    return trio((k) => {
      const u = frac(t / 2.4 + k / 3);
      const r = 22 * (1 - u) ** 0.75;
      const th = 120 * k + 900 * u ** 1.6;
      const width = DOT_W * smooth(seg(u, 0, 0.14)) * (1 - u ** 3);
      return dot(polar(r, th), k, { width, teleport: true });
    });
  }),

  motion('gyroscope-3d', 'Gyroscope (3D)', CAT, 3.4, (t) => {
    return trio((k) => {
      const a = TAU * (t / 1.6) + k;
      let p: P3 =
        k === 0
          ? { x: 15 * Math.cos(a), y: 15 * Math.sin(a), z: 0 }
          : k === 1
            ? { x: 15 * Math.cos(a), y: 0, z: 15 * Math.sin(a) }
            : { x: 0, y: 15 * Math.cos(a), z: 15 * Math.sin(a) };
      p = rotY(rotX(p, 25), 40 * t);
      const r = project(p);
      return dot(r.pt, k, { width: DOT_W * r.s, z: r.depth });
    });
  }),

  motion('atom-3d', 'Atom (3D)', CAT, 3.4, (t) => {
    return trio((k) => {
      const a = TAU * (t / 1.3) + (k * TAU) / 3;
      let p: P3 = { x: 17 * Math.cos(a), y: 0, z: 17 * Math.sin(a) };
      p = rotX(p, 72);
      p = rotZ(p, 60 * k + 15 * t);
      const r = project(p);
      return dot(r.pt, k, { width: DOT_W * r.s, z: r.depth });
    });
  }),

  dots3('contact-binary', 'Contact binary', CAT, 3.4, (t) => {
    const a = (360 * t) / 1.7;
    const d = 5.2 + 1.4 * Math.sin((TAU * t) / 3.4);
    return [polar(d, a), polar(d, a + 180), polar(19, (-360 * t) / 4)];
  }),

  motion('galaxy-arms', 'Galaxy arms', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 3 + k / 3);
      const r = 4 + 16 * u;
      const th = 120 * k + 220 * Math.log(1 + 3 * u) + 50 * t;
      const w = DOT_W * smooth(seg(u, 0, 0.12)) * (1 - smooth(seg(u, 0.85, 1)));
      return dot(polar(r, th), k, { width: w, teleport: true });
    }),
  ),
] as const;
