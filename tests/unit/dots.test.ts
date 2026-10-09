// From the dots logo package (dotsEngine.test.ts); heavy, so the tests get a longer time limit.
import { describe, expect, it } from 'vitest';
import { N, resample } from '../../src/shared/dots/dotsGeometry';
import { AutoDirector, DotsEngine } from '../../src/shared/dots/dotsEngine';
import { DANCES, SCENES, SHAPES, getScene } from '../../src/shared/dots/dotsScenes';

const FRAME = 1 / 60;

/** largest distance any *visible* point moved between two snapshots */
function maxMove(a: Float64Array, b: Float64Array, widths?: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i += 2) {
    const stroke = Math.floor(i / 2 / N);
    if (widths && (widths[stroke] ?? 1) < 0.6) continue; // invisible strokes may teleport
    m = Math.max(m, Math.hypot((b[i] ?? 0) - (a[i] ?? 0), (b[i + 1] ?? 0) - (a[i + 1] ?? 0)));
  }
  return m;
}

let seed = 7;
const rnd = (): number => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('scenes', { timeout: 120_000 }, () => {
  it('has more than 100 dances and more than 100 shapes, all with unique keys', () => {
    expect(DANCES.length).toBeGreaterThan(100);
    expect(SHAPES.length).toBeGreaterThan(100);
    expect(new Set(SCENES.map((s) => s.key)).size).toBe(SCENES.length);
  });

  it('every scene gives 3 strokes of exactly N finite points, valid widths and opacities', () => {
    for (const s of SCENES) {
      for (let i = 0; i <= 160; i++) {
        const f = s.frame(i * 0.047);
        expect(f, s.key).toHaveLength(3);
        for (const st of f) {
          expect(st.pts, s.key).toHaveLength(N);
          expect(Number.isFinite(st.width) && st.width >= 0, `${s.key} width`).toBe(true);
          const o = st.opacity ?? 1;
          expect(o >= -0.001 && o <= 1.001, `${s.key} opacity ${o}`).toBe(true);
          for (const [x, y] of st.pts)
            expect(Number.isFinite(x) && Number.isFinite(y), `${s.key} point`).toBe(true);
        }
      }
    }
  });

  it('every scene stays on screen (inside a generous margin)', () => {
    for (const s of SCENES) {
      for (let i = 0; i <= 120; i++) {
        for (const st of s.frame(i * 0.061)) {
          if (st.width < 0.6 || (st.opacity ?? 1) < 0.05) continue;
          for (const [x, y] of st.pts) {
            expect(
              x > -8 && x < 72 && y > -8 && y < 72,
              `${s.key} off-screen at ${x.toFixed(1)},${y.toFixed(1)}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('visible targets move continuously within each scene (no hidden teleports while visible)', () => {
    for (const s of SCENES) {
      let prev = s.frame(0);
      for (let i = 1; i <= 360; i++) {
        const f = s.frame(i * FRAME);
        for (let k = 0; k < 3; k++) {
          const a = prev[k as 0 | 1 | 2];
          const b = f[k as 0 | 1 | 2];
          if (Math.min(a.width, b.width) < 0.6 || (a.opacity ?? 1) < 0.05) continue;
          let worst = 0;
          for (let p = 0; p < N; p += 4) {
            const pa = a.pts[p] ?? [0, 0];
            const pb = b.pts[p] ?? [0, 0];
            worst = Math.max(worst, Math.hypot(pb[0] - pa[0], pb[1] - pa[1]));
          }
          // generous: fast loaders and smears move quickly, a teleport would be ~20+
          expect(worst, `${s.key} stroke ${k} frame ${i}`).toBeLessThan(14);
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
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] ?? [0, 0];
      const b = pts[i] ?? [0, 0];
      expect(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - 1)).toBeLessThan(0.01);
    }
  });
});

describe('engine', { timeout: 120_000 }, () => {
  it('switching scenes never moves anything on the switch frame (3,000 random pairs)', () => {
    for (let n = 0; n < 3000; n++) {
      const from = SCENES[Math.floor(rnd() * SCENES.length)] ?? getScene('orbit');
      const to = SCENES[Math.floor(rnd() * SCENES.length)] ?? getScene('pen');
      const e = new DotsEngine(from);
      for (let i = 0; i < 20 + Math.floor(rnd() * 60); i++) e.step(FRAME);
      const before = Float64Array.from(e.pos);
      e.setScene(to);
      expect(maxMove(before, e.pos), `${from.key} → ${to.key}`).toBe(0);
    }
  });

  it('visible points move smoothly after any switch (800 random pairs)', () => {
    for (let n = 0; n < 800; n++) {
      const from = SCENES[Math.floor(rnd() * SCENES.length)] ?? getScene('orbit');
      const to = SCENES[Math.floor(rnd() * SCENES.length)] ?? getScene('pen');
      const e = new DotsEngine(from);
      for (let i = 0; i < 40; i++) e.step(FRAME);
      let prev = Float64Array.from(e.pos);
      e.setScene(to);
      for (let i = 0; i < 60; i++) {
        const widths = Float64Array.from(e.width);
        e.step(FRAME);
        expect(maxMove(prev, e.pos, widths), `${from.key} → ${to.key} frame ${i}`).toBeLessThan(6);
        prev = Float64Array.from(e.pos);
      }
    }
  });

  it('survives rapid switching and click impulses across every scene', () => {
    const e = new DotsEngine(getScene('s-mark'));
    let prev = Float64Array.from(e.pos);
    for (let i = 0; i < 6000; i++) {
      if (i % 4 === 0) e.setScene(SCENES[Math.floor(rnd() * SCENES.length)] ?? getScene('orbit'));
      if (i % 97 === 0) e.impulse();
      const widths = Float64Array.from(e.width);
      e.step(FRAME);
      for (const v of e.pos) expect(Number.isFinite(v)).toBe(true);
      expect(maxMove(prev, e.pos, widths)).toBeLessThan(8);
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
    for (let i = 0; i < 60 * 40; i++) {
      const k = d.step(FRAME);
      if (k) seen.push(k);
    }
    expect(seen.length).toBeGreaterThan(8);
    seen.forEach((k, i) => expect(getScene(k).kind).toBe(i % 2 === 0 ? 'shape' : 'dance'));
  });
});
