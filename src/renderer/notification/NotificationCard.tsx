import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { NotificationAction, NotificationLook, NotificationRequest } from '@shared/ipc';
import { separator } from '@shared/menu';
import { DEFAULT_NOTIFICATION_MOTION, type NotificationMotion } from '@shared/schema';
import type { SceneKey } from '@shared/dots/dotsScenes';
import { SmaranDots } from '../dots';
import { RichText } from '../RichText';
import { playChime } from './chime';

const cx = (...c: (string | boolean | undefined | null)[]) => c.filter(Boolean).join(' ');

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
 *
 * Automations and File Server alerts have an expanded, dedicated presentation that slides down
 * from the top with full details and action controls.
 */
export function NotificationCard({
  request,
  card,
  motion = DEFAULT_NOTIFICATION_MOTION,
}: {
  request: NotificationRequest;
  /** Width, height (null = fit the content) and corner radius, from Settings. */
  card: NotificationLook['card'];
  /** Motion and attention animation options. */
  motion?: NotificationMotion;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('measuring');
  const [fromBottom, setFromBottom] = useState(false);
  const [align, setAlign] = useState<Align>('center');
  const [sizes, setSizes] = useState<{ full: Size; pill: Size } | null>(null);

  const countdown = request.countdown === true;
  const isExpandedNotification =
    request.category === 'automations' ||
    request.category === 'fileserver' ||
    request.category === 'security' ||
    countdown ||
    request.key.startsWith('auto-') ||
    request.key.startsWith('fs-');

  const [expanded, setExpanded] = useState(isExpandedNotification);
  const [snoozing, setSnoozing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(false);
  const [remaining, setRemaining] = useState(1);
  const [drag, setDrag] = useState<{ startY: number; dy: number } | null>(null);
  const acted = useRef(false);
  const collapseTimer = useRef<number | undefined>(undefined);

  // An automation about to sign out, sleep, shut down…: Run Now / Cancel, counting down.
  const summary = request.reminderId === null && !request.preview && !countdown;
  const width = card.width;

  // Measure shapes once fonts are ready.
  useLayoutEffect(() => {
    void document.fonts.ready.then(() => {
      const full = fullRef.current;
      if (!full) return;

      if (isExpandedNotification) {
        const fullHeight = full.offsetHeight;
        const measured = {
          full: { width, height: fullHeight },
          pill: { width, height: fullHeight },
        };
        setSizes(measured);
        window.smaranNotification.measured(width + PAD_X * 2, fullHeight + PAD_Y * 2);
        return;
      }

      const pill = pillRef.current;
      if (!pill) return;
      const pillWidth = card.customWidth ?? Math.min(width, pill.offsetWidth);
      const pillHeight = card.height ?? pill.offsetHeight;
      const measured = {
        full: { width, height: full.offsetHeight },
        pill: { width: pillWidth, height: pillHeight },
      };
      setSizes(measured);
      window.smaranNotification.measured(
        Math.max(width, pillWidth) + PAD_X * 2,
        Math.max(measured.full.height, pillHeight) + PAD_Y * 2,
      );
    });
  }, [width, card.customWidth, card.height, card.padding, isExpandedNotification]);

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

  // Auto-hide countdown; hovering, dragging or choosing a snooze pauses it (but not an
  // automation's countdown, which main keeps the time for anyway).
  const holding = !countdown && (hovered || snoozing || !!drag || menuOpen);
  useEffect(() => {
    if (phase !== 'in' || request.hideAfterSec === null || holding) return;
    const total = request.hideAfterSec * 1000;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const step = (now - last) / total;
      last = now;
      setRemaining((r) => Math.max(0, r - step));
    }, 80);
    return () => window.clearInterval(timer);
  }, [phase, holding, request.hideAfterSec]);

  const secondsLeft =
    countdown && request.hideAfterSec !== null ? Math.ceil(remaining * request.hideAfterSec) : 0;

  useEffect(() => {
    if (remaining === 0) act({ kind: 'expired' });
  });

  // Tell main how tall the card looks now, so stacked cards sit close together.
  const visibleHeight = sizes
    ? isExpandedNotification
      ? sizes.full.height
      : expanded
        ? sizes.full.height
        : sizes.pill.height
    : undefined;

  useEffect(() => {
    if (visibleHeight) window.smaranNotification.shape(visibleHeight);
  }, [visibleHeight]);

  // ---------- Attention Motion Effects ----------
  const motionEnabled = motion.enabled === true;
  const [faded, setFaded] = useState(false);
  const [bounceHop, setBounceHop] = useState(false);
  const [wiggling, setWiggling] = useState(false);

  const isFaded = motionEnabled && faded && phase === 'in' && motion.type === 'fade-cycle' && !holding;
  const isBounceHop = motionEnabled && bounceHop && phase === 'in' && motion.type === 'bounce' && !holding;
  const isWiggling = motionEnabled && wiggling && phase === 'in' && motion.type === 'wiggle' && !holding;

  // 1. Fade cycle
  useEffect(() => {
    if (!motionEnabled || phase !== 'in' || motion.type !== 'fade-cycle' || holding) return;
    const { visibleSec, fadeSec } = motion.fadeCycle;
    const visibleMs = visibleSec * 1000;
    const fadeMs = fadeSec * 1000;
    const pauseMs = 700;

    let tOut: number | undefined;
    let tIn: number | undefined;
    let cancelled = false;

    const cycle = () => {
      if (cancelled) return;
      tOut = window.setTimeout(() => {
        if (cancelled) return;
        setFaded(true);
        tIn = window.setTimeout(() => {
          if (cancelled) return;
          setFaded(false);
          cycle();
        }, fadeMs + pauseMs);
      }, visibleMs);
    };

    cycle();

    return () => {
      cancelled = true;
      window.clearTimeout(tOut);
      window.clearTimeout(tIn);
      setFaded(false);
    };
  }, [phase, motion.type, motion.fadeCycle, holding, motionEnabled]);

  // 2. Bounce periodic attention hop
  useEffect(() => {
    if (!motionEnabled || phase !== 'in' || motion.type !== 'bounce' || !motion.bounce.repeat || holding) return;
    const timer = window.setInterval(() => {
      setBounceHop(true);
      window.setTimeout(() => setBounceHop(false), 650);
    }, 3400);
    return () => {
      window.clearInterval(timer);
      setBounceHop(false);
    };
  }, [phase, motion.type, motion.bounce.repeat, holding, motionEnabled]);

  // 3. Wiggle periodic attention shake
  useEffect(() => {
    if (!motionEnabled || phase !== 'in' || motion.type !== 'wiggle' || holding) return;
    const timer = window.setInterval(() => {
      setWiggling(true);
      window.setTimeout(() => setWiggling(false), 550);
    }, motion.wiggle.intervalSec * 1000);
    return () => {
      window.clearInterval(timer);
      setWiggling(false);
    };
  }, [phase, motion.type, motion.wiggle.intervalSec, holding, motionEnabled]);

  function act(action: NotificationAction) {
    if (acted.current) return;
    acted.current = true;
    window.smaranNotification.act(action);
  }

  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  function onEnter() {
    window.smaranNotification.interactive(true);
    window.clearTimeout(collapseTimer.current);
    setHovered(true);
    setExpanded(true);
  }

  function onLeave() {
    window.smaranNotification.interactive(false);
    setHovered(false);
    if (request.hideAfterSec && request.hideAfterSec > 0 && remainingRef.current < 0.25) {
      setRemaining(Math.min(1, 2.0 / request.hideAfterSec));
    }
    if (isExpandedNotification) return; // Expanded cards stay open
    window.clearTimeout(collapseTimer.current);
    if (menuRef.current) return;
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      window.setTimeout(() => setSnoozing(false), MORPH_MS);
    }, COLLAPSE_DELAY_MS);
  }

  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  // Register main unhover event, window blur, and document mouseleave
  useEffect(() => {
    const handleBlur = () => onLeaveRef.current();
    const handleDocLeave = (e: globalThis.MouseEvent) => {
      if (!e.relatedTarget) onLeaveRef.current();
    };
    window.addEventListener('blur', handleBlur);
    document.addEventListener('mouseleave', handleDocLeave);
    const unsub = window.smaranNotification.onUnhover(() => {
      onLeaveRef.current();
    });
    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('mouseleave', handleDocLeave);
      unsub();
    };
  }, []);

  // Heartbeat verification while hovered: if cursor has exited the card element or window,
  // ensure hovered state never gets stuck.
  useEffect(() => {
    if (!hovered) return;
    const interval = window.setInterval(() => {
      if (menuRef.current) return;
      const el = (fullRef.current ?? pillRef.current)?.closest('[data-testid="notification"]');
      if (el && !el.matches(':hover')) {
        onLeaveRef.current();
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, [hovered]);

  // ---------- right-click menu ----------
  async function onContextMenu(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const cardEl = e.currentTarget;
    if (menuRef.current) return;
    menuRef.current = true;
    setMenuOpen(true);
    const id = await window.smaranNotification.menu(
      countdown
        ? [
            { kind: 'item', id: 'done', label: 'Run Now' },
            { kind: 'item', id: 'open', label: 'Open Smaran' },
            separator,
            { kind: 'item', id: 'dismiss', label: 'Cancel', danger: true },
          ]
        : isExpandedNotification
          ? [
              { kind: 'item', id: 'open', label: 'Open Smaran' },
              separator,
              { kind: 'item', id: 'dismiss', label: 'Dismiss', danger: true },
            ]
          : [
              { kind: 'item', id: 'done', label: 'Done' },
              separator,
              { kind: 'heading', label: 'Snooze' },
              ...SNOOZE.map((s, i) => ({
                kind: 'item' as const,
                id: `snooze-${i}`,
                label: s.label,
              })),
              separator,
              { kind: 'item', id: 'open', label: 'Open Smaran' },
              { kind: 'item', id: 'dismiss', label: 'Dismiss', danger: true },
            ],
    );
    menuRef.current = false;
    setMenuOpen(false);
    if (id === 'done') act({ kind: 'done' });
    else if (id === 'dismiss') act({ kind: 'dismiss' });
    else if (id === 'open') window.smaranNotification.openApp();
    else if (id?.startsWith('snooze-')) {
      const choice = SNOOZE[Number(id.slice(7))];
      if (choice) act({ kind: 'snooze', minutes: choice.minutes });
    }
    if ((!id || id === 'open') && !cardEl.matches(':hover')) onLeave();
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
  const dragY = drag ? towardEdge(drag.dy) + (drag.dy - towardEdge(drag.dy)) * 0.15 : 0;

  // Separate animation behavior for expanded vs ordinary notifications
  const offscreenTransform = isExpandedNotification
    ? 'translateY(-36px)'
    : fromBottom
      ? 'translateY(calc(100% + 24px)) scale(0.97)'
      : 'translateY(calc(-100% - 24px)) scale(0.97)';

  const transform =
    phase === 'in'
      ? `translateY(${dragY}px)`
      : measuring
        ? 'none'
        : offscreenTransform;

  const slideMs = isExpandedNotification
    ? 360
    : motion.type === 'slide'
      ? motion.slide.speed === 'snappy'
        ? 300
        : motion.slide.speed === 'smooth'
          ? 700
          : 480
      : motion.type === 'bounce'
        ? motion.bounce.energy === 'gentle'
          ? 550
          : motion.bounce.energy === 'energetic'
            ? 440
            : 500
        : 480;

  const slideEase = isExpandedNotification
    ? 'cubic-bezier(0.16, 1, 0.3, 1)'
    : motion.type === 'bounce'
      ? motion.bounce.energy === 'gentle'
        ? 'cubic-bezier(0.34, 1.35, 0.64, 1)'
        : motion.bounce.energy === 'energetic'
          ? 'cubic-bezier(0.175, 0.885, 0.32, 1.38)'
          : 'cubic-bezier(0.34, 1.6, 0.64, 1)'
      : 'cubic-bezier(0.2, 1.1, 0.3, 1)';

  const fadeTransitionSec = isExpandedNotification
    ? 0.24
    : motion.type === 'fade-cycle'
      ? motion.fadeCycle.fadeSec
      : 0.26;

  const slide = drag
    ? 'transform 0s'
    : phase === 'out'
      ? 'transform 240ms cubic-bezier(0.4, 0, 1, 1), opacity 200ms ease-in'
      : `transform ${slideMs}ms ${slideEase}, opacity ${fadeTransitionSec}s ease-in-out`;

  const baseOpacity = phase === 'in' ? 1 - Math.min(0.6, Math.abs(dragY) / 120) : 0;
  const targetOpacity = isFaded ? motion.fadeCycle.minOpacity : baseOpacity;
  const cardRadius = card.radius !== null ? card.radius : 18;

  // ---------- EXPANDED PRESENTATION FOR AUTOMATION & FILE SERVER ----------
  if (isExpandedNotification) {
    return (
      <div
        ref={wrapper}
        className="flex flex-col"
        style={{
          padding: `${PAD_Y}px ${PAD_X}px`,
          width: width + PAD_X * 2,
          justifyContent: 'flex-start',
          alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
          minHeight: measuring ? undefined : '100vh',
          boxSizing: 'border-box',
        }}
      >
        <div
          data-testid="notification"
          data-expanded="true"
          ref={fullRef}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onPointerDown={onPointerDown}
          onContextMenu={(e) => void onContextMenu(e)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width,
            transform,
            opacity: targetOpacity,
            transition: slide,
            borderRadius: cardRadius,
          }}
          className="glass-card relative select-none p-3.5"
        >
          {/* Top Bar: Logo, Brand & Category badge, Timestamp / countdown, Close button */}
          <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center" aria-hidden>
                <SmaranDots
                  size={22}
                  scene={
                    request.animation && request.animation !== 'auto'
                      ? (request.animation as SceneKey)
                      : undefined
                  }
                  interactive={false}
                />
              </span>
              <span className="font-serif text-[13px] italic font-medium text-muted">Smaran</span>
              <span
                className={cx(
                  'rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase',
                  request.category === 'security'
                    ? 'bg-danger/10 text-danger border border-danger/20'
                    : request.category === 'fileserver'
                      ? 'bg-ok/10 text-ok border border-ok/20'
                      : 'bg-accent-soft text-accent border border-accent/20',
                )}
              >
                {request.category === 'security'
                  ? 'Security Alert'
                  : request.category === 'fileserver'
                    ? 'File Server'
                    : 'Automation'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-faint">
                {countdown ? `${secondsLeft} s` : request.label || 'now'}
              </span>
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
          </div>

          {/* Body Content */}
          <div className="mt-2.5">
            <h3
              data-testid="notification-title"
              className="font-serif text-[15.5px] font-semibold text-ink leading-snug"
            >
              <RichText text={request.title} />
            </h3>
            {request.body && (
              <p className="mt-1 font-serif text-[13px] leading-relaxed text-muted line-clamp-3">
                <RichText text={request.body} />
              </p>
            )}

            {/* Metadata Details Pills */}
            {request.details && Object.keys(request.details).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {request.details.clientIp && (
                  <span className="rounded-md bg-hover border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
                    IP: {String(request.details.clientIp)}
                  </span>
                )}
                {request.details.username && (
                  <span className="rounded-md bg-hover border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
                    User: {String(request.details.username)}
                  </span>
                )}
                {request.details.accessType && (
                  <span className="rounded-md bg-hover border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
                    Access: {String(request.details.accessType)}
                  </span>
                )}
                {request.details.repeatCount && Number(request.details.repeatCount) > 1 && (
                  <span className="rounded-md bg-danger/10 border border-danger/20 px-2 py-0.5 font-mono text-[11px] text-danger">
                    Attempts: {String(request.details.repeatCount)}
                  </span>
                )}
                {request.details.reason && (
                  <span className="rounded-md bg-hover border border-line px-2 py-0.5 text-[11px] text-muted">
                    {String(request.details.reason)}
                  </span>
                )}
                {request.details.actionType && (
                  <span className="rounded-md bg-hover border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
                    Action: {String(request.details.actionType)}
                  </span>
                )}
              </div>
            )}

            {/* Countdown Progress Bar (Automation) */}
            {countdown && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-muted mb-1">
                  <span>Starting in</span>
                  <span className="font-semibold text-accent tabular-nums">{secondsLeft} s</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
                  <div
                    className="h-full bg-accent transition-[width] duration-75 ease-linear"
                    style={{ width: `${Math.max(0, Math.min(100, remaining * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons using Smaran's native theme buttons */}
          <div className="mt-3.5 flex items-center gap-1.5">
            {countdown ? (
              <>
                <Action onClick={() => act({ kind: 'dismiss' })}>Cancel</Action>
                <Action primary onClick={() => act({ kind: 'done' })}>Run Now</Action>
              </>
            ) : request.category === 'fileserver' || request.category === 'security' ? (
              <>
                <Action
                  primary
                  onClick={() => {
                    window.smaranNotification.openApp();
                    act({ kind: 'dismiss' });
                  }}
                >
                  Open File Server
                </Action>
                <Action onClick={() => act({ kind: 'dismiss' })}>Dismiss</Action>
              </>
            ) : (
              <>
                <Action
                  primary
                  onClick={() => {
                    window.smaranNotification.openApp();
                    act({ kind: 'dismiss' });
                  }}
                >
                  Open Smaran
                </Action>
                <Action onClick={() => act({ kind: 'dismiss' })}>Dismiss</Action>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- ORDINARY REMINDER NOTIFICATION PRESENTATION ----------
  let motionAnimation: string | undefined;
  if (phase === 'in' && !holding && motionEnabled) {
    if (isBounceHop) {
      motionAnimation = fromBottom ? 'bounce-hop-up 650ms ease-out' : 'bounce-hop-down 650ms ease-out';
    } else if (isWiggling) {
      motionAnimation =
        motion.wiggle.strength === 'pronounced'
          ? 'card-wiggle-pronounced 550ms ease-in-out'
          : 'card-wiggle-subtle 550ms ease-in-out';
    } else if (motion.type === 'pulse') {
      const dur =
        motion.pulse.speed === 'calm'
          ? '2.6s'
          : motion.pulse.speed === 'rapid'
            ? '1.1s'
            : '1.8s';
      motionAnimation = `card-pulse-${motion.pulse.speed} ${dur} ease-in-out infinite`;
    }
  }

  const glowBoxShadow =
    motionEnabled && motion.type === 'pulse' && motion.pulse.glow && phase === 'in' && !holding
      ? '0 0 18px var(--accent-soft), var(--card-shadow)'
      : undefined;

  const shape = sizes ? (expanded ? sizes.full : sizes.pill) : undefined;
  const autoRadius = sizes ? Math.min(sizes.pill.height / 2, 999) : 18;
  const unhoveredRadius = card.radius !== null ? card.radius : autoRadius;
  const radius =
    expanded || !sizes
      ? (card.radius !== null ? card.radius : 18)
      : unhoveredRadius;
  const padX = card.padding !== null && card.padding !== undefined ? card.padding : 18;
  const padY =
    card.padding !== null && card.padding !== undefined
      ? Math.max(4, Math.round(card.padding * 0.6))
      : 9;

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
        onContextMenu={(e) => void onContextMenu(e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: shape?.width ?? width,
          height: shape?.height,
          borderRadius: radius,
          transform,
          opacity: targetOpacity,
          animation: motionAnimation,
          boxShadow: glowBoxShadow,
          transition: `${slide}, width ${MORPH_MS}ms ${MORPH}, height ${MORPH_MS}ms ${MORPH}, border-radius ${MORPH_MS}ms ${MORPH}${motion.type === 'pulse' && motion.pulse.glow ? ', box-shadow 350ms ease' : ''}`,
        }}
        className="relative select-none"
      >
        <div
          className="glass-card absolute inset-0 overflow-hidden"
          style={{ borderRadius: 'inherit' }}
        >
          {/* Folded / unhovered: title */}
          <div
            ref={pillRef}
            aria-hidden={expanded}
            className={`absolute top-0 left-0 flex items-center ${card.customWidth ? 'w-full justify-between' : 'w-max'}`}
            style={{
              padding: `${padY}px ${padX}px`,
              minHeight: card.height ?? undefined,
              maxWidth: width,
              boxSizing: 'border-box',
              opacity: expanded && !measuring ? 0 : 1,
              transform: expanded ? 'scale(0.96)' : 'none',
              transition: `opacity ${expanded ? 160 : 240}ms ease ${expanded ? 0 : 60}ms, transform ${MORPH_MS}ms ${MORPH}`,
              visibility: measuring ? 'hidden' : undefined,
            }}
          >
            <span
              className="truncate font-serif text-[16px] leading-[18px] font-semibold tracking-[-0.005em] text-ink"
              data-testid="notification-pill"
            >
              <RichText text={request.title} />
            </span>
          </div>

          {/* Unfolded: the full card */}
          <div
            ref={fullRef}
            aria-hidden={!expanded && !measuring}
            className="absolute top-0 left-0 flex flex-col"
            style={{
              width,
              opacity: expanded || measuring ? 1 : 0,
              transform: expanded || measuring ? 'none' : 'translateY(-4px)',
              transition: `opacity ${expanded ? 260 : 200}ms ease ${expanded ? 60 : 0}ms, transform ${MORPH_MS}ms ${MORPH}`,
              pointerEvents: expanded ? 'auto' : 'none',
            }}
          >
            <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden px-3 pt-3 pb-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center" aria-hidden>
                <SmaranDots
                  size={30}
                  scene={
                    request.animation && request.animation !== 'auto'
                      ? (request.animation as SceneKey)
                      : undefined
                  }
                  interactive={false}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex h-4 items-center gap-1.5 text-[11px] leading-none text-muted">
                  <span className="font-serif text-[12.5px] italic">Smaran</span>
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
                  className="mt-1 line-clamp-2 font-serif text-[15.5px] leading-snug font-semibold text-ink"
                  data-testid="notification-title"
                >
                  <RichText text={request.title} />
                </div>
                {request.body && (
                  <div className="mt-0.5 line-clamp-2 font-serif text-[13px] leading-snug text-muted">
                    <RichText text={request.body} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-1.5 px-3 pb-3">
              {summary ? (
                <>
                  <Action
                    primary
                    onClick={() => {
                      window.smaranNotification.openApp();
                      act({ kind: 'dismiss' });
                    }}
                  >
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
