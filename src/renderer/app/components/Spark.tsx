import { useEffect, useRef } from 'react';

/** Ray lengths (as a fraction of the radius) give the spark its hand-drawn, uneven look. */
const RAYS = [1, 0.72, 0.9, 0.64, 0.96, 0.7, 0.86, 0.6, 0.98, 0.68, 0.88, 0.62];
const INNER = 2.2;
const OUTER = 10.4;
/** Seconds for one breath of a ray, and one full turn of the spark while busy. */
const BREATH_S = 1.5;
const TURN_S = 5.2;

/**
 * The app mark: a small warm sunburst. While the app is busy it comes alive: the whole spark turns
 * slowly and each ray stretches and shrinks a little out of step with its neighbours, so the motion
 * feels organic rather than mechanical. Motion eases in and out (no snapping) and stops completely
 * when idle. Honours "reduce motion".
 */
export function Spark({ busy, size = 16 }: { busy: boolean; size?: number }) {
  const rotor = useRef<SVGGElement>(null);
  const rays = useRef<(SVGLineElement | null)[]>([]);
  const target = useRef(0);
  const frame = useRef<number | null>(null);
  const state = useRef({ amp: 0, angle: 0, t: 0, last: 0 });

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.current = busy && !reduce ? 1 : 0;
    if (frame.current !== null || target.current === 0) {
      if (target.current === 0 && state.current.amp === 0) return;
    }
    const tick = (now: number) => {
      const s = state.current;
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0;
      s.last = now;
      // Ease the amount of motion toward its target so starting and stopping are smooth.
      s.amp += (target.current - s.amp) * Math.min(1, dt * 5);
      if (Math.abs(target.current - s.amp) < 0.002) s.amp = target.current;
      s.t += dt;
      s.angle = (s.angle + (360 / TURN_S) * dt * s.amp) % 360;

      rotor.current?.setAttribute('transform', `rotate(${s.angle.toFixed(2)} 12 12)`);
      rays.current.forEach((ray, i) => {
        if (!ray) return;
        const wave = 0.5 + 0.5 * Math.sin((s.t / BREATH_S) * Math.PI * 2 + i * 1.7);
        const len = RAYS[i] ?? 1;
        const reach = INNER + (OUTER - INNER) * len * (1 - s.amp * 0.42 * wave);
        ray.setAttribute('y2', (12 - reach).toFixed(2));
      });

      if (s.amp === 0 && target.current === 0) {
        frame.current = null;
        s.last = 0;
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    if (frame.current === null) frame.current = requestAnimationFrame(tick);
  }, [busy]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0 text-accent"
      role="img"
      aria-label={busy ? 'Smaran is working' : 'Smaran'}
      data-busy={busy}
    >
      <g ref={rotor}>
        {RAYS.map((len, i) => (
          <line
            key={i}
            ref={(el) => {
              rays.current[i] = el;
            }}
            x1="12"
            y1={12 - INNER}
            x2="12"
            y2={12 - (INNER + (OUTER - INNER) * len)}
            transform={`rotate(${(360 / RAYS.length) * i} 12 12)`}
            stroke="currentColor"
            strokeWidth="2.15"
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}
