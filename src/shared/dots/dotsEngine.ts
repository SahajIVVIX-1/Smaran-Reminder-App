/**
 * DotsEngine — physics for the three Smaran dots.
 *
 * Every point of every stroke is a small critically damped spring that chases
 * its target. That gives three guarantees:
 *   • position and velocity are always continuous — a scene can change at any
 *     moment (even mid-change, even 20× a second) and nothing jumps;
 *   • dots that are travelling keep their momentum into the next move;
 *   • when a dot becomes a stroke, points further along the stroke use softer
 *     springs, so the line visibly "unrolls" out of the dot.
 *
 * When a scene starts, each dot is matched to the nearest stroke (and the
 * stroke direction is chosen) so dots take the shortest, most natural paths.
 *
 * No DOM or React here, so it is unit-testable.
 */

import { CX, CY, N } from './dotsGeometry';
import {
  COLOR_TOKENS,
  DANCES,
  DOT_IDENTITY,
  getScene,
  type ColorToken,
  type DotsScene,
  type Frame,
  type SceneKey,
} from './dotsScenes';

const STROKES = 3;
const PERMS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
const SUBSTEP = 1 / 120;
/** spring speed for dancing dots */
const OMEGA = 14;
/** spring speed for forming shapes (front of the stroke; the tail is softer) */
const OMEGA_SHAPE = 10;
/** top speed of any point (units/s) so big morphs swoosh instead of streaking */
const MAX_SPEED = 300;

export interface EngineOptions {
  reducedMotion?: boolean;
  /** spring speed multiplier: >1 snappier, <1 softer. Default 1 */
  stiffness?: number;
}

export class DotsEngine {
  /** x,y for every point: [stroke][point][xy] flattened */
  readonly pos = new Float64Array(STROKES * N * 2);
  readonly vel = new Float64Array(STROKES * N * 2);
  readonly width = new Float64Array(STROKES);
  /** colour weights per stroke over COLOR_TOKENS */
  readonly color: Float64Array[] = [0, 1, 2].map(() => new Float64Array(COLOR_TOKENS.length));

  private scene: DotsScene;
  private t = 0;
  /** stroke i follows target slot slotOf[i] */
  private slotOf: [number, number, number] = [0, 1, 2];
  private reversed: [boolean, boolean, boolean] = [false, false, false];
  private omega = new Float64Array(STROKES * N);
  private reduced: boolean;
  private stiffness: number;

  private hoverW = 0;
  private pressW = 0;
  private hover = false;
  private press = false;

  constructor(scene: DotsScene, options: EngineOptions = {}) {
    this.scene = scene;
    this.reduced = options.reducedMotion ?? false;
    this.stiffness = options.stiffness ?? 1;
    const f = scene.frame(0);
    this.assign(f);
    this.setOmegas();
    this.snapTo(f);
  }

  get current(): DotsScene {
    return this.scene;
  }

  get time(): number {
    return this.t;
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
  }

  /** Change scene. Always continuous; calling again mid-change is fine. */
  setScene(scene: DotsScene, restart = false): void {
    if (!restart && scene.key === this.scene.key) return;
    this.scene = scene;
    this.t = 0;
    const f = this.scaled(scene.frame(0));
    this.assign(f);
    this.setOmegas();
    if (this.reduced) this.snapTo(f);
  }

  setInteraction(state: { hover?: boolean; press?: boolean }): void {
    if (state.hover !== undefined) this.hover = state.hover;
    if (state.press !== undefined) this.press = state.press;
  }

  /** click: the dots get a playful outward kick, then spring back */
  impulse(strength = 1): void {
    if (this.reduced) return;
    for (let s = 0; s < STROKES; s++) {
      const kick = (110 + 35 * s) * strength;
      const spin = (s - 1) * 60 * strength;
      for (let k = 0; k < N; k++) {
        const i = (s * N + k) * 2;
        const dx = (this.pos[i] ?? CX) - CX;
        const dy = (this.pos[i + 1] ?? CY) - CY;
        const len = Math.hypot(dx, dy) || 1;
        this.vel[i] = (this.vel[i] ?? 0) + (dx / len) * kick - (dy / len) * spin;
        this.vel[i + 1] = (this.vel[i + 1] ?? 0) + (dy / len) * kick + (dx / len) * spin;
      }
    }
  }

