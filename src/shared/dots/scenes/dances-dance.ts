/** Dances · Choreography */
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
  line,
  motion,
  path,
  polar,
  project,
  rotX,
  seg,
  smooth,
  stepHold,
  trio,
  wander,
  type P3,
  type Pt,
} from './kit';

const CAT = 'Choreography';
const ROW = [20, 32, 44] as const;

const SWAPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [0, 2],
];
const SWAP_T = 0.55;
function shufflePositions(t: number): readonly [Pt, Pt, Pt] {
  const step = Math.floor(t / SWAP_T);
  const u = easeInOut(frac(t / SWAP_T));
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
      const x1 = ROW[(slot === sa ? sb : sa) as 0 | 1 | 2];
      const over = slot === sa ? -1 : 1;
      return [x0 + (x1 - x0) * u, C + over * 10 * Math.sin(PI * u)] as Pt;
    }
    return [x0, C] as Pt;
  });
  return [out[0] ?? [C, C], out[1] ?? [C, C], out[2] ?? [C, C]];
}

/** a rounded-square path, s in [0,1) */
function track(s: number, half = 15, r = 6): Pt {
  const straight = 2 * (half - r);
  const quarter = (PI * r) / 2;
  const sideLen = straight + quarter;
  let d = frac(s) * sideLen * 4;
  const corners: Array<[number, number, number]> = [
    [C + half - r, C - half + r, -90],
    [C + half - r, C + half - r, 0],
    [C - half + r, C + half - r, 90],
    [C - half + r, C - half + r, 180],
  ];
  const starts: Pt[] = [
    [C - half + r, C - half],
    [C + half, C - half + r],
    [C + half - r, C + half],
    [C - half, C + half - r],
  ];
  const dirs: Pt[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  for (let i = 0; i < 4; i++) {
    if (d <= straight) {
      const st = starts[i] ?? [C, C];
      const dir = dirs[i] ?? [1, 0];
      return [st[0] + dir[0] * d, st[1] + dir[1] * d];
    }
    d -= straight;
    if (d <= quarter) {
      const [cx, cy, a0] = corners[i] ?? [C, C, 0];
      return polar(r, a0 + (90 * d) / quarter, cx, cy);
    }
    d -= quarter;
  }
  return starts[0] ?? [C, C];
}

export const CHOREO_DANCES = [
  dots3('shuffle', 'Shell shuffle', CAT, SWAP_T * 6, shufflePositions),

  dots3('waltz', 'Waltz (1-2-3)', CAT, 3.6, (t) => {
    const beat = t / 0.45;
    const turn = 120 * stepHold(beat, 0.7);
    const center = track(stepHold(beat / 3, 0.85) / 4, 9, 4);
    const pair = (sign: number): Pt =>
      polar(5.5, turn + (sign > 0 ? 0 : 180), center[0], center[1]);
    const accent =
      1 + 0.25 * Math.max(0, Math.cos(PI * frac(beat / 3) * 6)) * (frac(beat / 3) < 0.16 ? 1 : 0);
    return [pair(1), pair(-1), [C + 18 * Math.cos(TAU * t * 0.1), 12 - 2 * accent]];
  }),

  dots3('conga', 'Conga line', CAT, 3.6, (t) => {
    const p = (k: number): Pt => {
      const base = track(t / 4 - k * 0.07);
      const step = Math.abs(Math.sin((PI * (t - k * 0.15)) / 0.3));
      return [base[0], base[1] - 2.5 * step];
    };
    return [p(0), p(1), p(2)];
  }),

  dots3('leapfrog', 'Leapfrog', CAT, 3.6, (t) => {
    const n = Math.floor(t / 1);
    const u = easeInOut(frac(t / 1));
    // order[0] is at the back; the back dot leaps to the front each beat
    const order = [
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, 1],
    ][n % 3] ?? [0, 1, 2];
    const pos: Pt[] = [
      [C, C],
      [C, C],
      [C, C],
    ];
    const leaper = order[0] ?? 0;
    const mid = order[1] ?? 1;
    const front = order[2] ?? 2;
    pos[leaper] = [lerp(20, 44, u), 40 - 22 * Math.sin(PI * u)];
    pos[mid] = [lerp(32, 20, u), 40];
    pos[front] = [lerp(44, 32, u), 40 - 1.5 * Math.sin(PI * u)];
    return [pos[0] ?? [C, C], pos[1] ?? [C, C], pos[2] ?? [C, C]];
  }),

  dots3('tag', "Tag, you're it", CAT, 3.6, (t) => {
    const n = Math.floor(t / 1.1);
    const u = frac(t / 1.1);
    const B = 180 * n;
    const T = B + 120 + 60 * u;
    const I = T - 120 * (1 - easeIn(u));
    const X = B - 60 * easeInOut(u);
    const it = n % 3;
    const target = (n + 1) % 3;
    const angles = [0, 0, 0];
    angles[it] = I;
    angles[target] = T;
    angles[(n + 2) % 3] = X;
    return [polar(14, angles[0] ?? 0), polar(14, angles[1] ?? 0), polar(14, angles[2] ?? 0)];
  }),

  motion('hide-and-seek', 'Hide and seek', CAT, 3.6, (t) => {
    const u = frac(t / 3.6);
    const peek = Math.sin(TAU * 2 * u);
    const hider: Pt = [C + 9 * peek * smooth(seg(Math.abs(peek), 0.6, 1)), C];
    const seekerA = (360 * t) / 3.6;
    return [
      dot([C, C], 0, { width: 13, z: 1 }),
      dot(hider, 1, { width: 8, z: 0 }),
      dot(polar(19, seekerA), 2, { width: 8, z: 2 }),
    ];
  }),

  dots3(
    'tango',
    'Tango',
    CAT,
    3.6,
    (t) => {
      const beat = t / 0.6;
      const moves: Pt[] = [
        [-6, 0],
        [6, -4],
        [-2, 6],
        [8, 2],
      ];
      const n = Math.floor(stepHold(beat, 0.45));
      const f = stepHold(beat, 0.45) - n;
      const a = moves[n % 4] ?? [0, 0];
      const b = moves[(n + 1) % 4] ?? [0, 0];
      const off: Pt = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
      const dip = 4 * Math.max(0, Math.sin(PI * frac(beat / 4))) ** 6;
      return [
        [C - 5 + off[0], C + off[1] + dip],
        [C + 5 + off[0], C + off[1] - dip * 0.5],
        [C + 16 * Math.sin((TAU * t) / 2.4), 50],
      ];
    },
    { widths: () => [DOT_W, DOT_W, 6] },
  ),

  dots3(
    'do-si-do',
    'Do-si-do',
    CAT,
    3.4,
    (t) => {
      const a = 180 * stepHold(t / 1.1, 0.8);
      const clap = Math.abs(Math.sin((PI * t) / 0.55));
      return [polar(11, a, C, 30), polar(11, a + 180, C, 30), [C, 50 - 2 * clap]];
    },
    { widths: (t) => [DOT_W, DOT_W, 6 + 3 * Math.abs(Math.sin((PI * t) / 0.55))] },
  ),

  motion('moonwalk', 'Moonwalk', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 3.2 + k / 3);
      const x = lerp(60, 4, u);
      const step = Math.abs(Math.sin(TAU * 4 * u + k));
      const w = DOT_W * Math.min(1, smooth(u / 0.08), smooth((1 - u) / 0.08));
      return capsule([x, 38 - 3 * step], 0, 3 * step, k, { width: w, teleport: true });
    }),
  ),

  dots3('chorus-kick', 'Chorus line kicks', CAT, 3.2, (t) => {
    const y = (k: number): number => {
      const u = frac(t / 1.6 - k * 0.12);
      const up =
        u < 0.25 ? easeOutBack(u / 0.25) : u < 0.45 ? 1 : 1 - easeInOut(seg(u, 0.45, 0.65));
      return 42 - 18 * Math.max(0, up);
    };
    return [
      [ROW[0], y(0)],
      [ROW[1], y(1)],
      [ROW[2], y(2)],
    ];
  }),

  motion('tug-of-war', 'Tug of war', CAT, 3.6, (t) => {
    const pull = 7 * Math.sin((TAU * t) / 2.4) + 1.2 * Math.sin(t * 11);
    const a: Pt = [14 + pull, C + 1.5 * Math.sin(t * 7)];
    const b: Pt = [50 + pull, C + 1.5 * Math.sin(t * 7 + 1)];
    const mid = (a[0] + b[0]) / 2;
    return [
      dot(a, 0),
      path(line([a[0] + 5, a[1]], [mid, C + 1.5], [b[0] - 5, b[1]]), 1, { width: 3 }),
      dot(b, 2),
    ];
  }),

  motion('carousel-3d', 'Carousel (3D)', CAT, 3.6, (t) =>
    trio((k) => {
      const a = TAU * (t / 3) + (k * TAU) / 3;
      let p: P3 = { x: 17 * Math.cos(a), y: -4 * Math.sin(a * 3 + k), z: 17 * Math.sin(a) };
      p = rotX(p, 18);
      const r = project(p);
      return dot(r.pt, k, { width: DOT_W * r.s, z: r.depth });
    }),
  ),

  motion('pirouette', 'Pirouette', CAT, 3.6, (t) => {
    const u = frac(t / 3);
    const spin = easeInOut(u) * 1080;
    const speed = Math.sin(PI * u);
    return [
      capsule([C, C], spin, 2 + 9 * speed, 0, { width: DOT_W * (1 - 0.2 * speed) }),
      dot(polar(18, (360 * t) / 6), 1, { width: 7 }),
      dot(polar(18, (360 * t) / 6 + 180), 2, { width: 7 }),
    ];
  }),

  dots3('mirror-dance', 'Mirror dance', CAT, 3.6, (t) => {
    const lead: Pt = [C - 10 + 6 * wander(t, 3), C - 8 + 7 * wander(t * 1.1, 6)];
    return [lead, [2 * C - lead[0], lead[1]], [lead[0] + (C - lead[0]) * 0, 2 * C - lead[1]]];
  }),

  motion('tower-topple', 'Tower topple', CAT, 3.8, (t) => {
    const u = frac(t / 3.6);
    const build = (k: number): number => smooth(seg(u, k * 0.12, k * 0.12 + 0.12));
    const tip = easeIn(seg(u, 0.45, 0.68));
    const settle = smooth(seg(u, 0.85, 1));
    return trio((k) => {
      const stackY = 48 - k * 10;
      const startX = 12 + k * 6;
      const sx = lerp(startX, C, build(k));
      const sy = lerp(48, stackY, build(k));
      // topple: rotate about the base, then land in a row and slide back
      const ang = (90 * tip * PI) / 180;
      const h = 48 - sy;
      const tx = C + h * Math.sin(ang);
      const ty = 48 - h * Math.cos(ang);
      const landed: Pt = [lerp(tx, startX, settle), lerp(ty, 48, settle)];
      return dot(u < 0.45 ? [sx, sy] : landed, k, { width: 9.5 });
    });
  }),

  motion('dive', 'Synchronised dive', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 2.4);
      const dive = Math.sin(PI * seg(u, 0.1 + k * 0.08, 0.6 + k * 0.08));
      const x = ROW[k];
      const y = C - 8 * Math.sin(TAU * u + k * 0.8);
      return dot([x, y], k, { width: DOT_W * (1 - 0.85 * dive), opacity: 1 - 0.6 * dive });
    }),
  ),
] as const;
