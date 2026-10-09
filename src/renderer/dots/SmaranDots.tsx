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
import { mix, readPalette, toCss, watchTheme, type LogoPalette, type Rgba } from './dotsColors';
import { N } from '@shared/dots/dotsGeometry';
import { AutoDirector, DotsEngine } from '@shared/dots/dotsEngine';
import { COLOR_TOKENS, DEFAULT_SEQUENCE, getScene, type SceneKey } from '@shared/dots/dotsScenes';
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
  /** px number or any CSS length. Default 28 */
  size?: number | string;
  /** time multiplier, e.g. 0.1 = slow motion. Default 1 */
  speed?: number;
  paused?: boolean;
  /** liquid merge effect when dots touch. Default true */
  goo?: boolean;
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

const STROKES = 3;

// attribute writer that skips unchanged values
const cache = new WeakMap<Element, Map<string, string>>();
function set(el: Element | undefined, attr: string, value: string): void {
  if (!el) return;
  let m = cache.get(el);
  if (!m) {
    m = new Map();
    cache.set(el, m);
  }
  if (m.get(attr) === value) return;
  m.set(attr, value);
  el.setAttribute(attr, value);
}

function strokeColor(weights: Float64Array | undefined, pal: LogoPalette): Rgba {
  let out: Rgba = pal.primary;
  let total = 0;
  if (!weights) return out;
  COLOR_TOKENS.forEach((token, i) => {
    const w = weights[i] ?? 0;
    if (w <= 0.001) return;
    total += w;
    out = total === w ? pal[token] : mix(out, pal[token], w / total);
  });
  return out;
}

function render(paths: SVGPathElement[], engine: DotsEngine, pal: LogoPalette): void {
  for (let s = 0; s < STROKES; s++) {
    const el = paths[s];
    if (!el) continue;
    let d = '';
    for (let k = 0; k < N; k++) {
      const i = (s * N + k) * 2;
      d += `${k ? 'L' : 'M'}${(engine.pos[i] ?? 32).toFixed(2)} ${(engine.pos[i + 1] ?? 32).toFixed(2)}`;
    }
    set(el, 'd', d);
    set(el, 'stroke-width', (engine.width[s] ?? 5).toFixed(2));
    set(el, 'stroke', toCss(strokeColor(engine.color[s], pal)));
  }
}

/**
 * Three dots that dance, shuffle and flow together into shapes.
 *   <SmaranDots size={28} />                 auto mode
 *   <SmaranDots size={28} scene="bell-ring" />  a fixed scene
 */
export function SmaranDots({
  scene,
  sequence = DEFAULT_SEQUENCE,
  size = 28,
  speed = 1,
  paused = false,
  goo = true,
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
  const director = useMemo(() => new AutoDirector(sequence), [sequenceKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>('[data-stroke]'));
    let palette = readPalette(svg);
    const stopTheme = watchTheme(() => {
      palette = readPalette(svg);
    });
    render(paths, engine, palette);

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
      render(paths, engine, palette);
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
        <filter id={gooId} filterUnits="userSpaceOnUse" x="-32" y="-32" width="128" height="128">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
      <g filter={goo ? `url(#${gooId})` : undefined}>
        {[0, 1, 2].map((i) => (
          <path key={i} data-stroke={i} fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
