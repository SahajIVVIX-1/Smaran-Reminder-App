/** Dances · Mechanics */
import {
  C,
  DOT_W,
  PI,
  TAU,
  capsule,
  circle,
  curve,
  dot,
  easeInOut,
  frac,
  lerp,
  line,
  motion,
  path,
  polar,
  seg,
  smooth,
  stepHold,
  trio,
  type Pt,
} from './kit';

const CAT = 'Mechanics';
const ROW = [20, 32, 44] as const;
const RAD = PI / 180;

/** gear outline: radius R, n teeth, rotated by deg */
const gear = (cx: number, cy: number, R: number, n: number, deg: number): Pt[] =>
  curve((u) => {
    const a = TAU * u;
    const tooth = Math.tanh(3 * Math.cos(n * a)) * 0.5 + 0.5;
    const r = R - 1.6 + 3.2 * tooth;
    return [cx + r * Math.cos(a + deg * RAD), cy + r * Math.sin(a + deg * RAD)];
  }, 96);

/** stadium track for the conveyor */
const stadium = (s: number): Pt => {
  const w = 30;
  const r = 8;
  const total = 2 * w + TAU * r;
  let d = frac(s) * total;
  if (d < w) return [C - w / 2 + d, C - r];
  d -= w;
  if (d < PI * r) return polar(r, -90 + (180 * d) / (PI * r), C + w / 2, C);
  d -= PI * r;
  if (d < w) return [C + w / 2 - d, C + r];
  d -= w;
  return polar(r, 90 + (180 * d) / (PI * r), C - w / 2, C);
};

/** two-link inverse kinematics: elbow position for a hand target */
const ik = (base: Pt, hand: Pt, l1: number, l2: number): Pt => {
  const dx = hand[0] - base[0];
  const dy = hand[1] - base[1];
  const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx);
  const b = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  return [base[0] + l1 * Math.cos(a - b), base[1] + l1 * Math.sin(a - b)];
};

