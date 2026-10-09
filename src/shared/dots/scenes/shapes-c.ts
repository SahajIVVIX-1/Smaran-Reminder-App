/** Shapes · Nature & weather, Objects */
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
  easeIn,
  easeInOut,
  ellipse,
  frac,
  join,
  lerp,
  line,
  polar,
  rect,
  seg,
  shape,
  smooth,
  star,
  tf,
  wander,
  drawUndo,
  type Pt,
} from './kit';

const NATURE = 'Nature & weather';
const OBJ = 'Objects';
const L = (a: Pt, b: Pt): Pt[] => line(a, b);

const CLOUD = join(
  arc(21, 34, 7, 90, 270, 12),
  arc(30, 26, 9, 190, 330, 14),
  arc(41, 30, 8, 250, 450, 16),
  L([41, 38], [21, 41]),
);
const MOON = join(
  arc(30, 32, 17, -70, -290),
  cubic([35.81, 47.97], [24, 42], [24, 22], [35.81, 16.03]),
);
const HEART_L = cubic([C, 49], [13, 36], [14, 13], [C, 22]);
const HEART_R = cubic([C, 49], [51, 36], [50, 13], [C, 22]);
const BULB = join([[27, 41]], arc(C, 26, 13, 135, 405), [[37, 41]]);

const snowAxis = (deg: number): Pt[] => {
  const e1 = polar(18, deg);
  const e2 = polar(18, deg + 180);
  const v = (e: Pt, d: number, s: number): Pt => polar(6, d + 180 + s * 40, e[0], e[1]);
  return [v(e1, deg, 1), e1, v(e1, deg, -1), e1, e2, v(e2, deg + 180, 1), e2, v(e2, deg + 180, -1)];
};

