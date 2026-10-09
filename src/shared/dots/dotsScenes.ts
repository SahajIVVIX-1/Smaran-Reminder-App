/**
 * Scenes for the three Smaran dots.
 *
 *  - "dance" scenes: three round dots moving around each other
 *    (shuffle, orbit, bounce, juggle…). Each dot keeps its own colour.
 *  - "shape" scenes: the three dots stretch and flow into the three strokes
 *    of a small icon (pen, bell, clock…), which keeps gently moving.
 *
 * A scene is a pure function of time → three stroke targets. The engine
 * makes every change between scenes continuous.
 */

import {
  CX,
  CY,
  N,
  TAU,
  arc,
  circle,
  clamp01,
  cubic,
  dotPts,
  easeInOut,
  frac,
  hump,
  join,
  line,
  polar,
  resample,
  rotate,
  scale,
  translate,
  type Pt,
} from './dotsGeometry';

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
  /** stroke width in the 64×64 box (a dot's diameter when all points coincide) */
  width: number;
  color: ColorToken;
}

export type Frame = readonly [StrokeTarget, StrokeTarget, StrokeTarget];

export type SceneKind = 'dance' | 'shape';

export interface DotsScene {
  readonly key: string;
  readonly name: string;
  readonly kind: SceneKind;
  /** how long auto mode stays on this scene, seconds */
  readonly hold: number;
  /** t = seconds since the scene started (speed-scaled) */
  readonly frame: (t: number) => Frame;
}

export const DOT_W = 10;
export const LINE_W = 5;

// ── helpers ─────────────────────────────────────────────────────────────────

const ROW = [20, 32, 44] as const;

const dot = (p: Pt, i: 0 | 1 | 2, width = DOT_W): StrokeTarget => ({
  pts: dotPts(p[0], p[1]),
  width,
  color: DOT_IDENTITY[i],
});

const dance = (
  key: string,
  name: string,
  hold: number,
  pos: (t: number) => readonly [Pt, Pt, Pt],
): DotsScene => ({
  key,
  name,
  kind: 'dance',
  hold,
  frame: (t) => {
    const [a, b, c] = pos(t);
    return [dot(a, 0), dot(b, 1), dot(c, 2)];
  },
});

const stroke = (pts: ReadonlyArray<Pt>, color: ColorToken, width = LINE_W): StrokeTarget => ({
  pts: resample(pts, N),
  width,
  color,
});

const still = (p: Pt, color: ColorToken, width = DOT_W * 0.8): StrokeTarget => ({
  pts: dotPts(p[0], p[1]),
  width,
  color,
});

/** apply a transform to all three strokes */
const mapFrame = (f: Frame, fn: (pts: Pt[]) => Pt[]): Frame => [
  { ...f[0], pts: fn(f[0].pts) },
  { ...f[1], pts: fn(f[1].pts) },
  { ...f[2], pts: fn(f[2].pts) },
];

const breathe = (t: number, amount = 0.025, period = 3): number =>
  1 + amount * Math.sin((TAU * t) / period);

// ── dances ──────────────────────────────────────────────────────────────────

/** shell-game shuffle: pairs swap places along arcs (one over, one under) */
const SWAPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [0, 2],
];
const SWAP_T = 0.55;
function shufflePositions(t: number): readonly [Pt, Pt, Pt] {
  const step = Math.floor(t / SWAP_T);
  const u = easeInOut(frac(t / SWAP_T));
  // slotOf[dot] after `step` completed swaps (the full pattern repeats every 6 swaps)
  const slotOf = [0, 1, 2];
  for (let s = 0; s < step % 6; s++) {
    const [a, b] = SWAPS[s % 3] ?? [0, 1];
    for (let d = 0; d < 3; d++) {
      if (slotOf[d] === a) slotOf[d] = b;
      else if (slotOf[d] === b) slotOf[d] = a;
    }
  }
  const [sa, sb] = SWAPS[step % 3] ?? [0, 1];
  const out = slotOf.map((slot) => {
    const x0 = ROW[slot as 0 | 1 | 2];
    if (slot === sa || slot === sb) {
      const toSlot = slot === sa ? sb : sa;
      const x1 = ROW[toSlot as 0 | 1 | 2];
      const over = slot === sa ? -1 : 1;
      return [x0 + (x1 - x0) * u, CY + over * 10 * Math.sin(Math.PI * u)] as const;
    }
    return [x0, CY] as const;
  });
  return [out[0] ?? [CX, CY], out[1] ?? [CX, CY], out[2] ?? [CX, CY]];
}