export const MECH_DANCES = [
  motion('piston', 'Piston engine', CAT, 3.2, (t) => {
    const phi = TAU * (t / 0.9);
    const r = 7;
    const L = 17;
    const pin: Pt = [C + r * Math.sin(phi), 44 - r * Math.cos(phi)];
    const py = 44 - (r * Math.cos(phi) + Math.sqrt(L * L - (r * Math.sin(phi)) ** 2));
    return [
      dot(pin, 0, { width: 7 }),
      path(line(pin, [C, py]), 1, { width: 3.5 }),
      capsule([C, py], 0, 8, 2, { width: 9 }),
    ];
  }),

  motion('gear-mesh', 'Meshing gears', CAT, 3.4, (t) => {
    const a = 40 * t;
    return [
      path(gear(25, C, 10, 8, a), 0, { width: 3 }),
      path(gear(42.6, C, 7.5, 6, -a * (8 / 6) + 30), 1, { width: 3 }),
      dot([25, C], 2, { width: 6 }),
    ];
  }),

  motion('planetary-gear', 'Planetary gearbox', CAT, 3.4, (t) => {
    const carrier = 30 * t;
    return [
      path(circle(C, C, 20), 0, { width: 3, opacity: 0.6 }),
      dot([C, C], 1, { width: 11 + 1.5 * Math.sin(t * 3) }),
      dot(polar(13, carrier), 2, { width: 8 }),
    ];
  }),

  motion('conveyor', 'Conveyor belt', CAT, 3.4, (t) =>
    trio((k) => {
      const s = t / 3 + k / 3;
      const p = stadium(s);
      const ahead = stadium(s + 0.005);
      const ang = (Math.atan2(ahead[1] - p[1], ahead[0] - p[0]) * 180) / PI;
      return capsule(p, ang, 5, k, { width: 7 });
    }),
  ),

  motion('ferris-wheel', 'Ferris wheel', CAT, 3.6, (t) => {
    const a = (360 * t) / 6;
    const gondola = (off: number, k: 1 | 2) => {
      const hub = polar(16, a + off);
      const swing = 4 * Math.sin((TAU * t) / 1.5 + off);
      return dot([hub[0] + swing * 0.3, hub[1] + 4], k, { width: 8 });
    };
    return [
      path(circle(C, C, 16), 0, { width: 2.5, opacity: 0.7 }),
      gondola(0, 1),
      gondola(180, 2),
    ];
  }),

  motion('slot-machine', 'Slot machine', CAT, 3.6, (t) =>
    trio((k) => {
      const u = frac(t / 3.2);
      const stop = 0.35 + 0.13 * k;
      const x = Math.min(1, u / stop);
      // the reel winds up, spins, and settles with a little bounce
      const s = 2 * easeInOut(x) + 0.06 * Math.sin(PI * seg(x, 0.82, 1));
      const y = 10 + 44 * frac(0.5 + s);
      // a spinning reel is a blur: the symbol only firms up as the reel slows
      const firm = 1 - smooth(seg(x, 0.1, 0.25)) + smooth(seg(x, 0.6, 0.85));
      const w =
        DOT_W * Math.min(1, firm) * Math.min(1, smooth((y - 10) / 14), smooth((54 - y) / 14));
      return dot([ROW[k], y], k, { width: w, teleport: true });
    }),
  ),

  motion('typewriter', 'Typewriter', CAT, 3.6, (t) => {
    const u = frac(t / 3.2);
    const typing = seg(u, 0, 0.75);
    const chars = 7;
    const head = 14 + 34 * (stepHold(typing * chars, 0.4) / chars);
    const strike = Math.max(0, Math.sin(PI * frac(typing * chars))) ** 6;
    const ret = easeInOut(seg(u, 0.8, 0.95));
    const x = lerp(head, 14, ret);
    const textEnd = lerp(Math.max(14.1, head - 3), 14.1, ret);
    const ding = Math.max(0, 1 - Math.abs(u - 0.78) * 25);
    return [
      path(line([14, 40], [textEnd, 40]), 0, { width: 3.5, opacity: 1 - ret }),
      dot([x, 30 + 5 * strike], 1, { width: 8 }),
      dot([52, 20], 2, { width: 8 * ding, teleport: true }),
    ];
  }),

  motion('escapement', 'Clock escapement', CAT, 3.6, (t) => {
    const a = 22 * Math.sin((TAU * t) / 1.4);
    const bob = polar(24, 90 + a, C, 10);
    const tick = 15 * stepHold(t / 0.7, 0.25);
    return [
      path(line([C, 10], bob), 0, { width: 2.5 }),
      dot(bob, 1, { width: 10 }),
      path(gear(C, 44, 7, 8, tick), 2, { width: 2.5 }),
    ];
  }),

  motion('pumpjack', 'Pumpjack', CAT, 3.4, (t) => {
    const phi = TAU * (t / 2);
    const tilt = 14 * Math.sin(phi);
    const left = polar(16, 180 + tilt, C, 24);
    const right = polar(14, tilt, C, 24);
    const crank = polar(5, (phi * 180) / PI, 48, 44);
    return [
      path(line(left, right), 0, { width: 4 }),
      dot([left[0], left[1] + 3], 1, { width: 9 }),
      dot(crank, 2, { width: 7 }),
    ];
  }),

  motion('windmill', 'Windmill', CAT, 3.4, (t) => {
    const a = (360 * t) / 2 + 50 * Math.sin((TAU * t) / 5);
    return trio((k) => path(line([C, C], polar(17, a + 120 * k)), k, { width: 6 }));
  }),

  motion('robot-arm', 'Robot arm (IK)', CAT, 4, (t) => {
    const base: Pt = [C, 52];
    const A: Pt = [14, 44];
    const B: Pt = [50, 44];
    const u = frac(t / 4.4);
    const round = Math.floor(t / 4.4) % 2;
    const from = round ? B : A;
    const to = round ? A : B;
    const rest: Pt = [C, 22];
    // reach → grab → carry → drop → rest
    let hand: Pt;
    if (u < 0.22)
      hand = [
        lerp(rest[0], from[0], easeInOut(u / 0.22)),
        lerp(rest[1], from[1] - 5, easeInOut(u / 0.22)),
      ];
    else if (u < 0.3) hand = [from[0], from[1] - 5];
    else if (u < 0.65) {
      const v = easeInOut(seg(u, 0.3, 0.65));
      hand = [lerp(from[0], to[0], v), lerp(from[1] - 5, to[1] - 5, v) - 14 * Math.sin(PI * v)];
    } else if (u < 0.75) hand = [to[0], to[1] - 5];
    else
      hand = [
        lerp(to[0], rest[0], easeInOut(seg(u, 0.75, 1))),
        lerp(to[1] - 5, rest[1], easeInOut(seg(u, 0.75, 1))),
      ];
    const carrying = u >= 0.3 && u < 0.7;
    const object: Pt = carrying ? [hand[0], hand[1] + 5] : u < 0.3 ? from : to;
    const elbow = ik(base, hand, 19, 19);
    return [
      path(line(base, elbow, hand), 0, { width: 4.5 }),
      dot(object, 1, { width: 9 }),
      dot(base, 2, { width: 8 }),
    ];
  }),

  motion('hammer', 'Hammer and nail', CAT, 3.4, (t) => {
    const u = frac(t / 0.8);
    const n = Math.floor(t / 0.8) % 4;
    const swing =
      u < 0.6
        ? -55 * Math.sin((PI / 2) * (u / 0.6))
        : -55 + 55 * Math.min(1, ((u - 0.6) / 0.15) ** 2);
    const pivot: Pt = [48, 30];
    const head = polar(18, 180 + swing, pivot[0], pivot[1]);
    const depth = n + smooth(seg(u, 0.75, 0.8));
    // after the fourth blow the nail is pulled back out, ready to go again
    const nailTop =
      n === 3 ? lerp(30 + 3.5 * depth, 30, smooth(seg(u, 0.85, 1))) : 30 + 3.5 * depth;
    return [
      path(line(pivot, head), 0, { width: 4 }),
      capsule([head[0], head[1]], 90 + swing, 8, 1, { width: 6 }),
      path(line([30, nailTop], [30, 44]), 2, { width: 3.5 }),
    ];
  }),
] as const;
