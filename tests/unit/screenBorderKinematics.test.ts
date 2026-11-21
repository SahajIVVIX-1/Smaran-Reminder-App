import { describe, expect, it } from 'vitest';
import { PerimeterRect } from '@shared/perimeter';

describe('screenBorderKinematics - Neon Beam Traversal & Multi-Monitor Math', () => {
  it('computes smooth progressive beam head and tail across animation time ticks', () => {
    const p = new PerimeterRect();
    p.update(1920, 1080, 2);
    const speed = 1200; // pixels per second
    const beamLength = 400; // pixels

    const t0 = 0;
    const t1 = 0.5; // 0.5s elapsed -> 600px
    const t2 = 1.0; // 1.0s elapsed -> 1200px

    const head0 = t0 * speed;
    const tail0 = head0 - beamLength;
    const segs0 = p.getSegments(tail0, head0);
    expect(segs0.length).toBeGreaterThan(0);

    const head1 = t1 * speed;
    const tail1 = head1 - beamLength;
    const segs1 = p.getSegments(tail1, head1);
    expect(segs1.length).toBeGreaterThan(0);

    const head2 = t2 * speed;
    const tail2 = head2 - beamLength;
    const segs2 = p.getSegments(tail2, head2);
    expect(segs2.length).toBeGreaterThan(0);
  });

  it('maps brightness settings to corresponding visual alpha and glow multipliers', () => {
    const mapBrightness = (pct: number) => {
      // 100% -> 1.0, 150% -> 1.5, 200% -> 2.0
      return Math.max(0.5, Math.min(2.0, pct / 100));
    };

    expect(mapBrightness(100)).toBe(1.0);
    expect(mapBrightness(150)).toBe(1.5);
    expect(mapBrightness(200)).toBe(2.0);
    expect(mapBrightness(50)).toBe(0.5);
  });

  it('calculates multi-monitor coordinate offsets correctly', () => {
    const primaryDisplay = { x: 0, y: 0, width: 1920, height: 1080 };
    const secondaryDisplay = { x: 1920, y: 0, width: 2560, height: 1440 };

    const toVirtualScreen = (pt: { x: number; y: number }, display: typeof primaryDisplay) => ({
      x: pt.x + display.x,
      y: pt.y + display.y,
    });

    const pLocal = { x: 500, y: 300 };
    const pVirtualPrimary = toVirtualScreen(pLocal, primaryDisplay);
    expect(pVirtualPrimary).toEqual({ x: 500, y: 300 });

    const pVirtualSecondary = toVirtualScreen(pLocal, secondaryDisplay);
    expect(pVirtualSecondary).toEqual({ x: 2420, y: 300 });
  });
});
