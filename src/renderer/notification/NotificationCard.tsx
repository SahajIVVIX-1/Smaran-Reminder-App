import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { NotificationAction, NotificationLook, NotificationRequest } from '@shared/ipc';
import { COLOR_BG } from '../colors';
import { playChime } from './chime';

/** Expanded card widths: small, like a phone banner. */
const WIDTH: Record<NotificationLook['size'], number> = {
  compact: 308,
  comfortable: 340,
  large: 384,
};
/** Room around the card inside its window for the shadow. */
const PAD_X = 14;
const PAD_Y = 10;
/** Swipe this far toward the screen edge to dismiss. */
const SWIPE_DISMISS_PX = 34;
/** Leaving for a moment (e.g. brushing the edge) doesn't collapse the card. */
const COLLAPSE_DELAY_MS = 140;
/** One easing for the whole morph, so size and content move together. */
const MORPH = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
const MORPH_MS = 420;

const SNOOZE: { label: string; minutes: number | 'tomorrow' }[] = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: 'Tomorrow', minutes: 'tomorrow' },
];

type Phase = 'measuring' | 'hidden' | 'in' | 'out';
type Align = 'left' | 'center' | 'right';
interface Size {
  width: number;
  height: number;
}

/**
 * A reminder that behaves like a phone notification: it slides in from the screen edge as a small
 * pill showing just the title. Hovering expands it into the full card (app name, time, close,
 * Done and Snooze); moving away folds it back. Hover pauses its timer; swipe it toward the edge to
 * dismiss. It never takes keyboard focus.
 */
