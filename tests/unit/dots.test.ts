// From the dots logo package (dotsEngine.test.ts); heavy, so the tests get a longer time limit.
import { describe, expect, it } from 'vitest';
import { N, resample } from '../../src/shared/dots/dotsGeometry';
import { AutoDirector, DotsEngine } from '../../src/shared/dots/dotsEngine';
import { DANCES, SCENES, SHAPES, getScene } from '../../src/shared/dots/dotsScenes';

const FRAME = 1 / 60;

/** largest distance any point moved between two snapshots */
function maxMove(a: Float64Array, b: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i += 2) {
    m = Math.max(m, Math.hypot((b[i] ?? 0) - (a[i] ?? 0), (b[i + 1] ?? 0) - (a[i + 1] ?? 0)));
  }
  return m;
}

describe('scenes', { timeout: 60_000 }, () => {
  it('has 10 dances and 14 shapes with unique keys', () => {
    expect(DANCES).toHaveLength(10);
    expect(SHAPES).toHaveLength(14);
    expect(new Set(SCENES.map((s) => s.key)).size).toBe(24);
  });

  it('every scene gives 3 strokes of exactly N finite points at all times', () => {
    for (const s of SCENES) {
      for (let i = 0; i <= 120; i++) {
        const f = s.frame(i * 0.05);
        expect(f).toHaveLength(3);
        for (const st of f) {
          expect(st.pts).toHaveLength(N);
          for (const [x, y] of st.pts) {
            expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          }
        }
      }
    }
  });

  it('dances move continuously (no teleporting dots)', () => {
    for (const s of DANCES) {
      let prev = s.frame(0);
      for (let i = 1; i <= 600; i++) {
        const f = s.frame(i * FRAME);
        for (let k = 0; k < 3; k++) {
          const a = prev[k as 0 | 1 | 2].pts[0] ?? [0, 0];
          const b = f[k as 0 | 1 | 2].pts[0] ?? [0, 0];
          expect(Math.hypot(b[0] - a[0], b[1] - a[1]), `${s.key} dot ${k}`).toBeLessThan(4);
        }
        prev = f;
      }
    }
  });

  it('resample spaces points evenly', () => {
    const pts = resample(
      [
        [0, 0],
        [10, 0],
        [10, 30],
      ],
      41,
    );
    expect(pts).toHaveLength(41);
    const step = 40 / 40;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] ?? [0, 0];
      const b = pts[i] ?? [0, 0];
      expect(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - step)).toBeLessThan(0.01);
    }
  });
});

describe('engine', { timeout: 60_000 }, () => {
  it('every scene → every scene switch is smooth (all 552 pairs)', () => {
    for (const from of SCENES) {
      for (const to of SCENES) {
        if (from === to) continue;
        const e = new DotsEngine(from);
        for (let i = 0; i < 50; i++) e.step(FRAME);
        let prev = Float64Array.from(e.pos);
        e.setScene(to);
        // switching itself never moves anything
        expect(maxMove(prev, e.pos), `${from.key} → ${to.key} jumped`).toBe(0);
        for (let i = 0; i < 90; i++) {
          e.step(FRAME);
          const move = maxMove(prev, e.pos);
          // fast, momentum-carrying motion is fine; a teleport would be far larger
          expect(move, `${from.key} → ${to.key} frame ${i}`).toBeLessThan(6);
          prev = Float64Array.from(e.pos);
        }
      }
    }
  });

  it('settles onto the target shape', () => {
    // bell-ring swings ±16° all the time, so it never sits still on its target
    for (const s of SHAPES.filter((x) => x.key !== 'bell-ring')) {
      const e = new DotsEngine(getScene('orbit'));
      e.setScene(s);
      for (let i = 0; i < 240; i++) e.step(FRAME, 1, false);
      // compare against the target at the same time, any stroke order
      const f = s.frame(e.time);
      const centroids = [0, 1, 2].map((k) => {
        let x = 0;
        let y = 0;
        for (let p = 0; p < N; p++) {
          x += e.pos[(k * N + p) * 2] ?? 0;
          y += e.pos[(k * N + p) * 2 + 1] ?? 0;
        }
        return [x / N, y / N];
      });
      for (const target of f) {
        // accent dots hop around (calendar day, falling sand) — only check the drawn strokes
        const first = target.pts[0] ?? [0, 0];
        const mid = target.pts[N >> 1] ?? [0, 0];
        if (Math.hypot(first[0] - mid[0], first[1] - mid[1]) < 1) continue;
        const tx = target.pts.reduce((a, p) => a + p[0], 0) / N;
        const ty = target.pts.reduce((a, p) => a + p[1], 0) / N;
        const nearest = Math.min(
          ...centroids.map(([x, y]) => Math.hypot((x ?? 0) - tx, (y ?? 0) - ty)),
        );
        // moving shapes (ringing bell, ticking clock) trail their target slightly
        expect(nearest, s.key).toBeLessThan(3.5);
      }
    }
  });

  it('survives rapid switching and click impulses', () => {
    const e = new DotsEngine(getScene('s-mark'));
    let seed = 11;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let prev = Float64Array.from(e.pos);
    for (let i = 0; i < 3000; i++) {
      if (i % 4 === 0) e.setScene(SCENES[Math.floor(rnd() * SCENES.length)] ?? getScene('orbit'));
      if (i % 97 === 0) e.impulse();
      e.step(FRAME);
      for (const v of e.pos) expect(Number.isFinite(v)).toBe(true);
      expect(maxMove(prev, e.pos)).toBeLessThan(8);
      prev = Float64Array.from(e.pos);
    }
  });

  it('reduced motion shows the scene without movement', () => {
    const e = new DotsEngine(getScene('orbit'), { reducedMotion: true });
    e.step(FRAME);
    const a = Float64Array.from(e.pos);
    for (let i = 0; i < 60; i++) e.step(FRAME);
    expect(maxMove(a, e.pos)).toBe(0);
  });

  it('auto mode alternates shape → dance → shape', () => {
    const d = new AutoDirector(['s-mark', 'pen']);
    const seen: string[] = [d.current];
    for (let i = 0; i < 60 * 30; i++) {
      const k = d.step(FRAME);
      if (k) seen.push(k);
    }
    expect(seen.length).toBeGreaterThan(8);
    seen.forEach((k, i) => expect(getScene(k).kind).toBe(i % 2 === 0 ? 'shape' : 'dance'));
  });
});