export const DANCES: readonly DotsScene[] = [
  dance('shuffle', 'Shell shuffle', SWAP_T * 6, shufflePositions),

  dance('orbit', 'Orbit', 2.4, (t) => {
    const a = (360 * t) / 1.6;
    return [polar(13, a - 90), polar(13, a + 30), polar(13, a + 150)];
  }),

  dance('bounce', 'Typing bounce', 2.4, (t) => {
    const y = (k: number): number =>
      CY - 9 * Math.max(0, Math.sin(TAU * (t / 1.0 - k * 0.15))) ** 1.5;
    return [
      [ROW[0], y(0)],
      [ROW[1], y(1)],
      [ROW[2], y(2)],
    ];
  }),

  dance('figure-eight', 'Figure eight', 2.8, (t) => {
    const p = (k: number): Pt => {
      const th = (TAU * t) / 2.2 - k * 0.75;
      return [CX + 17 * Math.sin(th), CY + 9 * Math.sin(2 * th)];
    };
    return [p(0), p(1), p(2)];
  }),

  dance('juggle', 'Juggle', 3, (t) => {
    const p = (k: number): Pt => {
      const s = frac(t / 1.5 + k / 3);
      if (s < 0.5) {
        const u = s / 0.5;
        return [18 + 28 * u, 46 - 30 * Math.sin(Math.PI * u)];
      }
      const u = (s - 0.5) / 0.5;
      return [46 - 28 * u, 46 + 2 * Math.sin(Math.PI * u)];
    };
    return [p(0), p(1), p(2)];
  }),

  dance('merge-split', 'Merge and split', 2.4, (t) => {
    const p = frac(t / 1.6);
    const r = 15 * (1 - easeInOut(hump(p)) * 0.92);
    const a = 40 * t;
    return [polar(r, a - 90), polar(r, a + 30), polar(r, a + 150)];
  }),

  dance('triangle-spin', 'Triangle spin', 2.6, (t) => {
    const r = 12 + 3 * Math.sin((TAU * t) / 1.3);
    const a = 120 * easeInOut(frac(t / 1.3)) + 120 * Math.floor(t / 1.3);
    return [polar(r, a - 90), polar(r, a + 30), polar(r, a + 150)];
  }),

  dance('cradle', "Newton's cradle", 2.4, (t) => {
    const s = Math.sin((TAU * t) / 1.2);
    const left = Math.max(0, -s);
    const right = Math.max(0, s);
    return [
      [ROW[0] - 9 * left, CY - 5 * left * left],
      [ROW[1], CY],
      [ROW[2] + 9 * right, CY - 5 * right * right],
    ];
  }),

  dance('spiral', 'Spiral', 2.8, (t) => {
    const p = frac(t / 2.8);
    const r = 4 + 13 * hump(p);
    const a = 720 * p;
    return [polar(r, a - 90), polar(r, a + 30), polar(r, a + 150)];
  }),

  dance('wave', 'Wave', 2.2, (t) => {
    const y = (k: number): number => CY + 7 * Math.sin(TAU * (t / 1.1) - k * 0.9);
    return [
      [ROW[0], y(0)],
      [ROW[1], y(1)],
      [ROW[2], y(2)],
    ];
  }),
];

// ── shapes (built once, animated per frame) ─────────────────────────────────

const S_TOP = resample(arc(32, 22, 10, -30, -270));
const S_BOTTOM = resample(arc(32, 42, 10, -90, 150));

const PEN_BODY = resample(
  line([50.5, 16.5], [26.5, 40.5], [19.5, 33.5], [43.5, 9.5], [50.5, 16.5]),
);
const PEN_NIB = resample(line([26.5, 40.5], [14.5, 49.5], [19.5, 33.5]));

const BELL_DOME = resample(
  join(
    cubic([17, 43], [22, 40], [19, 15], [32, 15]),
    cubic([32, 15], [45, 15], [42, 40], [47, 43]),
  ),
);
const BELL_BASE = resample(line([13, 44], [51, 44]));
const BELL_CLAPPER = resample(arc(32, 48, 4, 0, 180));

const RING = resample(circle(CX, CY, 18));
const CHECK = resample(line([22.5, 33], [29, 39.5], [42, 25.5]));
const CROSS_A = resample(line([24.5, 24.5], [39.5, 39.5]));
const CROSS_B = resample(line([39.5, 24.5], [24.5, 39.5]));

const HEART_L = resample(cubic([32, 49], [13, 36], [14, 13], [32, 22]));
const HEART_R = resample(cubic([32, 49], [51, 36], [50, 13], [32, 22]));

const ENV_BOX = resample(line([13, 20], [51, 20], [51, 46], [13, 46], [13, 20]));
const ENV_FLAP = resample(line([18, 25], [32, 35], [46, 25]));

