/** Shapes · Status, Tech, Media */
import {
  C,
  DOT_W,
  LINE_W,
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
  easeOut,
  easeOutBack,
  ellipse,
  frac,
  join,
  lerp,
  line,
  mixPt,
  polar,
  polygon,
  roundRect,
  seg,
  shape,
  smooth,
  star,
  stepHold,
  tf,
  waveLine,
  wander,
  drawUndo,
  type Pt,
} from './kit';
import { N, resample } from '../dotsGeometry';

const STATUS = 'Status';
const TECH = 'Tech';
const MEDIA = 'Media';
const RING = circle(C, C, 18);
const L = (a: Pt, b: Pt): Pt[] => line(a, b);

const gearPts = (cx: number, cy: number, R: number, n: number, deg: number): Pt[] =>
  curve((u) => {
    const a = TAU * u;
    const tooth = Math.tanh(3 * Math.cos(n * a)) * 0.5 + 0.5;
    const r = R - 2 + 4 * tooth;
    return [cx + r * Math.cos(a + (deg * PI) / 180), cy + r * Math.sin(a + (deg * PI) / 180)];
  }, 120);

const CLOUD = join(
  arc(21, 34, 7, 90, 270, 12),
  arc(30, 26, 9, 190, 330, 14),
  arc(41, 30, 8, 250, 450, 16),
  L([41, 38], [21, 41]),
);

/** blend two polylines point by point (after resampling to N) */
const morph = (a: ReadonlyArray<Pt>, b: ReadonlyArray<Pt>, k: number): Pt[] => {
  const ra = resample(a, N);
  const rb = resample(b, N);
  return ra.map((p, i) => mixPt(p, rb[i] ?? p, k));
};

