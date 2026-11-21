import { describe, expect, it } from 'vitest';
import { PerimeterRect } from '@shared/perimeter';

describe('perimeterMath - Exact Screen Perimeter Geometric Calculations', () => {
  it('correctly insets vertices based on half-thickness', () => {
    const p = new PerimeterRect();
    p.update(1920, 1080, 2); // 2px thickness (new default)

    expect(p.inset).toBe(1);
    expect(p.v0).toEqual({ x: 1, y: 1 }); // TL
    expect(p.v1).toEqual({ x: 1919, y: 1 }); // TR
    expect(p.v2).toEqual({ x: 1919, y: 1079 }); // BR
    expect(p.v3).toEqual({ x: 1, y: 1079 }); // BL
  });

  it('calculates exact coordinates along all four perimeter edges', () => {
    const p = new PerimeterRect();
    p.update(1000, 500, 2); // w=998, h=498

    // Top edge (d = 0 to 998)
    const midTop = p.getPoint(499);
    expect(midTop.x).toBeCloseTo(500);
    expect(midTop.y).toBeCloseTo(1);

    // Right edge (d = 998 to 1496)
    const midRight = p.getPoint(998 + 249);
    expect(midRight.x).toBeCloseTo(999);
    expect(midRight.y).toBeCloseTo(250);

    // Bottom edge (d = 1496 to 2494)
    const midBottom = p.getPoint(1496 + 499);
    expect(midBottom.x).toBeCloseTo(500);
    expect(midBottom.y).toBeCloseTo(499);

    // Left edge (d = 2494 to 2992)
    const midLeft = p.getPoint(2494 + 249);
    expect(midLeft.x).toBeCloseTo(1);
    expect(midLeft.y).toBeCloseTo(250);
  });

  it('normalizes arbitrary and negative distance offsets through modulo arithmetic', () => {
    const p = new PerimeterRect();
    p.update(1000, 500, 2);
    const L = p.totalLength;

    const ptA = p.getPoint(100);
    const ptB = p.getPoint(100 + L);
    const ptC = p.getPoint(100 + L * 5);
    const ptD = p.getPoint(100 - L);
    const ptE = p.getPoint(100 - L * 3);

    expect(ptB.x).toBeCloseTo(ptA.x);
    expect(ptB.y).toBeCloseTo(ptA.y);
    expect(ptC.x).toBeCloseTo(ptA.x);
    expect(ptC.y).toBeCloseTo(ptA.y);
    expect(ptD.x).toBeCloseTo(ptA.x);
    expect(ptD.y).toBeCloseTo(ptA.y);
    expect(ptE.x).toBeCloseTo(ptA.x);
    expect(ptE.y).toBeCloseTo(ptA.y);
  });

  describe('getSegments decomposition and continuity', () => {
    const p = new PerimeterRect();
    p.update(1920, 1080, 2);

    it('returns empty array when dEnd <= dStart or totalLength is 0', () => {
      expect(p.getSegments(100, 100)).toEqual([]);
      expect(p.getSegments(200, 100)).toEqual([]);

      const empty = new PerimeterRect();
      expect(empty.getSegments(0, 50)).toEqual([]);
    });

    it('returns single straight segment when range lies on a single edge', () => {
      // Range within top edge (0 to 1918)
      const segments = p.getSegments(100, 400);
      expect(segments.length).toBe(1);
      expect(segments[0]?.pStart.y).toBeCloseTo(1);
      expect(segments[0]?.pEnd.y).toBeCloseTo(1);
      expect(segments[0]?.uStart).toBeCloseTo(0);
      expect(segments[0]?.uEnd).toBeCloseTo(1);
    });

    it('decomposes into 2 segments when wrapping a single corner', () => {
      const tr = p.k1;
      const segments = p.getSegments(tr - 50, tr + 50);

      expect(segments.length).toBe(2);
      expect(segments[0]?.pEnd).toEqual(segments[1]?.pStart);
      expect(segments[0]?.uStart).toBeCloseTo(0);
      expect(segments[0]?.uEnd).toBeCloseTo(0.5);
      expect(segments[1]?.uStart).toBeCloseTo(0.5);
      expect(segments[1]?.uEnd).toBeCloseTo(1.0);
    });

    it('decomposes into 3 segments when wrapping 2 corners', () => {
      const tr = p.k1;
      const br = p.k2;
      // Start before TR, end after BR
      const segments = p.getSegments(tr - 100, br + 100);

      expect(segments.length).toBe(3);
      // Segment 1 ends at TR
      expect(segments[0]?.pEnd).toEqual(segments[1]?.pStart);
      // Segment 2 ends at BR
      expect(segments[1]?.pEnd).toEqual(segments[2]?.pStart);
    });

    it('verifies that the sum of euclidean lengths equals requested beam length', () => {
      const dStart = 500;
      const dEnd = 2800;
      const segments = p.getSegments(dStart, dEnd);

      let totalSegmentLength = 0;
      for (const seg of segments) {
        const dx = seg.pEnd.x - seg.pStart.x;
        const dy = seg.pEnd.y - seg.pStart.y;
        totalSegmentLength += Math.hypot(dx, dy);
      }

      expect(totalSegmentLength).toBeCloseTo(dEnd - dStart, 1);
    });
  });

  describe('Extreme screen resolutions', () => {
    it('handles 4K UHD (3840x2160) and 8K (7680x4320)', () => {
      const p4k = new PerimeterRect();
      p4k.update(3840, 2160, 4);
      expect(p4k.totalLength).toBeGreaterThan(10000);

      const p8k = new PerimeterRect();
      p8k.update(7680, 4320, 4);
      expect(p8k.totalLength).toBeGreaterThan(20000);
    });

    it('handles Ultrawide 32:9 (5120x1440) and Portrait (1080x1920)', () => {
      const ultra = new PerimeterRect();
      ultra.update(5120, 1440, 2);
      expect(ultra.w).toBeGreaterThan(ultra.h * 3);

      const portrait = new PerimeterRect();
      portrait.update(1080, 1920, 2);
      expect(portrait.h).toBeGreaterThan(portrait.w);
    });
  });
});