export const SHAPES_C = [
  // ── Nature & weather ──────────────────────────────────────────────────
  shape('sun', 'Sun', NATURE, (t) => [
    S(tf.rotate(star(12, 22, 16.5), (360 * t) / 12), 'accent2', { width: 3.5 }),
    S(circle(C, C, 10 + 0.8 * Math.sin(t * 2)), 'accent2'),
    P([C, C], 'accent2', { width: 6 + 2 * Math.sin(t * 2) }),
  ]),

  shape('moon', 'Snooze', NATURE, (t) => {
    const bob = 2 * Math.sin((TAU * t) / 2.4);
    return [
      S(tf.rotate(MOON, 4 * Math.sin((TAU * t) / 3.2)), 'primary'),
      S(tf.move(line([42, 8], [50, 8], [42, 16], [50, 16]), 0, -bob), 'accent', {
        width: LINE_W * 0.8,
      }),
      P([45, 33], 'accent2', { width: DOT_W * (0.6 + 0.25 * Math.sin(t * 4)) }),
    ];
  }),

  shape('star', 'Star', NATURE, (t) => {
    const tw = (ph: number): number => Math.max(0, Math.sin(t * 3 + ph)) ** 3;
    return [
      S(tf.rotate(star(5, 19, 8), 6 * Math.sin(t)), 'accent2'),
      P([12, 14], 'accent', { width: 7 * tw(0) }),
      P([52, 48], 'accent', { width: 7 * tw(2) }),
    ];
  }),

  shape('cloud-rain', 'Rain cloud', NATURE, (t) => {
    const drop = (x: number, ph: number) => {
      const u = frac(t / 0.9 + ph);
      const w = 4 * smooth(seg(u, 0, 0.15)) * (1 - smooth(seg(u, 0.8, 1)));
      return S(L([x - 1.5 * u, 40 + 14 * u], [x - 1.5 * u - 1, 44 + 14 * u]), 'accent', {
        width: w,
        teleport: true,
      });
    };
    return [S(tf.move(CLOUD, 1.5 * Math.sin(t), -6), 'primary'), drop(25, 0), drop(37, 0.5)];
  }),

  shape('snowflake', 'Snowflake', NATURE, (t) => {
    const a = 20 * t;
    const k = 1 + 0.05 * Math.sin((TAU * t) / 2);
    return all(
      [
        S(snowAxis(-90 + a), 'accent', { width: 3.5 }),
        S(snowAxis(-30 + a), 'accent', { width: 3.5 }),
        S(snowAxis(30 + a), 'accent', { width: 3.5 }),
      ],
      (p) => tf.scale(p, k),
    );
  }),

  shape('lightning', 'Thunder', NATURE, (t) => {
    const u = frac(t / 1.8);
    const flash =
      Math.max(0, 1 - Math.abs(u - 0.3) * 8) + 0.6 * Math.max(0, 1 - Math.abs(u - 0.45) * 10);
    return [
      S(tf.move(CLOUD, 0, -10), 'primary'),
      S(line([35, 33], [27, 44], [34, 44], [27, 56]), 'accent2', {
        width: 4.5,
        opacity: 0.25 + 0.75 * Math.min(1, flash),
      }),
      P([27, 56], 'accent2', { width: 9 * Math.min(1, flash) }),
    ];
  }),

  shape('rainbow', 'Rainbow', NATURE, (t) => {
    const u = frac(t / 3);
    const band = (r: number, d: number, color: 'accent2' | 'accent' | 'success') => {
      const shown = drawUndo(u, d, d + 0.35, 0.7 + d * 0.3, 0.92 + d * 0.08);
      return S(tf.trim(arc(C, 44, r, 180, 360, 48), 0, shown), color);
    };
    return [band(20, 0, 'accent2'), band(14, 0.1, 'accent'), band(8, 0.2, 'success')];
  }),

  shape('umbrella', 'Umbrella', NATURE, (t) => {
    const sway = 6 * Math.sin((TAU * t) / 2.6);
    const u = frac(t / 1.3);
    const slide = polar(19, 190 + 60 * easeIn(u), C, 30);
    const canopy = join(
      arc(C, 30, 18, 180, 360, 32),
      arc(44, 30, 6, 0, 180, 10),
      arc(C, 30, 6, 0, 180, 10),
      arc(20, 30, 6, 0, 180, 10),
    );
    return [
      S(tf.rotate(canopy, sway, C, 48), 'accent'),
      S(tf.rotate(join(L([C, 30], [C, 48]), arc(28, 48, 4, 0, 180, 10)), sway, C, 48), 'primary'),
      P(
        u < 0.5
          ? [slide[0], slide[1] - 4]
          : [lerp(slide[0], 8, seg(u, 0.5, 1)), slide[1] + 20 * easeIn(seg(u, 0.5, 1))],
        'accent2',
        { width: 6 * (1 - smooth(seg(u, 0.85, 1))) * smooth(seg(u, 0, 0.1)), teleport: true },
      ),
    ];
  }),

  shape('leaf', 'Leaf', NATURE, (t) => {
    const sway = 10 * Math.sin((TAU * t) / 2.8);
    return all(
      [
        S(
          join(
            cubic([14, 48], [14, 24], [30, 14], [48, 14]),
            cubic([48, 14], [48, 32], [36, 48], [14, 48]),
          ),
          'success',
        ),
        S(L([17, 45], [42, 20]), 'success', { width: 3 }),
        S(L([14, 48], [8, 55]), 'primary', { width: 4 }),
      ],
      (p) => tf.rotate(p, sway, 9, 54),
    );
  }),

  shape('flower', 'Flower', NATURE, (t) => {
    const open = 0.55 + 0.45 * smooth(0.5 - 0.5 * Math.cos((TAU * t) / 3));
    const spin = 10 * t;
    const petals = curve((u) => {
      const th = PI * u;
      const r = 16 * open * Math.cos(5 * th);
      return [C + r * Math.cos(th + (spin * PI) / 180), 24 + r * Math.sin(th + (spin * PI) / 180)];
    }, 120);
    return [
      S(petals, 'accent', { width: 3.5 }),
      S(cubic([C, 37], [30, 44], [35, 50], [C, 57]), 'success', { width: 4 }),
      P([C, 24], 'accent2', { width: 7 }),
    ];
  }),

  shape('tree', 'Tree', NATURE, (t) => {
    const sway = 2.5 * Math.sin((TAU * t) / 3);
    const canopy = curve(
      (u) => polar(13 + 1.5 * Math.sin(5 * TAU * u + t * 2), 360 * u, C + sway, 24),
      90,
    );
    const u = frac(t / 2.6);
    const leafP: Pt = [38 + 8 * u + 3 * Math.sin(TAU * 2 * u), 30 + 24 * u];
    return [
      S(canopy, 'success'),
      S(line([C, 55], [C, 40], [C + sway * 0.6 + 6, 33]), 'primary'),
      P(leafP, 'success', {
        width: 5 * smooth(seg(u, 0, 0.1)) * (1 - smooth(seg(u, 0.85, 1))),
        teleport: true,
      }),
    ];
  }),

  shape('mountain', 'Sunrise', NATURE, (t) => {
    const rise = 0.5 - 0.5 * Math.cos((TAU * t) / 4);
    return [
      S(line([8, 50], [24, 26], [C, 36], [40, 20], [56, 50]), 'primary'),
      S(line([36, 26], [40, 20], [44, 26]), 'accent', { width: 4 }),
      { ...P([18, lerp(46, 16, rise)], 'accent2', { width: 9 }), z: -1 },
    ];
  }),

  shape('ocean-wave', 'Ocean wave', NATURE, (t) => {
    const ph = (TAU * t) / 2;
    const crest = 4 * Math.sin(ph);
    const curl = join(
      cubic([8, 46], [22, 46], [26, 22 + crest], [42, 20 + crest]),
      arc(40, 28 + crest, 8, -80, 140, 24),
    );
    const water: Pt[] = [];
    for (let i = 0; i <= 40; i++)
      water.push([6 + (52 * i) / 40, 50 + 2 * Math.sin((TAU * i) / 20 - ph * 2)]);
    return [
      S(curl, 'accent'),
      S(water, 'accent', { width: 3.5 }),
      P([44 + 2 * Math.sin(ph * 2), 17 + crest], 'accent2', { width: 6 }),
    ];
  }),

  shape('fire', 'Flame', NATURE, (t) => {
    const tip = 32 + 5 * wander(t * 3, 1);
    const flame = (s: number, dy: number): Pt[] =>
      tf.scale(
        join(
          cubic([tip, 10 + dy], [26, 22], [18, 30], [20, 42]),
          cubic([20, 42], [22, 54], [42, 54], [44, 42]),
          cubic([44, 42], [46, 30], [38, 22], [tip, 10 + dy]),
        ),
        s,
        s,
        C,
        50,
      );
    const u = frac(t / 1.2);
    return [
      S(flame(1 + 0.04 * wander(t * 4, 2), 0), 'alert'),
      S(flame(0.48, 6 + 3 * wander(t * 5, 4)), 'accent2'),
      P([C + 8 * wander(t, 6), lerp(30, 4, u)], 'accent2', {
        width: 4 * (1 - u) * smooth(seg(u, 0, 0.1)),
        teleport: true,
      }),
    ];
  }),

  shape('droplet', 'Droplet', NATURE, (t) => {
    const u = frac(t / 2);
    const fall = easeIn(seg(u, 0.3, 0.6));
    const dy = 8 * fall;
    const show = 1 - smooth(seg(u, 0.6, 0.65));
    const ripple = seg(u, 0.6, 1);
    const drop = join(
      cubic([C, 10], [28, 20], [18, 30], [18, 38]),
      arc(C, 38, 14, 180, 0, 32),
      cubic([46, 38], [46, 30], [36, 20], [C, 10]),
    );
    return [
      S(tf.scale(tf.move(drop, 0, dy), show + 0.001, show + 0.001, C, 52), 'accent', {
        width: LINE_W * show,
        teleport: true,
      }),
      S(tf.move(arc(C, 38, 8, 120, 170, 10), 0, dy), 'accent', { width: 3 * show }),
      S(ellipse(C, 54, 4 + 18 * ripple, 1.5 + 3 * ripple), 'accent', {
        width: 3 * (1 - ripple),
        opacity: 1 - ripple,
      }),
    ];
  }),

  shape('saturn', 'Saturn', NATURE, (t) => {
    const tilt = -20 + 8 * Math.sin((TAU * t) / 5);
    const ry = 5 + 2.5 * Math.sin((TAU * t) / 5);
    const m = (TAU * t) / 2.4;
    const moon = { x: 24 * Math.cos(m), z: 24 * Math.sin(m) };
    return [
      { ...S(circle(C, C, 11), 'accent2'), z: 0 },
      { ...S(ellipse(C, C, 21, ry, tilt), 'primary', { width: 3.5 }), z: 0.5 },
      P([C + moon.x * 0.95, C + moon.x * 0.18 - 2], 'accent', {
        width: 5 + moon.z * 0.08,
        z: moon.z,
      }),
    ];
  }),

  // ── Objects ────────────────────────────────────────────────────────────
  shape('heart', 'Heart', OBJ, (t) => {
    const p = frac(t / 1.2);
    const beat = (c: number, w: number): number => {
      let d = p - c;
      d -= Math.round(d);
      return Math.abs(d) < w ? 0.5 + 0.5 * Math.cos((PI * d) / w) : 0;
    };
    const k = 1 + 0.07 * (beat(0.1, 0.08) + 0.7 * beat(0.3, 0.08));
    return all(
      [S(HEART_L, 'accent2'), S(HEART_R, 'accent2'), P([49, 13], 'accent', { width: DOT_W * 0.8 })],
      (pts) => tf.scale(pts, k, k, C, 36),
    );
  }),

  shape('coffee', 'Coffee', OBJ, (t) => {
    const steam: Pt[] = [];
    for (let i = 0; i <= 30; i++) {
      const v = i / 30;
      steam.push([29 + 3 * Math.sin(TAU * (v * 1.2 - t / 1.5)), 22 - 16 * v]);
    }
    return [
      S(line([16, 26], [18, 48], [40, 48], [42, 26], [16, 26]), 'primary'),
      S(arc(42, 36, 6, -80, 80, 16), 'primary'),
      S(steam, 'accent', { width: 3.5, opacity: 0.55 + 0.25 * Math.sin(t * 3) }),
    ];
  }),

  shape('gift', 'Gift', OBJ, (t) => {
    const u = frac(t / 1.8);
    const hop = Math.sin(PI * seg(u, 0, 0.35));
    const tilt = 10 * Math.sin(TAU * seg(u, 0, 0.35)) * hop;
    const lid = (p: Pt[]): Pt[] => tf.rotate(tf.move(p, 0, -10 * hop), tilt, C, 26);
    return [
      S(rect(15, 30, 34, 22), 'primary'),
      S(lid(rect(12, 22, 40, 8)), 'accent'),
      S(
        lid(
          join(
            cubic([C, 22], [24, 10], [18, 20], [C, 22]),
            cubic([C, 22], [46, 20], [40, 10], [C, 22]),
          ),
        ),
        'accent2',
        { width: 4 },
      ),
    ];
  }),

  shape('rocket', 'Rocket', OBJ, (t) => {
    const shake = 0.8 * Math.sin(t * 40);
    const flameLen = 7 + 4 * Math.abs(wander(t * 6, 3));
    return all(
      [
        S(
          join(
            cubic([C, 8], [42, 16], [42, 32], [40, 42]),
            L([40, 42], [24, 42]),
            cubic([24, 42], [22, 32], [22, 16], [C, 8]),
          ),
          'primary',
        ),
        S(line([24, 32], [16, 46], [24, 42], [40, 42], [48, 46], [40, 32]), 'accent'),
        S(L([C, 46], [C, 46 + flameLen]), 'alert', { width: 7 }),
      ],
      (p) => tf.move(p, shake, 0),
    );
  }),

  shape('airplane', 'Airplane', OBJ, (t) => {
    const bank = Math.cos((TAU * t) / 3);
    const plane = line(
      [C, 8],
      [35, 22],
      [52, C],
      [52, 36],
      [35, 32],
      [35, 44],
      [41, 50],
      [41, 52],
      [C, 49],
      [23, 52],
      [23, 50],
      [29, 44],
      [29, 32],
      [12, 36],
      [12, C],
      [29, 22],
      [C, 8],
    );
    const trail = (x: number): Pt[] => L([x, 40], [x, 58]);
    return [
      S(tf.scale(plane, 0.6 + 0.4 * Math.abs(bank), 1), 'primary', { width: 3.5 }),
      S(trail(C - 16 * (0.6 + 0.4 * Math.abs(bank))), 'accent', { width: 2.5, opacity: 0.45 }),
      S(trail(C + 16 * (0.6 + 0.4 * Math.abs(bank))), 'accent', { width: 2.5, opacity: 0.45 }),
    ];
  }),

  shape('anchor', 'Anchor', OBJ, (t) => {
    const sway = 8 * Math.sin((TAU * t) / 2.8);
    return all(
      [
        S(join(circle(C, 12, 4, 90), L([C, 16], [C, 50])), 'primary'),
        S(L([23, 23], [41, 23]), 'primary'),
        S(
          join(line([14, 32], [16, 38]), arc(C, 34, 16, 160, 20, 30), line([48, 38], [50, 32])),
          'accent',
        ),
      ],
      (p) => tf.rotate(p, sway, C, 8),
    );
  }),

  shape('compass', 'Compass', OBJ, (t) => {
    const u = frac(t / 3);
    // a nudge swings the needle away, then it settles back to north
    const settle =
      u < 0.12
        ? 70 * smooth(u / 0.12)
        : 70 * Math.exp(-4 * (u - 0.12)) * Math.cos(TAU * 2.5 * (u - 0.12));
    return [
      S(circle(C, C, 18), 'primary'),
      S(tf.rotate(line([C, 17], [36, C], [C, 47], [28, C], [C, 17]), settle), 'alert', {
        width: 3.5,
      }),
      P([C, C], 'accent', { width: 5 }),
    ];
  }),

  shape('trophy', 'Trophy', OBJ, (t) => {
    const u = frac(t / 2.2);
    const shine = lerp(16, 44, easeInOut(seg(u, 0.2, 0.7)));
    return [
      S(
        join(
          L([20, 14], [44, 14]),
          cubic([44, 14], [44, 30], [38, 36], [C, 36]),
          cubic([C, 36], [26, 36], [20, 30], [20, 14]),
        ),
        'accent2',
      ),
      S(line([C, 36], [C, 47], [24, 47], [40, 47]), 'accent2'),
      P([shine, 14 + (shine - 16) * 0.5], 'primary', {
        width: 5 * Math.sin(PI * seg(u, 0.2, 0.7)),
        opacity: 0.8,
      }),
    ];
  }),

  shape('crown', 'Crown', OBJ, (t) => {
    const bounce = -3 * Math.abs(Math.sin((PI * t) / 1.2));
    const tw = 0.5 + 0.5 * Math.sin(t * 5);
    return all(
      [
        S(
          line([12, 44], [14, 20], [24, 32], [C, 16], [40, 32], [50, 20], [52, 44], [12, 44]),
          'accent2',
        ),
        S(L([14, 51], [50, 51]), 'accent2'),
        P([C, 37], 'accent', { width: 6 + 3 * tw }),
      ],
      (p) => tf.move(p, 0, bounce),
    );
  }),

  shape('diamond', 'Diamond', OBJ, (t) => {
    const turn = Math.cos((TAU * t) / 3);
    const k = (p: Pt[]): Pt[] => tf.scale(p, 0.35 + 0.65 * Math.abs(turn), 1);
    const u = frac(t / 3);
    return [
      S(k(line([20, 22], [44, 22], [52, 30], [C, 52], [12, 30], [20, 22])), 'accent'),
      S(k(line([12, 30], [52, 30], [38, 30], [C, 52], [26, 30], [20, 22])), 'accent', { width: 3 }),
      P([lerp(18, 46, u), 26], 'accent2', { width: 6 * Math.sin(PI * u) }),
    ];
  }),

  shape('bulb', 'Idea', OBJ, (t) => [
    S(
      tf.scale(
        BULB,
        1 + 0.03 * Math.sin((TAU * t) / 1.8),
        1 + 0.03 * Math.sin((TAU * t) / 1.8),
        C,
        30,
      ),
      'accent2',
    ),
    S(L([26.5, 45.5], [37.5, 45.5]), 'primary'),
    S(L([29, 50.5], [35, 50.5]), 'primary'),
  ]),

  shape('home', 'Home', OBJ, (t) => {
    const u = frac(t / 2.2);
    const smoke: Pt = [43 + 4 * Math.sin(TAU * u * 1.5), lerp(16, 0, u)];
    return [
      S(line([16, 52], [16, 27], [C, 12], [48, 27], [48, 52], [16, 52]), 'primary'),
      S(line([27, 52], [27, 38], [37, 38], [37, 52]), 'accent'),
      P(smoke, 'primary', {
        width: (4 + 5 * u) * smooth(seg(u, 0, 0.1)) * (1 - smooth(seg(u, 0.7, 1))),
        opacity: 0.45,
        teleport: true,
      }),
    ];
  }),

  shape('map-pin', 'Location', OBJ, (t) => {
    const u = frac(t / 1.8);
    const h = u < 0.5 ? -12 * Math.sin(PI * (u / 0.5)) : 0;
    const squash = u >= 0.5 ? Math.sin(PI * seg(u, 0.5, 0.65)) : 0;
    const pin = join(arc(C, 24, 12, 150, 390, 40), [[C, 50]], [polar(12, 150, C, 24)]);
    const k = (p: Pt[]): Pt[] =>
      tf.scale(tf.move(p, 0, h), 1 + 0.1 * squash, 1 - 0.1 * squash, C, 50);
    return [
      S(k(pin), 'alert'),
      S(k(circle(C, 24, 4.5)), 'alert', { width: 4 }),
      S(ellipse(C, 54, 8 + h * 0.3, 2), 'primary', { width: 3, opacity: 0.3 }),
    ];
  }),

  shape('flag', 'Flag', OBJ, (t) => {
    const edge = (y: number, ph: number): Pt[] =>
      curve((u) => [16 + 32 * u, y + 3 * Math.sin(TAU * (u - t / 1.2 + ph)) * u], 30);
    const cloth = join(edge(12, 0), edge(32, 0.1).reverse(), [[16, 12]]);
    return [
      S(L([16, 10], [16, 56]), 'primary', { width: 4 }),
      S(cloth, 'accent'),
      P([16, 8], 'accent2', { width: 6 }),
    ];
  }),

  shape('balloon', 'Balloon', OBJ, (t) => {
    const bob = 3 * Math.sin((TAU * t) / 2.6);
    const sway = 4 * Math.sin((TAU * t) / 2.6 + 1);
    const string = curve(
      (u) => [C + sway * u + 2 * Math.sin(TAU * (u * 1.5 - t)) * u, 40 + bob + 18 * u],
      30,
    );
    return [
      S(tf.move(ellipse(C, 25, 12, 14), 0, bob), 'error'),
      S(string, 'primary', { width: 2.5 }),
      P([C, 40 + bob], 'error', { width: 5 }),
    ];
  }),

  shape('magnet', 'Magnet', OBJ, (t) => {
    const u = frac(t / 1.6);
    const pull = easeIn(seg(u, 0, 0.7));
    const clipP: Pt = [C, lerp(4, 22, pull)];
    return [
      S(join(L([20, 14], [20, 34]), arc(C, 34, 12, 180, 0, 30), L([44, 34], [44, 14])), 'error', {
        width: 6,
      }),
      S(arc(C, 14, 12, 180, 360, 24), 'accent', {
        width: 2.5,
        opacity: 0.3 + 0.4 * Math.sin(PI * u),
      }),
      P(clipP, 'primary', {
        width: 6 * smooth(seg(u, 0, 0.12)) * (1 - smooth(seg(u, 0.75, 0.85))),
        teleport: true,
      }),
    ];
  }),
] as const;