export const SHAPES_B = [
  // ── Status ─────────────────────────────────────────────────────────────
  shape('check', 'Done', STATUS, (t) => {
    const k = 1 + 0.08 * Math.sin(PI * Math.min(1, t / 0.5)) + 0.015 * Math.sin((TAU * t) / 3);
    return all(
      [
        S(RING, 'success'),
        S(line([22.5, 33], [29, 39.5], [42, 25.5]), 'success'),
        P(polar(18, -45), 'accent', { width: DOT_W }),
      ],
      (p) => tf.scale(p, k),
    );
  }),

  shape('cross', 'Error', STATUS, (t) => {
    const dx = 3 * Math.sin(TAU * 6 * t) * Math.exp(-3 * t);
    return all(
      [
        S(RING, 'error'),
        S(L([24.5, 24.5], [39.5, 39.5]), 'error'),
        S(L([39.5, 24.5], [24.5, 39.5]), 'error'),
      ],
      (p) => tf.move(p, dx, 0),
    );
  }),

  shape('plus-spin', 'Plus to cross', STATUS, (t) => {
    const a = 45 * stepHold(t / 1.1, 0.4);
    const isX = Math.round(a / 45) % 2 === 1;
    return [
      S(RING, 'primary', { opacity: 0.35 }),
      S(tf.rotate(L([C, 20], [C, 44]), a), isX ? 'error' : 'accent'),
      S(tf.rotate(L([20, C], [44, C]), a), isX ? 'error' : 'accent'),
    ];
  }),

  shape('info', 'Info', STATUS, (t) => {
    const u = frac(t / 1.4);
    const hop = 5 * Math.sin(PI * seg(u, 0, 0.4));
    return [
      S(RING, 'accent'),
      S(L([C, 28], [C, 43]), 'accent'),
      P([C, 21 - hop], 'accent', { width: 7 }),
    ];
  }),

  shape('question', 'Question', STATUS, (t) => {
    const tilt = 10 * Math.sin((TAU * t) / 2.2);
    return all(
      [
        S(RING, 'primary', { opacity: 0.3 }),
        S(
          join(arc(C, 25, 7.5, 190, 360, 20), cubic([39.5, 25], [39.5, 31], [32, 31], [32, 37])),
          'accent',
        ),
        P([C, 44], 'accent', { width: 7 }),
      ],
      (p) => tf.rotate(p, tilt, C, 44),
    );
  }),

  shape('warning', 'Warning', STATUS, (t) => {
    const pulse = 1 + 0.06 * Math.max(0, Math.sin((TAU * t) / 0.9)) ** 3;
    return all(
      [
        S(line([C, 13], [52, 48], [12, 48], [C, 13]), 'alert'),
        S(L([C, 26], [C, 36]), 'alert'),
        P([C, 42], 'alert', { width: 7 }),
      ],
      (p) => tf.scale(p, pulse, pulse, C, 36),
    );
  }),

  shape('shield-check', 'Protected', STATUS, (t) => {
    const u = frac(t / 2.4);
    const scan = 14 + 34 * easeInOut(seg(u, 0.5, 0.95));
    const draw = drawUndo(u, 0.05, 0.4, 0.8, 1);
    return [
      S(
        join(
          line([C, 10], [48, 16], [48, 30]),
          cubic([48, 30], [48, 42], [40, 50], [C, 54]),
          cubic([C, 54], [24, 50], [16, 42], [16, 30]),
          line([16, 16], [C, 10]),
        ),
        'primary',
      ),
      S(tf.trim(line([24, 31], [30, 37], [41, 25]), 0, draw), 'success'),
      P([C, scan], 'accent', { width: 5 * Math.sin(PI * seg(u, 0.5, 0.95)), teleport: true }),
    ];
  }),

  shape('lock', 'Lock', STATUS, (t) => {
    const open = smooth(0.5 - 0.5 * Math.cos((TAU * t) / 2.4));
    const shackle = tf.rotate(
      tf.move(
        join(L([22, 28], [22, 20]), arc(C, 20, 10, 180, 360, 20), L([42, 20], [42, 28])),
        0,
        -5 * open,
      ),
      -25 * open,
      22,
      23,
    );
    return [
      S(roundRect(16, 28, 32, 24, 5), 'primary'),
      S(shackle, open > 0.5 ? 'success' : 'alert'),
      P([C, 39], 'accent', { width: 7 }),
    ];
  }),

  shape('key', 'Key', STATUS, (t) => {
    const turn = Math.cos((TAU * t) / 2.4);
    const k = (p: Pt[]): Pt[] => tf.scale(p, 1, 0.25 + 0.75 * Math.abs(turn), C, C);
    return [
      S(k(circle(19, C, 8)), 'accent2'),
      S(k(line([27, C], [52, C], [52, 38], [47, 38], [47, 34], [42, 34], [42, 37])), 'accent2'),
      P(polar(4, (360 * t) / 2, 19, C), 'primary', { width: 4 }),
    ];
  }),

  shape('verified', 'Verified', STATUS, (t) => {
    const rot = 20 * t;
    const badge = curve((u) => polar(17 + 1.8 * Math.sin(12 * TAU * u), 360 * u + rot), 120);
    return [
      S(badge, 'accent'),
      S(line([24, 32.5], [30, 38.5], [41, 26.5]), 'accent'),
      P(polar(23, -90 + (360 * t) / 2.4), 'accent2', { width: 5 }),
    ];
  }),

  shape('block', 'Blocked', STATUS, (t) => {
    const u = frac(t / 1.6);
    const x = u < 0.45 ? lerp(4, 22, easeOut(u / 0.45)) : lerp(22, 4, easeInOut(seg(u, 0.45, 1)));
    return [
      S(RING, 'error'),
      S(L([19.3, 44.7], [44.7, 19.3]), 'error'),
      P([x, C + 8], 'primary', { width: 7 }),
    ];
  }),

  shape('star-rate', 'Star rating', STATUS, (t) => {
    const u = frac(t / 2.6);
    const draw = drawUndo(u, 0, 0.5, 0.82, 1);
    const pop = 1 + 0.1 * Math.sin(PI * seg(u, 0.5, 0.7));
    return [
      S(tf.scale(tf.trim(star(5, 19, 8), 0, draw), pop), 'accent2'),
      S(tf.rotate(star(5, 7, 3), -(360 * t) / 6), 'accent2', { width: 3, opacity: 0.8 }),
      P(polar(22, -30 + 30 * Math.sin(t)), 'accent', { width: 5 * Math.abs(Math.sin(t * 2)) }),
    ];
  }),

  // ── Tech ───────────────────────────────────────────────────────────────
  shape('wifi', 'Wi-Fi', TECH, (t) => {
    const p = frac(t / 1.5);
    const lit = (c: number): number =>
      0.25 + 0.75 * smooth(seg(p, c, c + 0.15)) * (1 - smooth(seg(p, 0.8, 0.95)));
    return [
      P([C, 46], 'accent', { width: 8, opacity: lit(0) }),
      S(arc(C, 46, 11, -135, -45, 24), 'accent', { opacity: lit(0.2) }),
      S(arc(C, 46, 21, -135, -45, 32), 'accent', { opacity: lit(0.4) }),
    ];
  }),

  shape('battery-charge', 'Charging', TECH, (t) => {
    const u = frac(t / 2.6);
    // charges up, then drains smoothly before charging again
    const level = u < 0.8 ? easeInOut(u / 0.8) : 1 - easeInOut(seg(u, 0.82, 1));
    const fill = 17 + 25 * level;
    return [
      S(roundRect(12, 22, 36, 20, 4), 'primary'),
      S(L([52, 28], [52, 36]), 'primary', { width: 4 }),
      S(
        L([17, C], [Math.max(17.5, fill), C]),
        level > 0.7 ? 'success' : level > 0.35 ? 'accent2' : 'alert',
        { width: 9 },
      ),
    ];
  }),

  shape('plug', 'Plug', TECH, (t) => {
    const u = frac(t / 2.2);
    const lift = -6 * easeOutBack(seg(u, 0.1, 0.4)) * (1 - easeInOut(seg(u, 0.7, 1)));
    return [
      S(tf.move(line([27, 22], [27, 12], [27, 22], [37, 22], [37, 12]), 0, lift), 'primary', {
        width: 4,
      }),
      S(tf.move(roundRect(23, 22, 18, 13, 3), 0, lift), 'accent'),
      S(cubic([C, 35 + lift], [C, 48], [46, 44], [50, 56]), 'primary', { width: 3.5 }),
    ];
  }),

  shape('power', 'Power', TECH, (t) => {
    const u = frac(t / 2);
    const press = Math.sin(PI * seg(u, 0, 0.25));
    const on = u > 0.12 && u < 0.85;
    const k = 1 - 0.08 * press;
    return all(
      [
        S(arc(C, 33, 15, -60, 240, 48), on ? 'success' : 'primary'),
        S(L([C, 12], [C, 30]), on ? 'success' : 'primary'),
        P([C, 33], 'accent', { width: on ? 6 + 2 * Math.sin(t * 6) : 0 }),
      ],
      (p) => tf.scale(p, k),
    );
  }),

  shape('gear', 'Settings gear', TECH, (t) => [
    S(gearPts(C, C, 15, 8, 45 * t), 'primary', { width: 4 }),
    S(circle(C, C, 6), 'accent', { width: 4 }),
    P([C, C], 'accent2', { width: 4 }),
  ]),

  shape('wrench', 'Wrench', TECH, (t) => {
    const a = 22 * Math.sin((TAU * t) / 1.6);
    const head: Pt = [42, 22];
    return [
      S(tf.rotate(L([20, 46], [37, 29]), a, head[0], head[1]), 'primary', { width: 6 }),
      S(tf.rotate(arc(head[0], head[1], 7, 60, 330, 30), a, head[0], head[1]), 'primary'),
      S(tf.rotate(polygon(6, 3.5, 0, head[0], head[1]), a * 0.5, head[0], head[1]), 'accent2', {
        width: 3,
      }),
    ];
  }),

  shape('magnifier', 'Search', TECH, (t) => {
    const a = (TAU * t) / 2.6;
    const dx = 5 * Math.cos(a);
    const dy = 4 * Math.sin(2 * a);
    return [
      S(tf.move(circle(28, 28, 11), dx, dy), 'primary'),
      S(tf.move(L([36, 36], [48, 48]), dx, dy), 'primary', { width: 6.5 }),
      S(tf.move(arc(28, 28, 6.5, 200, 260, 12), dx, dy), 'accent', { width: 3 }),
    ];
  }),

  shape('refresh', 'Refresh', TECH, (t) => {
    const rot = (360 * t) / 2.2 + 25 * Math.sin((TAU * t) / 2.2);
    const arrow = (a0: number): Pt[] => {
      const end = polar(15, a0 + 120);
      const tang = a0 + 120 + 90;
      return join(
        arc(C, C, 15, a0, a0 + 120, 32),
        [polar(6, tang - 150, end[0], end[1])],
        [end],
        [polar(6, tang + 150 - 180, end[0], end[1])],
      );
    };
    return [
      S(tf.rotate(arrow(-60), rot), 'accent'),
      S(tf.rotate(arrow(120), rot), 'accent'),
      P([C, C], 'primary', { width: 5 }),
    ];
  }),

  shape('download', 'Download', TECH, (t) => {
    const u = frac(t / 1.4);
    const y = lerp(-6, 12, easeInOut(u));
    const show = smooth(seg(u, 0, 0.15)) * (1 - smooth(seg(u, 0.85, 1)));
    return [
      S(tf.move(L([C, 10], [C, 30]), 0, y), 'accent', { width: LINE_W * show, teleport: true }),
      S(tf.move(line([23, 22], [C, 31], [41, 22]), 0, y), 'accent', {
        width: LINE_W * show,
        teleport: true,
      }),
      S(line([12, 38], [12, 50], [52, 50], [52, 38]), 'primary'),
    ];
  }),

  shape('cloud-upload', 'Cloud upload', TECH, (t) => {
    const u = frac(t / 1.4);
    const y = lerp(10, -8, easeInOut(u));
    const show = smooth(seg(u, 0, 0.15)) * (1 - smooth(seg(u, 0.8, 1)));
    return [
      S(tf.move(CLOUD, 0, -6), 'primary'),
      S(tf.move(line([26, 42], [C, 36], [38, 42], [C, 36], [C, 52]), 0, y), 'accent', {
        width: LINE_W * show,
        teleport: true,
      }),
      P([46, 14], 'accent2', { width: 5 * (0.5 + 0.5 * Math.sin(t * 4)) }),
    ];
  }),

  shape('cloud', 'Cloud', TECH, (t) => {
    const drift = 3 * Math.sin((TAU * t) / 3.6);
    return [
      S(tf.move(CLOUD, drift, -2), 'primary'),
      S(waveLine(10, 30, 48, 1.2, 1.5, t * 0.8), 'accent', { width: 3, opacity: 0.6 }),
      S(waveLine(26, 50, 54, 1.2, 1.5, t * 0.8 + 0.3), 'accent2', { width: 3, opacity: 0.6 }),
    ];
  }),

  shape('cursor-click', 'Click', TECH, (t) => {
    const u = frac(t / 1.3);
    const tap = Math.sin(PI * seg(u, 0, 0.18));
    const ring = (ph: number) => {
      const v = seg(u, 0.1 + ph, 0.75 + ph);
      return S(circle(20, 16, 3 + 13 * easeOut(v)), 'accent', {
        opacity: (1 - v) * (v > 0 ? 1 : 0),
        width: 3 * (1 - smooth(seg(v, 0.8, 1))) + 0.01,
        teleport: true,
      });
    };
    return [
      S(
        tf.scale(
          line([20, 16], [20, 44], [27, 37], [32, 48], [37, 46], [32, 35], [42, 35], [20, 16]),
          1 - 0.08 * tap,
          1 - 0.08 * tap,
          20,
          16,
        ),
        'primary',
        { width: 4 },
      ),
      ring(0),
      ring(0.15),
    ];
  }),

  shape('code', 'Code', TECH, (t) => {
    const b = 2.5 * Math.sin((TAU * t) / 1.4);
    const s = 12 * Math.sin((TAU * t) / 2.8);
    return [
      S(line([24 - b, 20], [14 - b, C], [24 - b, 44]), 'accent'),
      S(line([40 + b, 20], [50 + b, C], [40 + b, 44]), 'accent'),
      S(tf.rotate(L([36, 18], [28, 46]), s), 'accent2', { width: 4 }),
    ];
  }),

  shape('link', 'Link', TECH, (t) => {
    const gap = 4 * (0.5 + 0.5 * Math.sin((TAU * t) / 2));
    const linkA = tf.rotate(roundRect(10, 26, 26, 12, 6), -45, 23, 32);
    const linkB = tf.rotate(roundRect(28, 26, 26, 12, 6), -45, 41, 32);
    return [
      S(tf.move(linkA, -gap, gap), 'primary', { width: 4.5 }),
      S(tf.move(linkB, gap, -gap), 'accent', { width: 4.5 }),
      P([C, C], 'accent2', { width: 6 * (1 - gap / 4) }),
    ];
  }),

  // ── Media ──────────────────────────────────────────────────────────────
  shape('play-pause', 'Play ↔ pause', MEDIA, (t) => {
    const k = smooth(0.5 - 0.5 * Math.cos((TAU * t) / 2.4));
    const tri = line([24, 18], [45, C], [24, 46], [24, 18]);
    const barL = line([24, 19], [24, 45]);
    const barR = line([40, 19], [40, 45]);
    return [
      S(morph(tri, barL, k), 'accent', { width: lerp(4.5, 6, k) }),
      S(morph(line([45, C], [45, C]), barR, k), 'accent', { width: 6 * k }),
      S(circle(C, C, 22), 'primary', { opacity: 0.25, width: 3 }),
    ];
  }),

  shape('music-note', 'Music note', MEDIA, (t) => {
    const beat = Math.abs(Math.sin((PI * t) / 0.45));
    const tilt = 8 * Math.sin((PI * t) / 0.9);
    return all(
      [
        S(ellipse(24, 44, 6.5, 4.8, -20), 'accent'),
        S(L([30, 42], [30, 13]), 'accent'),
        S(cubic([30, 13], [38, 15], [44, 20], [42, 28]), 'accent2'),
      ],
      (p) => tf.rotate(tf.move(p, 0, -3 * beat), tilt, 26, 44),
    );
  }),

  shape('headphones', 'Headphones', MEDIA, (t) => {
    const beat = Math.max(0, Math.sin((TAU * t) / 0.5)) ** 2;
    return [
      S(arc(C, 36, 17, 180, 360, 40), 'primary'),
      S(L([15, 36], [15, 46]), 'accent', { width: 9 + 2 * beat }),
      S(L([49, 36], [49, 46]), 'accent', { width: 9 + 2 * beat }),
    ];
  }),

  shape('mic', 'Microphone', MEDIA, (t) => {
    const level = Math.abs(wander(t * 3, 2));
    return [
      S(L([C, 14], [C, 28]), 'accent', { width: 11 + 3 * level }),
      S(arc(C, 26, 12, 0, 180, 24), 'primary'),
      S(line([24, 50], [40, 50], [C, 50], [C, 38]), 'primary'),
    ];
  }),

  shape('speaker', 'Speaker', MEDIA, (t) => {
    const wave = (ph: number) => {
      const u = frac(t / 1 + ph);
      return S(arc(34, C, 6 + 12 * u, -45, 45, 20), 'accent', {
        opacity: 1 - u,
        width: 4 * (1 - smooth(seg(u, 0.85, 1))),
        teleport: true,
      });
    };
    const thump = 1 + 0.05 * Math.max(0, Math.sin((TAU * t) / 0.5));
    return [
      S(
        tf.scale(
          line([12, 26], [20, 26], [30, 16], [30, 48], [20, 38], [12, 38], [12, 26]),
          thump,
          thump,
          21,
          C,
        ),
        'primary',
      ),
      wave(0),
      wave(0.5),
    ];
  }),

  shape('camera', 'Camera', MEDIA, (t) => {
    const u = frac(t / 2);
    const flash = Math.max(0, 1 - Math.abs(u - 0.5) * 10);
    const zoom = 8.5 + 1.5 * Math.sin((TAU * t) / 2);
    return [
      S(
        join(roundRect(10, 22, 44, 28, 6), line([20, 22], [24, 16], [34, 16], [38, 22])),
        'primary',
      ),
      S(circle(C, 36, zoom), 'accent'),
      P([46, 28], 'accent2', { width: 4 + 10 * flash }),
    ];
  }),

  shape('video-cam', 'Recording', MEDIA, (t) => {
    const blink = 0.5 + 0.5 * Math.sin((TAU * t) / 1);
    return [
      S(roundRect(10, 20, 32, 24, 5), 'primary'),
      S(line([42, 28], [54, 21], [54, 43], [42, 36]), 'primary'),
      P([18, 27], 'error', { width: 7, opacity: 0.3 + 0.7 * blink }),
    ];
  }),

  shape('image', 'Photo', MEDIA, (t) => {
    const a = 200 + 140 * (0.5 - 0.5 * Math.cos((TAU * t) / 4));
    return [
      S(roundRect(10, 14, 44, 36, 5), 'primary'),
      S(line([14, 46], [26, 30], [34, 40], [40, 34], [50, 46]), 'accent'),
      { ...P(polar(12, a, 44, 34), 'accent2', { width: 7 }), z: -1 },
    ];
  }),

  shape('eye', 'Eye', MEDIA, (t) => {
    const u = frac(t / 3);
    const blink = Math.max(smooth(seg(u, 0.84, 0.9)) * (1 - smooth(seg(u, 0.9, 0.96))), 0);
    const look: Pt = [C + 6 * wander(t * 0.8, 3), C + 3 * wander(t * 0.8, 7)];
    const lid = (dir: number): Pt[] =>
      cubic([12, C], [22, C + dir * 14 * (1 - blink)], [42, C + dir * 14 * (1 - blink)], [52, C]);
    return [
      S(lid(-1), 'primary'),
      S(lid(1), 'primary'),
      P(look, 'accent', { width: 12 * (1 - blink) }),
    ];
  }),

  shape('sparkle', 'Sparkle', MEDIA, (t) => {
    const r = 17 + 2 * Math.sin((TAU * t) / 1.6);
    const a = 35 * t;
    const spoke = (deg: number): Pt[] => L(polar(r, a + deg), polar(r, a + deg + 180));
    return [S(spoke(-90), 'primary'), S(spoke(-30), 'accent'), S(spoke(30), 'accent2')];
  }),

  shape('vinyl', 'Vinyl record', MEDIA, (t) => {
    const spin = (360 * t) / 1.8;
    const arm = 12 * (0.5 + 0.5 * Math.sin((TAU * t) / 6));
    return [
      S(circle(28, 34, 18), 'primary'),
      S(arc(28, 34, 11, spin, spin + 110, 24), 'accent', { width: 3.5 }),
      S(tf.rotate(line([54, 10], [54, 16], [42, 30]), arm, 54, 10), 'accent2', { width: 3.5 }),
    ];
  }),

  shape('tv', 'TV', MEDIA, (t) => {
    const wig = 10 * Math.sin((TAU * t) / 1.4);
    const flicker = 0.75 + 0.25 * Math.sin(t * 17) * Math.sin(t * 5);
    return [
      S(roundRect(12, 22, 40, 28, 5), 'primary', { opacity: flicker }),
      S(tf.rotate(line([22, 10], [C, 22], [42, 10]), wig, C, 22), 'accent'),
      S(L([24, 55], [40, 55]), 'primary', { width: 4 }),
    ];
  }),
] as const;