  /** advance dt real seconds; speed scales time (0.1 = slow motion) */
  step(dt: number, speed = 1, paused = false): void {
    const real = Math.min(Math.max(dt, 0), 0.1);
    const tau = paused ? 0 : real * Math.max(0, speed);

    // interaction weights move in real time
    const ease = (v: number, goal: number, rate: number): number =>
      v + (goal - v) * (1 - Math.exp(-rate * real));
    this.hoverW = ease(this.hoverW, this.hover ? 1 : 0, 12);
    this.pressW = ease(this.pressW, this.press ? 1 : 0, 26);

    if (this.reduced) {
      this.snapTo(this.scaled(this.scene.frame(0)));
      return;
    }
    if (tau === 0) return;

    this.t += tau;
    const frame = this.scaled(this.scene.frame(this.t));

    // springs, sub-stepped for stability
    const steps = Math.max(1, Math.ceil(tau / SUBSTEP));
    const h = tau / steps;
    for (let s = 0; s < STROKES; s++) {
      const slot = this.slotOf[s];
      const target = frame[slot as 0 | 1 | 2];
      const rev = this.reversed[s];
      for (let k = 0; k < N; k++) {
        const p = target.pts[rev ? N - 1 - k : k] ?? [CX, CY];
        const w = (this.omega[s * N + k] ?? OMEGA) * this.stiffness;
        const i = (s * N + k) * 2;
        let x = this.pos[i] ?? CX;
        let y = this.pos[i + 1] ?? CY;
        let vx = this.vel[i] ?? 0;
        let vy = this.vel[i + 1] ?? 0;
        for (let n = 0; n < steps; n++) {
          vx += (w * w * (p[0] - x) - 2 * w * vx) * h;
          vy += (w * w * (p[1] - y) - 2 * w * vy) * h;
          const sp = Math.hypot(vx, vy);
          if (sp > MAX_SPEED) {
            vx *= MAX_SPEED / sp;
            vy *= MAX_SPEED / sp;
          }
          x += vx * h;
          y += vy * h;
        }
        this.pos[i] = x;
        this.pos[i + 1] = y;
        this.vel[i] = vx;
        this.vel[i + 1] = vy;
      }
    }

    // width and colour glide
    const wRate = 1 - Math.exp(-9 * tau);
    const cRate = 1 - Math.exp(-7 * tau);
    for (let s = 0; s < STROKES; s++) {
      const target = frame[this.slotOf[s] as 0 | 1 | 2];
      this.width[s] = (this.width[s] ?? 0) + (target.width - (this.width[s] ?? 0)) * wRate;
      const token = this.tokenFor(s, target.color);
      const weights = this.color[s];
      if (!weights) continue;
      for (let c = 0; c < COLOR_TOKENS.length; c++) {
        const goal = COLOR_TOKENS[c] === token ? 1 : 0;
        weights[c] = (weights[c] ?? 0) + (goal - (weights[c] ?? 0)) * cRate;
      }
    }
  }

  // ---------------------------------------------------------------------------

  /** dances keep each dot's own colour; shapes use the colour of their stroke */
  private tokenFor(stroke: number, slotColor: ColorToken): ColorToken {
    return this.scene.kind === 'dance'
      ? (DOT_IDENTITY[stroke as 0 | 1 | 2] ?? slotColor)
      : slotColor;
  }

  /** hover grows the logo a little, press squeezes it */
  private scaled(f: Frame): Frame {
    const k = 1 + 0.07 * this.hoverW - 0.1 * this.pressW;
    if (Math.abs(k - 1) < 1e-4) return f;
    const sc = (s: Frame[number]): Frame[number] => ({
      ...s,
      pts: s.pts.map(([x, y]) => [CX + (x - CX) * k, CY + (y - CY) * k] as const),
    });
    return [sc(f[0]), sc(f[1]), sc(f[2])];
  }

