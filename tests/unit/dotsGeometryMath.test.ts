import { describe, expect, it } from 'vitest';
import {
  arc,
  circle,
  clamp01,
  cubic,
  CX,
  CY,
  dotPts,
  easeInOut,
  frac,
  hump,
  join,
  N,
  polar,
  resample,
  rotate,
  scale,
  translate,
  type Pt,
} from '../../src/shared/dots/dotsGeometry';

describe('dotsGeometry - Geometric Primitives and Kinematics Math', () => {
  describe('resample', () => {
    it('handles empty polyline by returning N points at center (CX, CY)', () => {
      const pts = resample([]);
      expect(pts.length).toBe(N);
      expect(pts.every(([x, y]) => x === CX && y === CY)).toBe(true);
    });

    it('handles single-point polyline by duplicating that point N times', () => {
      const single: Pt = [10, 20];
      const pts = resample([single], 20);
      expect(pts.length).toBe(20);
      expect(pts.every(([x, y]) => x === 10 && y === 20)).toBe(true);
    });

    it('preserves start and end endpoints of a straight line', () => {
      const line: Pt[] = [
        [0, 0],
        [100, 100],
      ];
      const res = resample(line, 10);
      expect(res.length).toBe(10);
      expect(res[0]?.[0]).toBeCloseTo(0);
      expect(res[0]?.[1]).toBeCloseTo(0);
      expect(res[9]?.[0]).toBeCloseTo(100);
      expect(res[9]?.[1]).toBeCloseTo(100);
    });

    it('spaces resampled points evenly across multi-segment polylines', () => {
      const poly: Pt[] = [
        [0, 0],
        [10, 0],
        [10, 20],
      ]; // total length = 10 + 20 = 30
      const res = resample(poly, 31);
      expect(res.length).toBe(31);

      // Check that step distance between consecutive points is exactly 1.0 unit
      for (let i = 1; i < res.length; i++) {
        const pPrev = res[i - 1]!;
        const pCurr = res[i]!;
        const dist = Math.hypot(pCurr[0] - pPrev[0], pCurr[1] - pPrev[1]);
        expect(dist).toBeCloseTo(1.0, 4);
      }
    });

    it('handles zero-length multi-point polylines without crashing or producing NaN', () => {
      const pts = resample(
        [
          [5, 5],
          [5, 5],
          [5, 5],
        ],
        15,
      );
      expect(pts.length).toBe(15);
      expect(pts.every(([x, y]) => x === 5 && y === 5)).toBe(true);
    });
  });

  describe('dotPts and line', () => {
    it('creates N identical coordinates for a dot', () => {
      const dot = dotPts(15, 25, 40);
      expect(dot.length).toBe(40);
      expect(dot.every(([x, y]) => x === 15 && y === 25)).toBe(true);
    });
  });

  describe('arc and circle geometry', () => {
    it('ensures every point on an arc maintains the exact radius from (cx, cy)', () => {
      const radius = 24;
      const pts = arc(CX, CY, radius, 0, 180, 24);
      expect(pts.length).toBe(25); // 0 to 24 inclusive

      for (const [x, y] of pts) {
        const d = Math.hypot(x - CX, y - CY);
        expect(d).toBeCloseTo(radius, 4);
      }
    });

    it('circle spans a complete 360 degrees and closes onto its starting point', () => {
      const radius = 16;
      const pts = circle(CX, CY, radius);
      const first = pts[0]!;
      const last = pts[pts.length - 1]!;

      expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeCloseTo(0, 4);
      expect(first[0]).toBeCloseTo(CX);
      expect(first[1]).toBeCloseTo(CY - radius); // default start -90 is top
    });
  });

  describe('cubic Bezier', () => {
    it('starts at p0 and ends at p3', () => {
      const p0: Pt = [10, 10];
      const p1: Pt = [20, 50];
      const p2: Pt = [50, 50];
      const p3: Pt = [60, 20];

      const curve = cubic(p0, p1, p2, p3, 32);
      expect(curve.length).toBe(33);

      expect(curve[0]?.[0]).toBeCloseTo(p0[0]);
      expect(curve[0]?.[1]).toBeCloseTo(p0[1]);

      const end = curve[curve.length - 1]!;
      expect(end[0]).toBeCloseTo(p3[0]);
      expect(end[1]).toBeCloseTo(p3[1]);
    });

    it('keeps all intermediate coordinates bounded within the control points bounding box', () => {
      const p0: Pt = [10, 10];
      const p1: Pt = [20, 40];
      const p2: Pt = [30, 40];
      const p3: Pt = [40, 10];

      const curve = cubic(p0, p1, p2, p3, 20);
      for (const [x, y] of curve) {
        expect(x).toBeGreaterThanOrEqual(10 - 0.001);
        expect(x).toBeLessThanOrEqual(40 + 0.001);
        expect(y).toBeGreaterThanOrEqual(10 - 0.001);
        expect(y).toBeLessThanOrEqual(40 + 0.001);
      }
    });
  });

  describe('Transformations: join, rotate, scale, translate', () => {
    it('joins multiple polylines end-to-start', () => {
      const joined = join(
        [
          [1, 1],
          [2, 2],
        ],
        [
          [3, 3],
          [4, 4],
        ],
      );
      expect(joined).toEqual([
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ]);
    });

    it('rotates points around center with circular preservation', () => {
      const pt: Pt = [CX + 10, CY]; // 10 units to right
      const r90 = rotate([pt], 90, CX, CY);
      expect(r90[0]?.[0]).toBeCloseTo(CX);
      expect(r90[0]?.[1]).toBeCloseTo(CY + 10); // 90 deg down

      const r360 = rotate([pt], 360, CX, CY);
      expect(r360[0]?.[0]).toBeCloseTo(pt[0]);
      expect(r360[0]?.[1]).toBeCloseTo(pt[1]);
    });

    it('scales points radially from center', () => {
      const pt: Pt = [CX + 10, CY + 5];
      const s2 = scale([pt], 2, CX, CY);
      expect(s2[0]?.[0]).toBeCloseTo(CX + 20);
      expect(s2[0]?.[1]).toBeCloseTo(CY + 10);

      const s0 = scale([pt], 0, CX, CY);
      expect(s0[0]?.[0]).toBeCloseTo(CX);
      expect(s0[0]?.[1]).toBeCloseTo(CY);
    });

    it('translates coordinates by dx, dy', () => {
      const pts: Pt[] = [
        [5, 10],
        [15, 20],
      ];
      const t = translate(pts, 10, -5);
      expect(t).toEqual([
        [15, 5],
        [25, 15],
      ]);
    });
  });

  describe('Mathematical helpers: frac, clamp01, easeInOut, hump, polar', () => {
    it('frac returns strictly the fractional remainder in [0, 1)', () => {
      expect(frac(3.75)).toBeCloseTo(0.75);
      expect(frac(1.0)).toBeCloseTo(0.0);
      expect(frac(-0.25)).toBeCloseTo(0.75);
      expect(frac(0)).toBe(0);
    });

    it('clamp01 limits values to [0, 1]', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(0.67)).toBe(0.67);
      expect(clamp01(1)).toBe(1);
      expect(clamp01(1.5)).toBe(1);
    });

    it('easeInOut is symmetric and strictly monotonic', () => {
      expect(easeInOut(0)).toBeCloseTo(0);
      expect(easeInOut(0.5)).toBeCloseTo(0.5);
      expect(easeInOut(1)).toBeCloseTo(1);

      let prev = -1;
      for (let t = 0; t <= 1; t += 0.05) {
        const val = easeInOut(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });

    it('hump peaks smoothly at 0.5 and evaluates to 0 at boundaries', () => {
      expect(hump(0)).toBeCloseTo(0);
      expect(hump(0.5)).toBeCloseTo(1);
      expect(hump(1)).toBeCloseTo(0);
      expect(hump(0.25)).toBeCloseTo(0.5);
      expect(hump(0.75)).toBeCloseTo(0.5);
    });

    it('polar produces correct Cartesian coordinates from radius and angle', () => {
      const right = polar(10, 0, CX, CY);
      expect(right[0]).toBeCloseTo(CX + 10);
      expect(right[1]).toBeCloseTo(CY);

      const down = polar(10, 90, CX, CY);
      expect(down[0]).toBeCloseTo(CX);
      expect(down[1]).toBeCloseTo(CY + 10);
    });
  });
});
