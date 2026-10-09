/** Shapes · Time, Communication, Writing & work */
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
  easeInOut,
  easeOut,
  easeOutBack,
  frac,
  join,
  lerp,
  line,
  polar,
  quad,
  rect,
  roundRect,
  seg,
  shape,
  smooth,
  stepHold,
  tf,
  waveLine,
  drawUndo,
  type Pt,
} from './kit';

const TIME = 'Time';
const COMM = 'Communication';
const WORK = 'Writing & work';

const RING = circle(C, C, 18);
const L = (a: Pt, b: Pt): Pt[] => line(a, b);
/** hands as one L-shaped stroke: tip1 → centre → tip2 */
const hands = (cx: number, cy: number, h: number, m: number, lh = 8, lm = 12): Pt[] =>
  line(polar(lh, h, cx, cy), [cx, cy], polar(lm, m, cx, cy));

const GLASS = line([19, 13], [45, 13], [33.5, 31], [45, 51], [19, 51], [30.5, 31], [19, 13]);
const BELL_DOME = join(
  cubic([17, 43], [22, 40], [19, 15], [32, 15]),
  cubic([32, 15], [45, 15], [42, 40], [47, 43]),
);
const BELL_BASE = L([13, 44], [51, 44]);
const BELL_CLAPPER = arc(32, 48, 4, 0, 180);
const ENV_BOX = rect(13, 20, 38, 26);
const CAL_BOX = rect(14, 15, 36, 35);
const CAL_HEAD = L([20, 25.5], [44, 25.5]);
const PEN_BODY = line([50.5, 16.5], [26.5, 40.5], [19.5, 33.5], [43.5, 9.5], [50.5, 16.5]);
const PEN_NIB = line([26.5, 40.5], [14.5, 49.5], [19.5, 33.5]);