  /** match strokes to target slots (and direction) with the least travel */
  private assign(f: Frame): void {
    const cost: number[][] = [];
    const rev: boolean[][] = [];
    for (let s = 0; s < STROKES; s++) {
      cost.push([]);
      rev.push([]);
      for (let j = 0; j < STROKES; j++) {
        const pts = f[j as 0 | 1 | 2].pts;
        let fwd = 0;
        let bwd = 0;
        for (let k = 0; k < N; k++) {
          const i = (s * N + k) * 2;
          const x = this.pos[i] ?? CX;
          const y = this.pos[i + 1] ?? CY;
          const a = pts[k] ?? [CX, CY];
          const b = pts[N - 1 - k] ?? [CX, CY];
          fwd += (x - a[0]) ** 2 + (y - a[1]) ** 2;
          bwd += (x - b[0]) ** 2 + (y - b[1]) ** 2;
        }
        cost[s]?.push(Math.min(fwd, bwd));
        rev[s]?.push(bwd < fwd);
      }
    }
    let best = PERMS[0] ?? [0, 1, 2];
    let bestCost = Infinity;
    for (const perm of PERMS) {
      const c = perm.reduce((sum, j, s) => sum + (cost[s]?.[j] ?? 0), 0);
      if (c < bestCost - 1e-9) {
        bestCost = c;
        best = perm;
      }
    }
    this.slotOf = [best[0], best[1], best[2]];
    this.reversed = [
      rev[0]?.[best[0]] ?? false,
      rev[1]?.[best[1]] ?? false,
      rev[2]?.[best[2]] ?? false,
    ];
  }

  /** dances: every point identical so dots stay round; shapes: line unrolls */
  private setOmegas(): void {
    const shape = this.scene.kind === 'shape';
    for (let s = 0; s < STROKES; s++) {
      for (let k = 0; k < N; k++) {
        const along = this.reversed[s] ? (N - 1 - k) / (N - 1) : k / (N - 1);
        this.omega[s * N + k] = shape ? OMEGA_SHAPE * (1.3 - 0.75 * along) : OMEGA;
      }
    }
  }

  private snapTo(f: Frame): void {
    for (let s = 0; s < STROKES; s++) {
      const target = f[this.slotOf[s] as 0 | 1 | 2];
      const rev = this.reversed[s];
      for (let k = 0; k < N; k++) {
        const p = target.pts[rev ? N - 1 - k : k] ?? [CX, CY];
        const i = (s * N + k) * 2;
        this.pos[i] = p[0];
        this.pos[i + 1] = p[1];
        this.vel[i] = 0;
        this.vel[i + 1] = 0;
      }
      this.width[s] = target.width;
      const token = this.tokenFor(s, target.color);
      const weights = this.color[s];
      if (weights)
        for (let c = 0; c < COLOR_TOKENS.length; c++)
          weights[c] = COLOR_TOKENS[c] === token ? 1 : 0;
    }
  }
}

/**
 * Auto mode: alternates dance → shape → dance → shape…
 * Shapes follow `sequence`; dances rotate through every dance.
 */
export class AutoDirector {
  private readonly shapes: readonly SceneKey[];
  private readonly dances: readonly string[];
  private shapeIndex = 0;
  private danceIndex = 0;
  private elapsed = 0;
  private onShape = true;
  current: string;

  constructor(sequence: readonly SceneKey[]) {
    this.shapes = sequence.length ? sequence : ['s-mark'];
    this.dances = DANCES.map((d) => d.key);
    this.current = this.shapes[0] ?? 's-mark';
  }

  /** advance by animation time; returns the new scene key when it changes */
  step(dt: number): string | null {
    this.elapsed += dt;
    if (this.elapsed < getScene(this.current).hold) return null;
    this.elapsed = 0;
    if (this.onShape) {
      this.current = this.dances[this.danceIndex % this.dances.length] ?? 'orbit';
      this.danceIndex++;
    } else {
      this.shapeIndex++;
      this.current = this.shapes[this.shapeIndex % this.shapes.length] ?? 's-mark';
    }
    this.onShape = !this.onShape;
    return this.current;
  }
}
