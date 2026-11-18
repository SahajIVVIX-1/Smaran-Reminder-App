export interface Point {
  x: number;
  y: number;
}

export interface BeamSegment {
  pStart: Point;
  pEnd: Point;
  uStart: number;
  uEnd: number;
}

/**
 * Exact rectangular perimeter of the screen.
 * Traces the true outer edges of the monitor without cutting corners or curving inward.
 */
export class PerimeterRect {
  width = 0;
  height = 0;
  inset = 1;
  w = 0;
  h = 0;
  totalLength = 0;

  // 4 corner vertices:
  // v0: Top-Left (inset, inset)
  // v1: Top-Right (inset + w, inset)
  // v2: Bottom-Right (inset + w, inset + h)
  // v3: Bottom-Left (inset, inset + h)
  v0: Point = { x: 0, y: 0 };
  v1: Point = { x: 0, y: 0 };
  v2: Point = { x: 0, y: 0 };
  v3: Point = { x: 0, y: 0 };

  // Cumulative distance along the perimeter to each corner
  k0 = 0;
  k1 = 0;
  k2 = 0;
  k3 = 0;
  k4 = 0;

  update(screenW: number, screenH: number, thickness: number) {
    this.width = screenW;
    this.height = screenH;
    // Inset by half-thickness so strokes sit flush inside the window bounds
    this.inset = Math.max(0.5, thickness / 2);

    this.w = Math.max(1, screenW - this.inset * 2);
    this.h = Math.max(1, screenH - this.inset * 2);

    this.v0 = { x: this.inset, y: this.inset };
    this.v1 = { x: this.inset + this.w, y: this.inset };
    this.v2 = { x: this.inset + this.w, y: this.inset + this.h };
    this.v3 = { x: this.inset, y: this.inset + this.h };

    this.k0 = 0;
    this.k1 = this.w; // TR corner
    this.k2 = this.w + this.h; // BR corner
    this.k3 = this.w * 2 + this.h; // BL corner
    this.k4 = this.w * 2 + this.h * 2; // TL corner (end of loop)
    this.totalLength = this.k4;
  }

  getPoint(dist: number): Point {
    if (this.totalLength <= 0) return { x: 0, y: 0 };
    const d = ((dist % this.totalLength) + this.totalLength) % this.totalLength;

    // Edge 0 (Top): from v0 to v1
    if (d < this.k1) {
      return { x: this.v0.x + d, y: this.v0.y };
    }
    // Edge 1 (Right): from v1 to v2
    if (d < this.k2) {
      return { x: this.v1.x, y: this.v1.y + (d - this.k1) };
    }
    // Edge 2 (Bottom): from v2 to v3
    if (d < this.k3) {
      return { x: this.v2.x - (d - this.k2), y: this.v2.y };
    }
    // Edge 3 (Left): from v3 to v0
    return { x: this.v3.x, y: this.v3.y - (d - this.k3) };
  }

  /**
   * Decomposes any sub-range [dStart, dEnd] into contiguous straight edge segments.
   * Eliminates all micro-segments and boxes by utilizing native continuous line segments.
   */
  getSegments(dStart: number, dEnd: number): BeamSegment[] {
    const L = this.totalLength;
    if (L <= 0 || dEnd <= dStart) return [];

    let H = ((dEnd % L) + L) % L;
    const len = dEnd - dStart;
    let T = H - len;

    while (T < 0) {
      T += L;
      H += L;
    }

    const baseCorners = [
      { k: this.k1, pt: this.v1 },
      { k: this.k2, pt: this.v2 },
      { k: this.k3, pt: this.v3 },
      { k: this.k4, pt: this.v0 },
    ];

    const splits: { d: number; pt: Point }[] = [];
    for (let lap = 0; lap <= 2; lap++) {
      const offset = lap * L;
      for (const c of baseCorners) {
        const pos = c.k + offset;
        if (pos > T && pos < H) {
          splits.push({ d: pos, pt: c.pt });
        }
      }
    }
    splits.sort((a, b) => a.d - b.d);

    const keyPoints: { d: number; pt: Point }[] = [
      { d: T, pt: this.getPoint(T) },
      ...splits,
      { d: H, pt: this.getPoint(H) },
    ];

    const segments: BeamSegment[] = [];
    const totalDist = H - T;
    if (totalDist <= 0) return [];

    for (let i = 0; i < keyPoints.length - 1; i++) {
      const pA = keyPoints[i];
      const pB = keyPoints[i + 1];
      if (!pA || !pB) continue;

      segments.push({
        pStart: pA.pt,
        pEnd: pB.pt,
        uStart: (pA.d - T) / totalDist,
        uEnd: (pB.d - T) / totalDist,
      });
    }

    return segments;
  }
}