export const SHAPES_A = [
  // ── Time ───────────────────────────────────────────────────────────────
  shape('clock', 'Clock', TIME, (t) => [
    S(RING, 'primary'),
    S(L([C, C], polar(9, -30 + (360 * t) / 48)), 'accent'),
    S(L([C, C], polar(13, -90 + (360 * t) / 4)), 'accent2'),
  ]),

  shape('alarm-clock', 'Alarm clock', TIME, (t) => {
    const p = frac(t / 1.6);
    const env = p < 0.6 ? Math.sin(PI * (p / 0.6)) : 0;
    const shake = 9 * Math.sin(TAU * 12 * p) * env;
    return all(
      [
        S(circle(C, 35, 14), 'primary'),
        S(hands(C, 35, -90 + 20 * t, -90 + 120 * t, 7, 10), 'accent'),
        S(arc(C, 35, 20, 215, 325), env > 0.05 ? 'alert' : 'primary'),
      ],
      (pts) => tf.rotate(pts, shake, C, 35),
    );
  }),

  shape('stopwatch', 'Stopwatch', TIME, (t) => {
    const lap = frac(t / 2);
    const press = Math.max(0, 1 - lap * 8);
    return [
      S(circle(C, 35, 15), 'primary'),
      S(L([C, 35], polar(11, -90 + 360 * lap, C, 35)), 'accent2'),
      S(L([C, 19 + 2 * press], [C, 12 + 2 * press]), 'accent', { width: 6 }),
    ];
  }),

  shape('timer', 'Countdown timer', TIME, (t) => {
    const u = frac(t / 3);
    // drains for most of the cycle, then sweeps back to full
    const left = u < 0.8 ? 1 - u / 0.8 : easeInOut((u - 0.8) / 0.2);
    const ping = Math.max(0, 1 - Math.abs(u - 0.9) * 8);
    return [
      S(RING, 'primary', { opacity: 0.22 }),
      S(arc(C, C, 18, -90, -90 + 360 * Math.max(0.02, left), 64), left < 0.2 ? 'alert' : 'accent2'),
      P([C, C], 'accent', { width: 6 + 6 * ping }),
    ];
  }),

  shape('hourglass', 'Hourglass', TIME, (t) => {
    const p = frac(t / 0.8);
    const fill = 0.6 + 0.4 * Math.min(1, t / 2.6);
    return [
      S(GLASS, 'primary'),
      S(line([32 - 8 * fill, 49], [32, 49 - 6 * fill], [32 + 8 * fill, 49]), 'accent2'),
      P([32, 32 + 14 * p * p], 'accent2', { width: DOT_W * 0.6 }),
    ];
  }),

  shape('hourglass-flip', 'Hourglass flip', TIME, (t) => {
    const n = Math.floor(t / 2.6);
    const u = frac(t / 2.6);
    const rot = 180 * (n - 1) + 180 * easeInOut(seg(u, 0, 0.25));
    const p = seg(u, 0.25, 0.95);
    const odd = n % 2 === 1;
    const topFill = odd ? p : 1 - p;
    const botFill = odd ? 1 - p : p;
    const top = line([32 - 8 * topFill, 16], [32, 16 + 11 * topFill], [32 + 8 * topFill, 16]);
    const bot = line([32 - 8 * botFill, 48], [32, 48 - 9 * botFill], [32 + 8 * botFill, 48]);
    return all(
      [S(GLASS, 'primary'), S(top, 'accent2', { width: 4 }), S(bot, 'accent2', { width: 4 })],
      (pts) => tf.rotate(pts, rot),
    );
  }),

  shape('calendar', 'Calendar', TIME, (t) => {
    const days: Pt[] = [
      [23, 34],
      [32, 34],
      [41, 34],
      [23, 42],
      [32, 42],
      [41, 42],
    ];
    const step = Math.floor(t / 0.7);
    const u = easeInOut(Math.min(1, frac(t / 0.7) / 0.5));
    const a = days[step % 6] ?? [32, 34];
    const b = days[(step + 1) % 6] ?? [32, 34];
    return [
      S(CAL_BOX, 'primary'),
      S(CAL_HEAD, 'primary'),
      P([lerp(a[0], b[0], u), lerp(a[1], b[1], u) - 4 * Math.sin(PI * u)], 'accent'),
    ];
  }),

  shape('calendar-check', 'Calendar done', TIME, (t) => {
    const u = frac(t / 2.6);
    const check = line([22, 37], [29, 43.5], [42, 30]);
    return [
      S(CAL_BOX, 'primary'),
      S(CAL_HEAD, 'primary'),
      S(tf.trim(check, 0, drawUndo(u, 0.15, 0.5, 0.82, 1)), 'success'),
    ];
  }),

  shape('wristwatch', 'Wristwatch', TIME, (t) => {
    const tick = stepHold(t / 0.5, 0.3);
    const lift = 1.5 * Math.sin((TAU * t) / 3);
    return all(
      [
        S(join(L([C, 6], [C, 21]), arc(C, C, 11, -90, 450, 72), L([C, 43], [C, 58])), 'primary', {
          width: 4.5,
        }),
        S(hands(C, C, -60 + 2 * tick, -90 + 30 * tick, 5, 8), 'accent', { width: 3.5 }),
        P([45, C], 'accent2', { width: 5 }),
      ],
      (pts) => tf.move(pts, 0, lift),
    );
  }),

  shape('history', 'Rewind', TIME, (t) => {
    const spin = -360 * stepHold(t / 2.4, 0.55);
    const start = polar(17, 210);
    const head = line([start[0] - 5, start[1] - 4], start, [start[0] + 1, start[1] - 7]);
    return [
      S(tf.rotate(arc(C, C, 17, 210, -60, 48), spin * 0.25), 'primary'),
      S(hands(C, C, -90 + spin, 0 + spin * 0.2, 8, 9), 'accent'),
      S(tf.rotate(head, spin * 0.25), 'primary', { width: 4 }),
    ];
  }),

  shape('metronome-shape', 'Metronome', TIME, (t) => {
    const a = 26 * Math.sin((TAU * t) / 1.2);
    return [
      S(line([21, 52], [43, 52], [37, 12], [27, 12], [21, 52]), 'primary'),
      S(L([C, 46], polar(28, -90 + a, C, 46)), 'accent', { width: 3.5 }),
      P(polar(17, -90 + a, C, 46), 'accent2', { width: 8 }),
    ];
  }),

  // ── Communication ──────────────────────────────────────────────────────
  shape('bell', 'Bell', COMM, (t) => {
    const sw = 5 * Math.sin((TAU * t) / 2.4);
    return [
      S(tf.rotate(BELL_DOME, sw, 32, 11), 'primary'),
      S(tf.rotate(BELL_BASE, sw, 32, 11), 'primary'),
      S(tf.rotate(BELL_CLAPPER, sw * 1.6, 32, 11), 'accent'),
    ];
  }),

  shape('bell-ring', 'Bell ringing', COMM, (t) => {
    const p = frac(t / 1.6);
    const env = p < 0.65 ? Math.sin(PI * (p / 0.65)) : 0;
    const sw = 16 * Math.sin(TAU * 4 * p) * env;
    return [
      S(tf.rotate(BELL_DOME, sw, 32, 11), 'alert'),
      S(tf.rotate(BELL_BASE, sw, 32, 11), 'alert'),
      S(tf.rotate(BELL_CLAPPER, sw * 1.8, 32, 11), 'accent'),
    ];
  }),

  shape('envelope', 'Message', COMM, (t) => {
    const dy = -1.5 * Math.sin((TAU * t) / 2.2);
    const pop = 1 + 0.35 * Math.max(0, Math.sin((TAU * t) / 1.1)) ** 4;
    return [
      S(tf.move(ENV_BOX, 0, dy), 'primary'),
      S(tf.move(line([18, 25], [32, 35], [46, 25]), 0, dy), 'accent'),
      P([51, 19 + dy], 'accent2', { width: DOT_W * 0.9 * pop }),
    ];
  }),

  shape('envelope-open', 'Open letter', COMM, (t) => {
    const u = frac(t / 2.8);
    const open = smooth(seg(u, 0.1, 0.35)) * (1 - smooth(seg(u, 0.75, 0.95)));
    const letter = easeOutBack(seg(u, 0.3, 0.55)) * (1 - smooth(seg(u, 0.62, 0.8)));
    return [
      S(rect(13, 26, 38, 26), 'primary'),
      S(line([13, 27], [32, lerp(41, 10, open)], [51, 27]), 'accent'),
      S(L([23, 36 - 18 * letter], [41, 36 - 18 * letter]), 'accent2', { width: 4.5 }),
    ];
  }),

  shape('chat-typing', 'Typing…', COMM, (t) => {
    const n = Math.floor(t / 0.35);
    const u = frac(t / 0.35);
    const xs = [23, 32, 41, 32];
    const a = xs[n % 4] ?? 32;
    const b = xs[(n + 1) % 4] ?? 32;
    return [
      S(roundRect(12, 13, 40, 27, 8), 'primary'),
      S(line([20, 39], [17, 49], [29, 39.5]), 'primary'),
      P([lerp(a, b, easeInOut(u)), 26.5 - 3 * Math.sin(PI * u)], 'accent', { width: 7 }),
    ];
  }),

  shape('phone-ring', 'Phone ringing', COMM, (t) => {
    const p = frac(t / 1.4);
    const buzz = p < 0.5 ? 6 * Math.sin(TAU * 10 * p) * Math.sin(PI * (p / 0.5)) : 0;
    const handset = join(
      L([27, 12], [21, 14]),
      cubic([21, 14], [10, 25], [21, 45], [34, 48]),
      L([34, 48], [39, 43]),
    );
    const w1 = 0.25 + 0.75 * Math.max(0, Math.sin(TAU * (p - 0.05)));
    const w2 = 0.25 + 0.75 * Math.max(0, Math.sin(TAU * (p - 0.2)));
    return [
      S(tf.rotate(handset, buzz, 26, 30), 'primary', { width: 6 }),
      S(arc(28, 30, 12, -70, -20), 'accent', { opacity: w1 }),
      S(arc(28, 30, 19, -70, -20), 'accent2', { opacity: w2 }),
    ];
  }),

  shape('at-sign', 'At sign', COMM, (t) => {
    const r = 6 * Math.sin((TAU * t) / 3);
    return all(
      [
        S(circle(C, C, 6.5), 'primary'),
        S(
          join(
            L([38.5, 26], [38.5, 35]),
            quad([38.5, 35], [39.5, 40], [44.5, 38.5]),
            arc(C, C, 15, 18, -285, 64),
          ),
          'primary',
        ),
        P(polar(15, -285 + (360 * t) / 3), 'accent', { width: 6 }),
      ],
      (pts) => tf.rotate(pts, r),
    );
  }),

  shape('inbox', 'Inbox', COMM, (t) => {
    const u = frac(t / 1.8);
    const y = lerp(2, 30, easeOut(seg(u, 0, 0.6)));
    const show = smooth(seg(u, 0, 0.1)) * (1 - smooth(seg(u, 0.55, 0.7)));
    return [
      S(line([12, 30], [12, 50], [52, 50], [52, 30]), 'primary'),
      S(line([12, 39], [23, 39], [27, 44], [37, 44], [41, 39], [52, 39]), 'primary'),
      S(rect(24, y, 16, 10), 'accent', { width: 3.5 * show, teleport: true }),
    ];
  }),

  shape('paper-plane', 'Paper plane', COMM, (t) => {
    const a = (TAU * t) / 3;
    const dx = 3 * Math.cos(a);
    const dy = 3 * Math.sin(2 * a);
    const tilt = 6 * Math.sin(a);
    return [
      S(
        tf.rotate(tf.move(line([10, 30], [52, 14], [36, 48], [30, 34], [10, 30]), dx, dy), tilt),
        'primary',
      ),
      S(tf.rotate(tf.move(L([30, 34], [52, 14]), dx, dy), tilt), 'accent'),
      S(tf.move(waveLine(2, 16, 42, 2, 1.5, -t * 2), dx, dy), 'accent2', {
        width: 3,
        opacity: 0.6,
      }),
    ];
  }),

  shape('megaphone', 'Megaphone', COMM, (t) => {
    const wave = (ph: number) => {
      const u = frac(t / 1.2 + ph);
      return S(arc(46, C, 6 + 12 * u, -40, 40, 24), 'accent', {
        opacity: 1 - u,
        width: LINE_W * (1 - smooth(seg(u, 0.85, 1))),
        teleport: true,
      });
    };
    return [
      S(line([12, 28], [26, 28], [42, 16], [42, 48], [26, 36], [12, 36], [12, 28]), 'primary'),
      wave(0),
      wave(0.5),
    ];
  }),

  shape('notification-badge', 'Notification', COMM, (t) => {
    const u = frac(t / 2);
    const pop = easeOutBack(seg(u, 0.05, 0.3)) * (1 - smooth(seg(u, 0.8, 0.95)));
    const wiggle = 4 * Math.sin(TAU * 3 * u) * Math.max(0, 1 - u * 3);
    return all(
      [
        S(roundRect(14, 18, 30, 30, 8), 'primary'),
        S(circle(29, 33, 6), 'accent'),
        P([44, 18], 'alert', { width: 11 * pop }),
      ],
      (pts) => tf.rotate(pts, wiggle, 29, 33),
    );
  }),

  shape('mailbox', 'Mailbox', COMM, (t) => {
    const u = frac(t / 3);
    const up = smooth(seg(u, 0.2, 0.4)) * (1 - smooth(seg(u, 0.8, 0.95)));
    const body = join(
      L([12, 44], [12, 30]),
      arc(24, 30, 12, 180, 360, 24),
      L([36, 30], [36, 44]),
      L([36, 44], [12, 44]),
    );
    const flag = line([43, 44], [43, 22], [51, 22], [51, 28], [43, 28]);
    return [
      S(body, 'primary'),
      S(L([24, 44], [24, 56]), 'primary'),
      S(tf.rotate(flag, -90 + 90 * up, 43, 44), up > 0.5 ? 'alert' : 'accent', { width: 4 }),
    ];
  }),

  // ── Writing & work ─────────────────────────────────────────────────────
  shape('pen', 'Pen writing', WORK, (t) => {
    const phase = (TAU * t) / 1.4;
    const wig = 1.2 * Math.sin(phase);
    return [
      S(tf.move(PEN_BODY, wig, 0), 'primary'),
      S(tf.move(PEN_NIB, wig, 0), 'accent'),
      S(waveLine(27, 52, 54, 2.2, 1.5, -phase / TAU), 'accent2', { width: LINE_W * 0.9 }),
    ];
  }),

  shape('pencil', 'Pencil sketch', WORK, (t) => {
    const u = frac(t / 2.4);
    const zig = line([10, 52], [16, 46], [22, 52], [28, 46], [34, 52], [40, 46], [44, 50]);
    const shown = tf.trim(zig, 0, drawUndo(u, 0, 0.7, 0.78, 1));
    // the pencil tip rides the end of the line being drawn
    const tip = shown[shown.length - 1] ?? [12, 52];
    const d: Pt = [Math.SQRT1_2, -Math.SQRT1_2];
    const n: Pt = [3.6 * Math.SQRT1_2, 3.6 * Math.SQRT1_2];
    const at = (k: number, side: number): Pt => [
      tip[0] + d[0] * k + n[0] * side,
      tip[1] + d[1] * k + n[1] * side,
    ];
    return [
      S(line(at(8, 1), at(24, 1), at(24, -1), at(8, -1), at(8, 1)), 'primary', { width: 4 }),
      S(line(at(8, 1), tip, at(8, -1)), 'accent', { width: 4 }),
      S(shown, 'accent2', { width: 3.5 }),
    ];
  }),

  shape('brush', 'Paint brush', WORK, (t) => {
    const u = frac(t / 2.4);
    const paint = waveLine(10, 46, 50, 3, 1, 0.1);
    const shown = tf.trim(paint, 0, drawUndo(u, 0, 0.65, 0.75, 1));
    const tip = shown[shown.length - 1] ?? [10, 50];
    return [
      S(L([tip[0] + 4, tip[1] - 10], [tip[0] + 13, tip[1] - 26]), 'primary', { width: 4.5 }),
      S(L(tip, [tip[0] + 4, tip[1] - 9]), 'accent', { width: 8 }),
      S(shown, 'accent', { width: 6 }),
    ];
  }),

  shape('sticky-note', 'Sticky note', WORK, (t) => {
    const u = frac(t / 2.8);
    const sway = 4 * Math.sin((TAU * t) / 2.8);
    const write = drawUndo(u, 0.1, 0.6, 0.78, 0.98);
    return all(
      [
        S(line([14, 14], [50, 14], [50, 40], [40, 50], [14, 50], [14, 14]), 'accent2'),
        S(line([50, 40], [40, 40], [40, 50]), 'accent2', { width: 4 }),
        S(tf.trim(waveLine(20, 42, 28, 1.6, 2.5), 0, write), 'primary', { width: 3.5 }),
      ],
      (pts) => tf.rotate(pts, sway, C, 14),
    );
  }),

  shape('checklist', 'Checklist', WORK, (t) => {
    const n = Math.floor(t / 1.6) % 2;
    const u = frac(t / 1.6);
    const move = easeInOut(seg(u, 0.75, 1));
    const fromY = n === 0 ? 24 : 40;
    const toY = n === 0 ? 40 : 24;
    const y = lerp(fromY, toY, move);
    const check = line([12, y], [16, y + 4], [23, y - 4]);
    return [
      S(check, 'success'),
      S(L([30, 24], [52, 24]), 'primary'),
      S(L([30, 40], [52, 40]), 'primary'),
    ];
  }),

  shape('clipboard', 'Clipboard', WORK, (t) => {
    const u = frac(t / 2.4);
    return [
      S(roundRect(16, 14, 32, 40, 5), 'primary'),
      S(roundRect(25, 9, 14, 9, 3), 'accent', { width: 4 }),
      S(tf.trim(line([23, 34], [30, 41], [42, 27]), 0, drawUndo(u, 0.15, 0.5, 0.82, 1)), 'success'),
    ];
  }),

  shape('paperclip', 'Paperclip', WORK, (t) => {
    const slide = 4 * Math.sin((TAU * t) / 2.6);
    const clip = join(
      L([28, 40], [28, 22]),
      arc(33, 22, 5, 180, 360, 12),
      L([38, 22], [38, 46]),
      arc(31, 46, 7, 0, 180, 14),
      L([24, 46], [24, 18]),
      arc(32, 18, 8, 180, 360, 14),
      L([40, 18], [40, 30]),
    );
    return [
      S(line([12, 24], [12, 56], [44, 56]), 'primary', { opacity: 0.45, width: 3 }),
      S(tf.move(clip, 0, slide), 'accent', { width: 3.6 }),
      P([48, 12], 'accent2', { width: 6 * (0.5 + 0.5 * Math.sin((TAU * t) / 1.3)) }),
    ];
  }),

  shape('pushpin', 'Pushpin', WORK, (t) => {
    const u = frac(t / 2.4);
    const drop = u < 0.4 ? 1 - easeOutBounce(u / 0.4) : u < 0.8 ? 0 : easeInOut(seg(u, 0.8, 1));
    const dy = -16 * drop;
    const wob = 6 * Math.sin(TAU * 3 * seg(u, 0.25, 0.6)) * (1 - seg(u, 0.25, 0.6));
    return [
      S(tf.rotate(tf.move(L([24, 20], [40, 20]), 0, dy), wob, C, 46), 'accent2', { width: 9 }),
      S(tf.rotate(tf.move(L([C, 22], [C, 46]), 0, dy), wob, C, 46), 'primary', { width: 3.5 }),
      S(L([C - 8 + 4 * drop, 50], [C + 8 - 4 * drop, 50]), 'primary', { width: 3, opacity: 0.3 }),
    ];
  }),

  shape('bookmark', 'Bookmark', WORK, (t) => {
    const u = frac(t / 2.4);
    const slide = 1 - easeOutBack(seg(u, 0, 0.4));
    const saved = easeOutBack(seg(u, 0.35, 0.5)) * (1 - smooth(seg(u, 0.85, 1)));
    return [
      S(
        tf.move(line([20, 10], [44, 10], [44, 52], [32, 42], [20, 52], [20, 10]), 0, -10 * slide),
        'accent',
      ),
      S(L([26, 22], [38, 22]), 'primary', {
        width: 3.5,
        opacity: Math.min(1, Math.max(0, 1 - slide)),
      }),
      P([50, 12], 'accent2', { width: 8 * saved }),
    ];
  }),

  shape('folder', 'Folder', WORK, (t) => {
    const open = smooth(0.5 - 0.5 * Math.cos((TAU * t) / 2.6));
    const frontTop = lerp(26, 34, open);
    const frontX = lerp(17, 8, open);
    return [
      S(line([12, 48], [12, 16], [26, 16], [30, 21], [52, 21], [52, 48], [12, 48]), 'primary'),
      S(line([12, 48], [frontX, frontTop], [frontX + 40, frontTop], [52, 48]), 'accent'),
      S(L([22, 30 - 8 * open], [42, 30 - 8 * open]), 'accent2', { width: 4, opacity: open }),
    ];
  }),

  shape('document', 'Document', WORK, (t) => {
    const scroll = frac(t / 1.6);
    return [
      S(line([16, 10], [40, 10], [48, 18], [48, 54], [16, 54], [16, 10]), 'primary'),
      S(line([40, 10], [40, 18], [48, 18]), 'primary', { width: 4 }),
      S(waveLine(22, 42, 34, 2.4, 3, -scroll), 'accent', { width: 3.5 }),
    ];
  }),

  shape('scissors', 'Scissors', WORK, (t) => {
    const open = 14 * (0.5 + 0.5 * Math.sin((TAU * t) / 0.9));
    const blade = (ring: Pt, tip: Pt): Pt[] =>
      join(circle(ring[0], ring[1], 5, 0), L([ring[0] + 4, ring[1] - 3], tip));
    return [
      S(tf.rotate(blade([18, 46], [50, 16]), -open / 2, C, 31), 'primary', { width: 4 }),
      S(tf.rotate(blade([46, 46], [14, 16]), open / 2, C, 31), 'accent', { width: 4 }),
      P([C, 31], 'accent2', { width: 6 }),
    ];
  }),
] as const;

function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