const CAL_BOX = resample(line([14, 15], [50, 15], [50, 50], [14, 50], [14, 15]));
const CAL_HEAD = resample(line([20, 25.5], [44, 25.5]));
const CAL_DAYS: readonly Pt[] = [
  [23, 34],
  [32, 34],
  [41, 34],
  [23, 42],
  [32, 42],
  [41, 42],
];

// crescent opening to the right: big outer arc, then a shallower inner curve back
const MOON = resample(
  join(arc(30, 32, 17, -70, -290), cubic([35.81, 47.97], [24, 42], [24, 22], [35.81, 16.03])),
);
const ZED = resample(line([42, 8], [50, 8], [42, 16], [50, 16]));

const BULB = resample(join([[27, 41]], arc(32, 26, 13, 135, 405), [[37, 41]]));
const BULB_BASE_A = resample(line([26.5, 45.5], [37.5, 45.5]));
const BULB_BASE_B = resample(line([29, 50.5], [35, 50.5]));

const GLASS = resample(
  line([19, 13], [45, 13], [33.5, 31], [45, 51], [19, 51], [30.5, 31], [19, 13]),
);

const shape = (key: string, name: string, frame: (t: number) => Frame, hold = 3.2): DotsScene => ({
  key,
  name,
  kind: 'shape',
  hold,
  frame,
});

/** smooth periodic bump used for heartbeats */
const beat = (p: number, c: number, w: number): number => {
  let d = p - c;
  d -= Math.round(d);
  return Math.abs(d) < w ? 0.5 + 0.5 * Math.cos((Math.PI * d) / w) : 0;
};

