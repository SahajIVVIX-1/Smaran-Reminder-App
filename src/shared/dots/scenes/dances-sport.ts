/** Dances · Juggling & sport */
import {
  DOT_W,
  PI,
  TAU,
  capsule,
  dot,
  dots3,
  easeInOut,
  easeOut,
  frac,
  lerp,
  line,
  motion,
  path,
  rotPt,
  seg,
  smeared,
  smooth,
  tri,
  type Pt,
} from './kit';

const CAT = 'Juggling & sport';

/** heights of a decaying bounce sequence, as a function of local time (0..total) */
const BOUNCE_H = [1, 0.55, 0.3, 0.16, 0.08];
const BOUNCE_T = BOUNCE_H.map((h) => Math.sqrt(h));
const BOUNCE_TOTAL = BOUNCE_T.reduce((a, b) => a + b, 0);
function bounceHeight(x: number): number {
  let tt = frac(x) * BOUNCE_TOTAL;
  for (let i = 0; i < BOUNCE_H.length; i++) {
    const d = BOUNCE_T[i] ?? 1;
    if (tt <= d) {
      const u = tt / d;
      return (BOUNCE_H[i] ?? 0) * 4 * u * (1 - u);
    }
    tt -= d;
  }
  return 0;
}

export const SPORT_DANCES = [
  dots3('juggle', 'Cascade juggle', CAT, 3, (t) => {
    const p = (k: number): Pt => {
      const s = frac(t / 1.5 + k / 3);
      if (s < 0.5) {
        const u = s / 0.5;
        return [18 + 28 * u, 46 - 30 * Math.sin(PI * u)];
      }
      const u = (s - 0.5) / 0.5;
      return [46 - 28 * u, 46 + 2 * Math.sin(PI * u)];
    };
    return [p(0), p(1), p(2)];
  }),

  dots3('shower', 'Shower juggle', CAT, 3, (t) => {
    const p = (k: number): Pt => {
      const s = frac(t / 1.5 + k / 3);
      if (s < 0.75) {
        const u = s / 0.75;
        return [46 - 28 * u, 47 - 34 * Math.sin(PI * u)];
      }
      const u = (s - 0.75) / 0.25;
      return [18 + 28 * easeInOut(u), 47 + 1.5 * Math.sin(PI * u)];
    };
    return [p(0), p(1), p(2)];
  }),

  dots3('columns', 'Columns juggle', CAT, 2.8, (t) => {
    const y = (ph: number): number => {
      const u = frac(t / 1.1 + ph);
      return 48 - 32 * 4 * u * (1 - u);
    };
    return [
      [20, y(0)],
      [32, y(0.5)],
      [44, y(0)],
    ];
  }),

  dots3('yo-yo', 'Yo-yo juggle', CAT, 2.8, (t) => {
    const u = frac(t / 1.2);
    const h = 4 * u * (1 - u);
    const hand = 46 - 5 * Math.sin(TAU * u);
    const v = frac(t / 1.2 + 0.5);
    return [
      [24, 46 - 30 * h],
      [24, hand - 13 - 30 * h * 0.15],
      [40, 46 - 30 * 4 * v * (1 - v)],
    ];
  }),

  dots3(
    'bouncing-balls',
    'Bouncing balls',
    CAT,
    3.6,
    (t) => {
      const y = (k: number): number => 48 - 34 * bounceHeight(t / 2.6 + k / 3);
      return [
        [18, y(0)],
        [32, y(1)],
        [46, y(2)],
      ];
    },
    { smear: 0.7 },
  ),

  motion('pong', 'Pong', CAT, 4, (t) => {
    const ballX = (tt: number): number => 15 + 34 * tri(tt / 1.4);
    const ballY = (tt: number): number => 16 + 32 * tri(tt / 1.05 + 0.2);
    const ball = (tt: number): Pt => [ballX(tt), ballY(tt)];
    // each paddle glides to where the ball will arrive next
    const paddle = (offset: number): number => {
      const n = Math.floor((t - offset) / 1.4);
      const from = ballY(offset + 1.4 * n);
      const to = ballY(offset + 1.4 * (n + 1));
      return lerp(from, to, easeInOut(seg(frac((t - offset) / 1.4), 0.1, 0.85)));
    };
    const yl = paddle(0);
    const yr = paddle(0.7);
    return [
      path(line([10, yl - 6], [10, yl + 6]), 0, { width: 4.5 }),
      smeared(ball, t, 1, { amount: 0.6, width: 7 }),
      path(line([54, yr - 6], [54, yr + 6]), 2, { width: 4.5 }),
    ];
  }),

  dots3('tennis-rally', 'Tennis rally', CAT, 3.6, (t) => {
    const u = frac(t / 1.6);
    const leftward = Math.floor(t / 1.6) % 2 === 1;
    const s = leftward ? 1 - u : u;
    // ball: arc to the bounce point, then a lower arc to the other player
    const x = 16 + 32 * s;
    const yArc =
      s < 0.6 ? 40 - 26 * Math.sin(PI * (s / 0.6)) : 40 - 12 * Math.sin(PI * ((s - 0.6) / 0.4));
    const pl = 38 + 4 * Math.sin((TAU * t) / 1.6);
    const pr = 38 - 4 * Math.sin((TAU * t) / 1.6);
    return [
      [12, pl],
      [x, yArc],
      [52, pr],
    ];
  }),

  dots3(
    'dribble',
    'Dribble',
    CAT,
    3.2,
    (t) => {
      const px = 32 + 11 * Math.sin((TAU * t) / 3.2);
      const u = frac(t / 0.5);
      const ball = 30 + 17 * Math.sin(PI * u) ** 0.7;
      const def = 32 + 11 * Math.sin((TAU * (t - 0.35)) / 3.2);
      return [
        [px, 22],
        [px + 3, ball],
        [def + 4, 12 + 2 * Math.sin((TAU * t) / 0.8)],
      ];
    },
    { smear: 0.5 },
  ),

  motion('see-saw', 'See-saw', CAT, 3.2, (t) => {
    const a = 16 * Math.sin((TAU * t) / 1.8);
    const left = rotPt([14, 42], a, 32, 42);
    const right = rotPt([50, 42], a, 32, 42);
    const hopL = 7 * Math.max(0, Math.sin((TAU * t) / 1.8)) ** 3;
    const hopR = 7 * Math.max(0, -Math.sin((TAU * t) / 1.8)) ** 3;
    const n: Pt = [Math.sin((a * PI) / 180), -Math.cos((a * PI) / 180)];
    return [
      dot([left[0] + n[0] * (6 + hopL), left[1] + n[1] * (6 + hopL)], 0, { width: 9 }),
      path(line(left, right), 1, { width: 4 }),
      dot([right[0] + n[0] * (6 + hopR), right[1] + n[1] * (6 + hopR)], 2, { width: 9 }),
    ];
  }),

  dots3('billiards', 'Billiards break', CAT, 3.6, (t) => {
    const u = frac(t / 3);
    const hit = 0.22;
    const cue: Pt =
      u < hit
        ? [lerp(10, 26, easeInOut(u / hit)), 32]
        : u < 0.6
          ? [lerp(26, 30, easeOut(seg(u, hit, 0.6))), 32]
          : [lerp(30, 10, easeInOut(seg(u, 0.65, 1))), 32];
    const scatter = easeOut(seg(u, hit, 0.6));
    const back = easeInOut(seg(u, 0.65, 1));
    const b1: Pt = [lerp(lerp(36, 50, scatter), 36, back), lerp(lerp(28, 14, scatter), 28, back)];
    const b2: Pt = [lerp(lerp(36, 52, scatter), 36, back), lerp(lerp(36, 48, scatter), 36, back)];
    return [cue, b1, b2];
  }),

  motion('trampoline', 'Trampoline', CAT, 3.2, (t) => {
    const jump = (ph: number): { y: number; sag: number } => {
      const u = frac(t / 1.3 + ph);
      if (u < 0.82) {
        const v = u / 0.82;
        return { y: 41 - 30 * 4 * v * (1 - v), sag: 0 };
      }
      const v = (u - 0.82) / 0.18;
      const sag = 7 * Math.sin(PI * v);
      return { y: 41 + sag, sag };
    };
    const a = jump(0);
    const b = jump(0.5);
    const bed = line([10, 46], [24, 46 + a.sag], [40, 46 + b.sag], [54, 46]);
    return [dot([24, a.y], 0), path(bed, 1, { width: 4 }), dot([40, b.y], 2)];
  }),

  motion('curling', 'Curling', CAT, 3.6, (t) => {
    const u = frac(t / 3.2);
    const slide = easeOut(seg(u, 0, 0.8));
    const back = easeInOut(seg(u, 0.84, 1));
    const sx = lerp(lerp(12, 46, slide), 12, back);
    const curl = 5 * Math.sin(PI * slide) * (1 - back);
    const stone: Pt = [sx, 34 + curl];
    const sweep = (1 - slide) * (1 - back);
    const fast = Math.sin((TAU * t) / 0.18);
    return [
      dot(stone, 0, { width: 11 }),
      capsule([sx + 8, 26 + curl], 90 + 30 * fast * sweep, 6, 1, { width: 5 }),
      capsule([sx + 8, 42 + curl], 90 - 30 * fast * sweep, 6, 2, { width: 5 }),
    ];
  }),

  motion('hopscotch', 'Hopscotch', CAT, 3.2, (t) => {
    const n = Math.floor(t / 0.6);
    const u = frac(t / 0.6);
    const spots = [14, 26, 38, 50, 38, 26];
    const from = spots[n % spots.length] ?? 14;
    const to = spots[(n + 1) % spots.length] ?? 26;
    const x = lerp(from, to, easeInOut(u));
    const y = 42 - 14 * Math.sin(PI * u);
    const squash = Math.max(0, 1 - u * 6) + Math.max(0, (u - 0.85) * 6);
    return [
      capsule([x, y], 0, 6 * squash, 0, { width: DOT_W * (1 - 0.15 * squash) }),
      capsule([20, 48], 0, 6, 1, { width: 4 }),
      capsule([44, 48], 0, 6, 2, { width: 4 }),
    ];
  }),

  dots3(
    'keepy-uppy',
    'Keepy-uppy',
    CAT,
    3.2,
    (t) => {
      const u = frac(t / 0.9);
      const kicker = Math.floor(t / 0.9) % 2;
      const ball = 44 - 28 * 4 * u * (1 - u);
      const bx = lerp(kicker ? 38 : 26, kicker ? 26 : 38, u);
      const lift = (k: number): number => (kicker === k ? 3 * Math.max(0, 1 - u * 5) : 0);
      return [
        [26, 50 - lift(0)],
        [bx, ball],
        [38, 50 - lift(1)],
      ];
    },
    { smear: 0.6 },
  ),

  motion('golf-putt', 'Golf putt', CAT, 3.6, (t) => {
    const u = frac(t / 3);
    const swing = u < 0.25 ? -35 * Math.sin(PI * (u / 0.25)) * (u < 0.125 ? 1 : 1) : 0;
    const roll = easeOut(seg(u, 0.2, 0.72));
    const sink = seg(u, 0.72, 0.8);
    const bx = lerp(20, 46, roll);
    const ballW = DOT_W * 0.75 * (1 - smooth(sink)) * smooth(seg(u, 0, 0.06));
    return [
      capsule(rotPt([16, 34], swing, 16, 22), 90 + swing, 12, 0, { width: 4.5 }),
      dot([bx, 42 + 1.5 * smooth(sink)], 1, { width: ballW, teleport: true }),
      capsule([46, 45], 0, 7, 2, { width: 4 }),
    ];
  }),
] as const;