export function NotificationCard({
  request,
  size,
}: {
  request: NotificationRequest;
  size: NotificationLook['size'];
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('measuring');
  const [fromBottom, setFromBottom] = useState(false);
  const [align, setAlign] = useState<Align>('center');
  const [sizes, setSizes] = useState<{ full: Size; pill: Size } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [remaining, setRemaining] = useState(1);
  const [drag, setDrag] = useState<{ startY: number; dy: number } | null>(null);
  const acted = useRef(false);
  const collapseTimer = useRef<number | undefined>(undefined);
  const summary = request.reminderId === null && !request.preview;
  const width = WIDTH[size];

  // Measure both shapes once fonts are ready; the window is sized for the expanded card.
  useLayoutEffect(() => {
    void document.fonts.ready.then(() => {
      const full = fullRef.current;
      const pill = pillRef.current;
      if (!full || !pill) return;
      const measured = {
        full: { width, height: full.offsetHeight },
        pill: { width: Math.min(width, pill.offsetWidth), height: pill.offsetHeight },
      };
      setSizes(measured);
      window.smaranNotification.measured(width + PAD_X * 2, measured.full.height + PAD_Y * 2);
    });
  }, [width]);

  useEffect(() => {
    window.smaranNotification.onShown((info) => {
      setFromBottom(info.fromBottom);
      setAlign(info.align);
      setPhase('hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('in')));
      if (request.sound) playChime(request.important);
    });
    window.smaranNotification.onClose(() => {
      setPhase('out');
      window.setTimeout(() => window.smaranNotification.done(), 260);
    });
  }, [request.sound, request.important]);

  // Auto-hide countdown; hovering, dragging or choosing a snooze pauses it.
  useEffect(() => {
    if (phase !== 'in' || request.hideAfterSec === null || hovered || snoozing || drag) return;
    const total = request.hideAfterSec * 1000;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const step = (now - last) / total;
      last = now;
      setRemaining((r) => Math.max(0, r - step));
    }, 80);
    return () => window.clearInterval(timer);
  }, [phase, hovered, snoozing, drag, request.hideAfterSec]);

  useEffect(() => {
    if (remaining === 0) act({ kind: 'expired' });
  });

  function act(action: NotificationAction) {
    if (acted.current) return;
    acted.current = true;
    window.smaranNotification.act(action);
  }

  function onEnter() {
    window.smaranNotification.interactive(true);
    window.clearTimeout(collapseTimer.current);
    setHovered(true);
    setExpanded(true);
  }

  function onLeave() {
    window.smaranNotification.interactive(false);
    setHovered(false);
    window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      // Back to Done/Snooze once folded away.
      window.setTimeout(() => setSnoozing(false), MORPH_MS);
    }, COLLAPSE_DELAY_MS);
  }

  // ---------- swipe to dismiss ----------
  const towardEdge = (dy: number) => (fromBottom ? Math.max(0, dy) : Math.min(0, dy));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startY: e.clientY, dy: 0 });
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (drag) setDrag({ ...drag, dy: e.clientY - drag.startY });
  }
  function onPointerUp() {
    if (!drag) return;
    const dy = towardEdge(drag.dy);
    setDrag(null);
    if (Math.abs(dy) > SWIPE_DISMISS_PX) act({ kind: 'dismiss' });
  }

  const measuring = phase === 'measuring' || !sizes;
  const offscreen = fromBottom ? 'calc(100% + 24px)' : 'calc(-100% - 24px)';
  // Toward the edge follows the pointer; away from it only stretches a little.
  const dragY = drag ? towardEdge(drag.dy) + (drag.dy - towardEdge(drag.dy)) * 0.15 : 0;
  const transform =
    phase === 'in'
      ? `translateY(${dragY}px)`
      : measuring
        ? 'none'
        : `translateY(${offscreen}) scale(0.97)`;
  const slide = drag
    ? 'transform 0s'
    : phase === 'out'
      ? 'transform 260ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms ease-in'
      : 'transform 480ms cubic-bezier(0.2, 1.1, 0.3, 1), opacity 260ms ease-out';
  const shape = sizes ? (expanded ? sizes.full : sizes.pill) : undefined;
  const radius = expanded || !sizes ? 18 : sizes.pill.height / 2;

  return (
    <div
      ref={wrapper}
      className="flex flex-col"
      style={{
        padding: `${PAD_Y}px ${PAD_X}px`,
        width: width + PAD_X * 2,
        justifyContent: fromBottom ? 'flex-end' : 'flex-start',
        alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        minHeight: measuring ? undefined : '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-testid="notification"
        data-expanded={expanded}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: shape?.width ?? width,
          height: shape?.height,
          borderRadius: radius,
          transform,
          opacity: phase === 'in' ? 1 - Math.min(0.6, Math.abs(dragY) / 120) : 0,
          transition: `${slide}, width ${MORPH_MS}ms ${MORPH}, height ${MORPH_MS}ms ${MORPH}, border-radius ${MORPH_MS}ms ${MORPH}`,
        }}
        className="relative select-none"
      >
        <div
          className="glass-card absolute inset-0 overflow-hidden"
          style={{ borderRadius: 'inherit' }}
        >
          {/* Folded: just the title. */}
          <div
            ref={pillRef}
            aria-hidden={expanded}
            className="absolute top-0 left-0 flex w-max items-center px-[18px] py-[9px]"
            style={{
              maxWidth: width,
              opacity: expanded && !measuring ? 0 : 1,
              transform: expanded ? 'scale(0.96)' : 'none',
              transition: `opacity ${expanded ? 160 : 240}ms ease ${expanded ? 0 : 60}ms, transform ${MORPH_MS}ms ${MORPH}`,
              visibility: measuring ? 'hidden' : undefined,
            }}
          >
            <span
              className="truncate text-[15px] leading-[18px] font-semibold tracking-[-0.005em] text-ink"
              data-testid="notification-pill"
            >
              {request.title}
            </span>
          </div>

          {/* Unfolded: the full card. */}
          <div
            ref={fullRef}
            aria-hidden={!expanded && !measuring}
            className="absolute top-0 left-0"
            style={{
              width,
              opacity: expanded || measuring ? 1 : 0,
              transform: expanded || measuring ? 'none' : 'translateY(-4px)',
              transition: `opacity ${expanded ? 260 : 200}ms ease ${expanded ? 60 : 0}ms, transform ${MORPH_MS}ms ${MORPH}`,
              pointerEvents: expanded ? 'auto' : 'none',
            }}
          >
            <div className="flex gap-2.5 px-3 pt-3 pb-2.5">
              <span
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-white ${COLOR_BG[request.color]}`}
                aria-hidden
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
                  <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex h-4 items-center gap-1.5 text-[11px] leading-none text-muted">
                  <span className="font-semibold tracking-wide uppercase">Smaran</span>
                  {request.important && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Important" />
                  )}
                  <span className="ml-auto truncate">{request.label || 'now'}</span>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => act({ kind: 'dismiss' })}
                    className="-mr-1 grid h-5 w-5 place-items-center rounded-full text-faint transition-colors duration-150 hover:bg-hover hover:text-ink"
                  >
                    <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
                      <path
                        d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                <div
                  className="mt-1 line-clamp-2 text-[14.5px] leading-snug font-semibold text-ink"
                  data-testid="notification-title"
                >
                  {request.title}
                </div>
                {request.body && (
                  <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">
                    {request.body}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-1.5 px-3 pb-3">
              {summary ? (
                <>
                  <Action primary onClick={() => window.smaranNotification.openApp()}>
                    Open History
                  </Action>
                  <Action onClick={() => act({ kind: 'dismiss' })}>Dismiss</Action>
                </>
              ) : snoozing ? (
                SNOOZE.map((s) => (
                  <Action key={s.label} onClick={() => act({ kind: 'snooze', minutes: s.minutes })}>
                    {s.label}
                  </Action>
                ))
              ) : (
                <>
                  <Action primary onClick={() => act({ kind: 'done' })}>
                    Done
                  </Action>
                  <Action onClick={() => setSnoozing(true)}>Snooze</Action>
                </>
              )}
            </div>
          </div>
        </div>

        {/* A colourful light travels round the border while the card is showing. */}
        <BorderRing radius={radius} morph={`${MORPH_MS}ms ${MORPH}`} />
      </div>
    </div>
  );
}

function Action({
  children,
  onClick,
  primary,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-[30px] flex-1 rounded-[10px] text-[12.5px] font-medium whitespace-nowrap transition-[background-color,transform] duration-150 active:scale-[0.97]',
        primary ? 'bg-accent text-on-accent hover:bg-accent-hover' : 'glass-button text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/** Google's four colours, in order along the moving light. */
const RING_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
/** Each colour's share of the border (out of 100), and one lap's duration. */
const RING_SEGMENT = 7;
const RING_LAP_S = 2.8;

/**
 * A short light in Google's colours that travels round the card's border at a steady pace, like a
 * loading indicator, with a soft blurred copy underneath for a glassy glow. Pure CSS animation of
 * the stroke offset, so it moves smoothly; it follows the card as it morphs between pill and card.
 */
function BorderRing({ radius, morph }: { radius: number; morph: string }) {
  // Each colour sits a little further along the same repeating pattern, so all four move as one.
  const segments = RING_COLORS.map((color, i) => ({
    color,
    offset: RING_SEGMENT * (RING_COLORS.length - 1 - i),
  }));
  const rect = (color: string, offset: number, glow: boolean) => (
    <rect
      key={`${color}-${glow}`}
      x={1}
      y={1}
      pathLength={100}
      fill="none"
      stroke={color}
      strokeWidth={glow ? 4.5 : 2.2}
      strokeLinecap="round"
      strokeDasharray={`0 ${offset} ${RING_SEGMENT} ${100 - offset - RING_SEGMENT}`}
      opacity={glow ? 0.55 : 1}
      style={
        {
          width: 'calc(100% - 2px)',
          height: 'calc(100% - 2px)',
          rx: Math.max(0, radius - 1),
          ry: Math.max(0, radius - 1),
          transition: `rx ${morph}, ry ${morph}`,
          animation: `ring-run ${RING_LAP_S}s linear infinite`,
          filter: glow ? 'blur(3px)' : undefined,
        } as CSSProperties
      }
    />
  );
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      <g>{segments.map((s) => rect(s.color, s.offset, true))}</g>
      <g>{segments.map((s) => rect(s.color, s.offset, false))}</g>
    </svg>
  );
}
