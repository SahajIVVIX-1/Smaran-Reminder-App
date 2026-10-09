/** Dances · Loaders & UI */
import {
  C,
  DOT_W,
  PI,
  TAU,
  arc,
  circle,
  dot,
  dots3,
  easeInOut,
  easeOut,
  frac,
  hump,
  line,
  motion,
  path,
  polar,
  seg,
  smooth,
  tf,
  trio,
  wander,
  type Pt,
} from './kit';

const CAT = 'Loaders & UI';
const ROW = [20, 32, 44] as const;

/** an ECG trace value at x in [0,1) */
const ecg = (x: number): number => {
  const f = frac(x);
  if (f > 0.42 && f < 0.46) return -((f - 0.42) / 0.04) * 3;
  if (f >= 0.46 && f < 0.5) return -3 + ((f - 0.46) / 0.04) * 21;
  if (f >= 0.5 && f < 0.54) return 18 - ((f - 0.5) / 0.04) * 24;
  if (f >= 0.54 && f < 0.58) return -6 + ((f - 0.54) / 0.04) * 6;
  if (f > 0.68 && f < 0.82) return -4 * Math.sin(PI * ((f - 0.68) / 0.14));
  return 0;
};

export const LOADER_DANCES = [
  dots3('bounce', 'Typing bounce', CAT, 2.4, (t) => {
    const y = (k: number): number =>
      C - 9 * Math.max(0, Math.sin(TAU * (t / 1.0 - k * 0.15))) ** 1.5;
    return [
      [ROW[0], y(0)],
      [ROW[1], y(1)],
      [ROW[2], y(2)],
    ];
  }),

  dots3('wave', 'Wave', CAT, 2.2, (t) => {
    const y = (k: number): number => C + 7 * Math.sin(TAU * (t / 1.1) - k * 0.9);
    return [
      [ROW[0], y(0)],
      [ROW[1], y(1)],
      [ROW[2], y(2)],
    ];
  }),

  dots3('spiral', 'Spiral', CAT, 2.8, (t) => {
    const p = frac(t / 2.8);
    const r = 4 + 13 * hump(p);
    const a = 720 * p;
    return [polar(r, a - 90), polar(r, a + 30), polar(r, a + 150)];
  }),

  dots3('triangle-spin', 'Triangle spin', CAT, 2.6, (t) => {
    const r = 12 + 3 * Math.sin((TAU * t) / 1.3);
    const a = 120 * easeInOut(frac(t / 1.3)) + 120 * Math.floor(t / 1.3);
    return [polar(r, a - 90), polar(r, a + 30), polar(r, a + 150)];
  }),

  dots3('merge-split', 'Merge and split', CAT, 2.4, (t) => {
    const p = frac(t / 1.6);
    const r = 15 * (1 - easeInOut(hump(p)) * 0.92);
    const a = 40 * t;
    return [polar(r, a - 90), polar(r, a + 30), polar(r, a + 150)];
  }),

  dots3('figure-eight', 'Figure eight', CAT, 2.8, (t) => {
    const p = (k: number): Pt => {
      const th = (TAU * t) / 2.2 - k * 0.75;
      return [C + 17 * Math.sin(th), C + 9 * Math.sin(2 * th)];
    };
    return [p(0), p(1), p(2)];
  }),

  motion('progress-bar', 'Indeterminate progress', CAT, 3.4, (t) => {
    const u = frac(t / 1.8);
    const head = 12 + 40 * easeInOut(seg(u, 0, 0.6));
    const tail = 12 + 40 * easeInOut(seg(u, 0.35, 1));
    const vis = smooth(seg(u, 0, 0.06)) * (1 - smooth(seg(u, 0.92, 1)));
    return [
      path(line([12, C], [52, C]), 0, { width: 6, opacity: 0.18 }),
      path(line([tail, C], [Math.max(head, tail + 0.01), C]), 1, {
        width: 6 * vis,
        teleport: true,
      }),
      dot([head, C], 2, { width: 9 * vis, teleport: true }),
    ];
  }),

  motion('material-spinner', 'Material spinner', CAT, 3.4, (t) => {
    const u = frac(t / 1.4);
    const rot = (360 * t) / 2 + 270 * Math.floor(t / 1.4);
    const head = 280 * easeInOut(seg(u, 0, 0.5));
    const tail = 280 * easeInOut(seg(u, 0.5, 1));
    const a0 = rot + tail;
    const a1 = rot + Math.max(head, tail + 12);
    return [
      path(arc(C, C, 15, a0, a1, 40), 0, { width: 5.5 }),
      dot(polar(15, a1), 1, { width: 7.5 }),
      dot(polar(15, a0), 2, { width: 6 }),
    ];
  }),

  motion('equalizer', 'Equalizer', CAT, 3.2, (t) =>
    trio((k) => {
      const h = 6 + 24 * Math.abs(wander(t * 2.2, k * 5 + 1));
      return path(line([ROW[k], 46], [ROW[k], 46 - h]), k, { width: 7 });
    }),
  ),

  motion('snake', 'Snake', CAT, 4, (t) => {
    const n = Math.floor(t / 1.6);
    const u = frac(t / 1.6);
    const head = 360 * (t / 1.6);
    // grows by one apple per lap for five laps, then smoothly shrinks back
    const lap = n % 6;
    const len = lap < 5 ? 40 + 25 * lap + 25 * easeOut(seg(u, 0.85, 1)) : 165 - 125 * easeInOut(u);
    const appleAngle = 360 * (n + 1) - 6;
    const appleW =
      lap < 5 ? DOT_W * 0.75 * (1 - smooth(seg(u, 0.85, 0.95))) * smooth(seg(u, 0, 0.15)) : 0;
    return [
      path(arc(C, C, 15, head - len, head, 48), 0, { width: 6 }),
      dot(polar(15, appleAngle), 1, { width: appleW, teleport: true, color: 'alert' }),
      dot(polar(15, head + 2), 2, { width: 8 }),
    ];
  }),

  motion('ecg', 'Heart monitor', CAT, 3.6, (t) => {
    const scroll = t / 1.2;
    const pts: Pt[] = [];
    for (let i = 0; i <= 60; i++) {
      const x = 10 + (44 * i) / 60;
      pts.push([x, C - ecg(i / 60 - scroll + 1)]);
    }
    const headY = C - ecg(1 - scroll + 1);
    const beat = ecg(1 - scroll + 1) > 8 ? 1 : 0;
    return [
      path(pts, 0, { width: 3 }),
      dot([54, headY], 1, { width: 7 + 2 * beat }),
      dot([54, headY], 2, { width: 0, opacity: 0 }),
    ];
  }),

  dots3(
    'gooey-chase',
    'Gooey chase',
    CAT,
    3.4,
    (t) => {
      const base = (360 * t) / 1.6;
      const spacing = 8 + 52 * hump(t / 2.4);
      return [polar(14, base), polar(14, base - spacing), polar(14, base - 2 * spacing)];
    },
    { smear: 0.3 },
  ),

  dots3(
    'amoeba',
    'Amoeba',
    CAT,
    3.6,
    (t) => {
      const p = (k: number): Pt =>
        polar(4.5 + 2.5 * wander(t * 1.5, k), 120 * k + 40 * t + 30 * wander(t, k + 3));
      return [p(0), p(1), p(2)];
    },
    {
      smear: 0,
      widths: (t) => [
        13 + 2 * Math.sin(t * 2),
        12 + 2 * Math.sin(t * 2.3 + 1),
        13 + 2 * Math.sin(t * 1.7 + 2),
      ],
    },
  ),

  motion('ripples', 'Ripples', CAT, 3.2, (t) => {
    const ring = (ph: number, k: 0 | 1) => {
      const u = frac(t / 1.6 + ph);
      return path(circle(C, C, 4 + 22 * easeOut(u)), k, {
        width: (3.5 * (1 - u) + 0.5) * (1 - smooth(seg(u, 0.88, 1))),
        opacity: 1 - u,
        teleport: true,
      });
    };
    return [ring(0, 0), ring(0.5, 1), dot([C, C], 2, { width: 8 + 2 * Math.sin((TAU * t) / 0.8) })];
  }),

  motion('metronome', 'Metronome', CAT, 3.4, (t) => {
    const a = 28 * Math.sin((TAU * t) / 1.2);
    const tip = polar(30, -90 + a, C, 52);
    const weight = polar(18, -90 + a, C, 52);
    const tick = Math.max(0, Math.abs(Math.sin((TAU * t) / 1.2)) - 0.9) * 10;
    return [
      path(line([C, 52], tip), 0, { width: 3.5 }),
      dot(weight, 1, { width: 9 }),
      dot([tip[0] < C ? 12 : 52, 18], 2, { width: 7 * tick, teleport: true }),
    ];
  }),

  motion('pulse-row', 'Pulse row', CAT, 2.8, (t) =>
    trio((k) => {
      const b = Math.max(0, Math.sin(TAU * (t / 1.2 - k * 0.18))) ** 4;
      return dot([ROW[k], C], k, { width: 6 + 7 * b, opacity: 0.45 + 0.55 * b });
    }),
  ),

  motion('ink-ring', 'Ink ring', CAT, 3.4, (t) => {
    const u = frac(t / 2);
    const head = 360 * easeInOut(seg(u, 0, 0.6));
    const tail = 360 * easeInOut(seg(u, 0.4, 1));
    const rot = 90 * Math.floor(t / 2) + 45 * u;
    const ring = tf.trim(arc(C, C, 15, -90, 270, 90), tail / 360, Math.max(head, tail + 3) / 360);
    return [
      path(tf.rotate(ring, rot), 0, { width: 4.5 }),
      dot(polar(15, -90 + rot + Math.max(head, tail + 3)), 1, { width: 8 }),
      dot([C, C], 2, { width: 6 + 4 * Math.sin(PI * u) }),
    ];
  }),
] as const;
