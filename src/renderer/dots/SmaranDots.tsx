import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { readPalette, watchTheme } from './dotsColors';
import { renderDots } from './dotsRender';
import { AutoDirector, DotsEngine } from '@shared/dots/dotsEngine';
import { DEFAULT_SEQUENCE, getScene, type SceneKey } from '@shared/dots/dotsScenes';
import { subscribeTick } from './dotsTicker';
import './dots.css';

export interface SmaranDotsProps {
  /**
   * Show one scene (a dance like "shuffle" or a shape like "bell").
   * Leave it out for auto mode: the dots dance, form a shape, dance, form the next shape…
   */
  scene?: SceneKey;
  /** shapes to cycle through in auto mode (dances are mixed in between) */
  sequence?: readonly SceneKey[];
  /** dance between shapes in auto mode. Default true */
  dances?: boolean;
  /** px number or any CSS length. Default 28 */
  size?: number | string;
  /** time multiplier, e.g. 0.1 = slow motion. Default 1 */
  speed?: number;
  paused?: boolean;
  /**
   * Liquid merge effect when dots touch. 'auto' (default) turns it on from 48 px up: the filter's
   * hard alpha edge has no anti-aliasing, so small logos look pixelated with it.
   */
  goo?: boolean | 'auto';
  /** hover grow, press squeeze, click "pop". Default true */
  interactive?: boolean;
  /** makes the logo a button */
  onClick?: () => void;
  /** called whenever auto mode moves to a new scene */
  onSceneChange?: (key: string) => void;
  /** change to replay the current scene from its start (still smooth) */
  replayToken?: number | string;
  label?: string;
  className?: string;
  style?: CSSProperties;
  /** "auto" follows the OS setting. Default "auto" */
  reducedMotion?: 'auto' | 'always' | 'never';
}

/**
 * Three dots that dance, shuffle and flow together into shapes.
 *   <SmaranDots size={28} />                 auto mode
 *   <SmaranDots size={28} scene="bell-ring" />  a fixed scene
 */
export function SmaranDots({
  scene,
  sequence = DEFAULT_SEQUENCE,
  dances = true,
  size = 28,
  speed = 1,
  paused = false,
  goo = 'auto',
  interactive = true,
  onClick,
  onSceneChange,
  replayToken,
  label = 'Smaran',
  className,
  style,
  reducedMotion = 'auto',
}: SmaranDotsProps): ReactElement {
  const gooId = `smaran-goo-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const sequenceKey = sequence.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sequenceKey stands in for sequence
  const director = useMemo(() => new AutoDirector(sequence, { dances }), [sequenceKey, dances]);

  // One engine for the component's life (created on first render).
  const [engine] = useState(() => new DotsEngine(getScene(scene ?? director.current)));

  // The frame loop reads the latest props through this ref, updated after each render.
  const live = useRef({ speed, paused, scene, onSceneChange, director });
  useLayoutEffect(() => {
    live.current = { speed, paused, scene, onSceneChange, director };
  });

  // fixed scene / back to auto
  const lastReplay = useRef(replayToken);
  useEffect(() => {
    const replay = lastReplay.current !== replayToken;
    lastReplay.current = replayToken;
    engine.setScene(getScene(scene ?? director.current), replay);
  }, [engine, scene, director, replayToken]);

  // reduced motion
  useEffect(() => {
    if (reducedMotion !== 'auto') {
      engine.setReducedMotion(reducedMotion === 'always');
      return undefined;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (): void => engine.setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [engine, reducedMotion]);

  // frame loop + theme colours
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    // indexed by stroke number; DOM order may change later for depth
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>('[data-stroke]')).sort(
      (a, b) => Number(a.dataset.stroke) - Number(b.dataset.stroke),
    );
    let palette = readPalette(svg);
    const stopTheme = watchTheme(() => {
      palette = readPalette(svg);
    });
    const plain = svg.querySelector<SVGGElement>('[data-plain]');
    renderDots(paths, engine, palette, plain);

    const stopTick = subscribeTick((dt) => {
      const l = live.current;
      const reducedNow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (
        !l.scene &&
        !l.paused &&
        !(reducedMotion === 'always' || (reducedMotion === 'auto' && reducedNow))
      ) {
        const next = l.director.step(Math.min(dt, 0.1) * Math.max(0, l.speed));
        if (next) {
          engine.setScene(getScene(next));
          l.onSceneChange?.(next);
        }
      }
      engine.step(dt, l.speed, l.paused);
      renderDots(paths, engine, palette, plain);
    });
    return () => {
      stopTick();
      stopTheme();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setI = (state: { hover?: boolean; press?: boolean }): void => {
    if (interactive) engine.setInteraction(state);
  };
  const handleClick = (): void => {
    if (interactive) engine.impulse();
    onClick?.();
  };

  const dimension = typeof size === 'number' ? `${size}px` : size;
  const liquid = goo === 'auto' ? typeof size === 'number' && size >= 48 : goo;

  const svg = (
    <svg
      ref={svgRef}
      className="smaran-dots__svg"
      viewBox="0 0 64 64"
      width={dimension}
      height={dimension}
      overflow="visible"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* A soft threshold (alpha x8 - 3, not x18 - 7) keeps the merge but leaves anti-aliased edges, so small logos don't flicker. */}
        <filter id={gooId} filterUnits="userSpaceOnUse" x="-32" y="-32" width="128" height="128">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 8 -3"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
      <g data-plain="" />
      <g filter={liquid ? `url(#${gooId})` : undefined}>
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            data-stroke={i}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            shapeRendering="geometricPrecision"
          />
        ))}
      </g>
    </svg>
  );

  const shared = {
    className: ['smaran-dots', className].filter(Boolean).join(' '),
    style,
    onPointerEnter: () => setI({ hover: true }),
    onPointerLeave: () => setI({ hover: false, press: false }),
    onPointerDown: () => setI({ press: true }),
    onPointerUp: () => setI({ press: false }),
    onPointerCancel: () => setI({ press: false }),
  };

  if (onClick) {
    return (
      <button type="button" aria-label={label} title={label} onClick={handleClick} {...shared}>
        {svg}
      </button>
    );
  }
  return (
    <span role="img" aria-label={label} onClick={interactive ? handleClick : undefined} {...shared}>
      {svg}
    </span>
  );
}

export default SmaranDots;