export const SHAPES: readonly DotsScene[] = [
  shape('s-mark', 'Smaran "S"', (t) =>
    mapFrame(
      [
        stroke(S_TOP, 'primary'),
        stroke(S_BOTTOM, 'primary'),
        still(polar(25, -45), 'accent', DOT_W),
      ],
      (p) => scale(p, breathe(t)),
    ),
  ),

  shape('pen', 'Pen writing', (t) => {
    const phase = (TAU * t) / 1.4;
    const wave: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = 27 + (25 * i) / 40;
      wave.push([x, 54 + 2.2 * Math.sin((i / 40) * 3 * Math.PI - phase)]);
    }
    const nibWiggle = 1.2 * Math.sin(phase);
    return [
      stroke(translate(PEN_BODY, nibWiggle, 0), 'primary'),
      stroke(translate(PEN_NIB, nibWiggle, 0), 'accent'),
      stroke(wave, 'accent2', LINE_W * 0.9),
    ];
  }),

  shape('bell', 'Bell', (t) => {
    const sw = 5 * Math.sin((TAU * t) / 2.4);
    const r = (p: Pt[]): Pt[] => rotate(p, sw, 32, 11);
    return [
      stroke(r(BELL_DOME), 'primary'),
      stroke(r(BELL_BASE), 'primary'),
      stroke(rotate(BELL_CLAPPER, sw * 1.6, 32, 11), 'accent'),
    ];
  }),

  shape('bell-ring', 'Bell ringing', (t) => {
    const p = frac(t / 1.6);
    const env = p < 0.65 ? Math.sin(Math.PI * (p / 0.65)) : 0;
    const sw = 16 * Math.sin(TAU * 4 * p) * env;
    return [
      stroke(rotate(BELL_DOME, sw, 32, 11), 'alert'),
      stroke(rotate(BELL_BASE, sw, 32, 11), 'alert'),
      stroke(rotate(BELL_CLAPPER, sw * 1.8, 32, 11), 'accent'),
    ];
  }),

  shape('clock', 'Clock', (t) => {
    const m = -90 + (360 * t) / 4;
    const h = -30 + (360 * t) / 48;
    return [
      stroke(RING, 'primary'),
      stroke(line([CX, CY], polar(9, h)), 'accent'),
      stroke(line([CX, CY], polar(13, m)), 'accent2'),
    ];
  }),

  shape('check', 'Done', (t) => {
    const k = 1 + 0.08 * Math.sin(Math.PI * clamp01(t / 0.5)) + 0.015 * Math.sin((TAU * t) / 3);
    return mapFrame(
      [stroke(RING, 'success'), stroke(CHECK, 'success'), still(polar(18, -45), 'accent', DOT_W)],
      (p) => scale(p, k),
    );
  }),

  shape('cross', 'Error', (t) => {
    const dx = 3 * Math.sin(TAU * 6 * t) * Math.exp(-3 * t);
    return mapFrame(
      [stroke(RING, 'error'), stroke(CROSS_A, 'error'), stroke(CROSS_B, 'error')],
      (p) => translate(p, dx, 0),
    );
  }),

  shape('heart', 'Heart', (t) => {
    const p = frac(t / 1.2);
    const k = 1 + 0.07 * (beat(p, 0.1, 0.08) + 0.7 * beat(p, 0.3, 0.08));
    return mapFrame(
      [
        stroke(HEART_L, 'accent2'),
        stroke(HEART_R, 'accent2'),
        still([49, 13], 'accent', DOT_W * 0.8),
      ],
      (pts) => scale(pts, k, 32, 36),
    );
  }),

  shape('envelope', 'Message', (t) => {
    const dy = -1.5 * Math.sin((TAU * t) / 2.2);
    const pop = 1 + 0.35 * Math.max(0, Math.sin((TAU * t) / 1.1)) ** 4;
    return [
      stroke(translate(ENV_BOX, 0, dy), 'primary'),
      stroke(translate(ENV_FLAP, 0, dy), 'accent'),
      still([51, 19 + dy], 'accent2', DOT_W * 0.9 * pop),
    ];
  }),

  shape('calendar', 'Calendar', (t) => {
    const step = Math.floor(t / 0.7);
    const u = easeInOut(clamp01(frac(t / 0.7) / 0.5));
    const a = CAL_DAYS[step % CAL_DAYS.length] ?? [32, 36];
    const b = CAL_DAYS[(step + 1) % CAL_DAYS.length] ?? [32, 36];
    const hop = -4 * Math.sin(Math.PI * u);
    return [
      stroke(CAL_BOX, 'primary'),
      stroke(CAL_HEAD, 'primary'),
      still([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + hop], 'accent', DOT_W * 0.8),
    ];
  }),

  shape('moon', 'Snooze', (t) => {
    const bob = 2 * Math.sin((TAU * t) / 2.4);
    return [
      stroke(rotate(MOON, 4 * Math.sin((TAU * t) / 3.2)), 'primary'),
      stroke(translate(ZED, 0, -bob), 'accent', LINE_W * 0.8),
      still([45, 33], 'accent2', DOT_W * (0.6 + 0.25 * hump(frac(t / 1.3)))),
    ];
  }),

  shape('sparkle', 'Sparkle', (t) => {
    const r = 17 + 2 * Math.sin((TAU * t) / 1.6);
    const a = 35 * t;
    const spoke = (deg: number): Pt[] => line(polar(r, a + deg), polar(r, a + deg + 180));
    return [
      stroke(spoke(-90), 'primary'),
      stroke(spoke(-30), 'accent'),
      stroke(spoke(30), 'accent2'),
    ];
  }),

  shape('bulb', 'Idea', (t) => {
    const k = breathe(t, 0.03, 1.8);
    return [
      stroke(scale(BULB, k, 32, 30), 'accent2'),
      stroke(BULB_BASE_A, 'primary'),
      stroke(BULB_BASE_B, 'primary'),
    ];
  }),

  shape('hourglass', 'Hourglass', (t) => {
    const p = frac(t / 0.8);
    const fill = 0.6 + 0.4 * clamp01(t / 2.6);
    const pile: Pt[] = line([32 - 8 * fill, 49], [32, 49 - 6 * fill], [32 + 8 * fill, 49]);
    return [
      stroke(GLASS, 'primary'),
      stroke(pile, 'accent2'),
      still([32, 32 + 14 * p * p], 'accent2', DOT_W * 0.6),
    ];
  }),
];

export const SCENES: readonly DotsScene[] = [...DANCES, ...SHAPES];

const BY_KEY = new Map(SCENES.map((s) => [s.key, s]));

export type SceneKey =
  | 'shuffle'
  | 'orbit'
  | 'bounce'
  | 'figure-eight'
  | 'juggle'
  | 'merge-split'
  | 'triangle-spin'
  | 'cradle'
  | 'spiral'
  | 'wave'
  | 's-mark'
  | 'pen'
  | 'bell'
  | 'bell-ring'
  | 'clock'
  | 'check'
  | 'cross'
  | 'heart'
  | 'envelope'
  | 'calendar'
  | 'moon'
  | 'sparkle'
  | 'bulb'
  | 'hourglass';

export function getScene(key: SceneKey | string): DotsScene {
  const s = BY_KEY.get(key) ?? BY_KEY.get('s-mark');
  if (!s) throw new Error('Smaran dots: missing default scene');
  return s;
}

/** shapes shown in auto mode, in order (state shapes like bell-ring/cross are left out) */
export const DEFAULT_SEQUENCE: readonly SceneKey[] = [
  's-mark',
  'pen',
  'bell',
  'clock',
  'check',
  'heart',
  'envelope',
  'calendar',
  'bulb',
  'sparkle',
  'hourglass',
  'moon',
];
