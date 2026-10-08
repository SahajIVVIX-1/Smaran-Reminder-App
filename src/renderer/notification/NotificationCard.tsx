import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { NotificationAction, NotificationLook, NotificationRequest } from '@shared/ipc';
import { COLOR_BG } from '../colors';
import { playChime } from './chime';

/** Card widths: small, like a phone banner. */
const WIDTH: Record<NotificationLook['size'], number> = {
  compact: 308,
  comfortable: 340,
  large: 384,
};
/** Room around the card inside its window for the shadow. */
const PAD_X = 14;
const PAD_Y = 10;
/** The actions appear once the card has landed. */
const ACTIONS_DELAY_MS = 380;
/** Swipe this far toward the screen edge to dismiss. */
const SWIPE_DISMISS_PX = 34;

const SNOOZE: { label: string; minutes: number | 'tomorrow' }[] = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: 'Tomorrow', minutes: 'tomorrow' },
];

type Phase = 'measuring' | 'hidden' | 'in' | 'out';

/**
 * A reminder card that behaves like a phone notification: it slides in from the screen edge,
 * then reveals Done and Snooze. Hover pauses its timer; swipe it back toward the edge to dismiss.
 * It never takes keyboard focus.
 */
export function NotificationCard({
  request,
  size,
}: {
  request: NotificationRequest;
  size: NotificationLook['size'];
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('measuring');
  const [fromBottom, setFromBottom] = useState(false);
  const [open, setOpen] = useState(true); // actions shown; true while measuring the full height
  const [snoozing, setSnoozing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [remaining, setRemaining] = useState(1);
  const [drag, setDrag] = useState<{ startY: number; dy: number } | null>(null);
  const acted = useRef(false);
  const summary = request.reminderId === null && !request.preview;

  // Measure once with the actions open, so the window is tall enough for the expanded card.
  useLayoutEffect(() => {
    void document.fonts.ready.then(() => {
      const el = wrapper.current;
      if (el) window.smaranNotification.measured(el.offsetWidth, el.offsetHeight);
    });
  }, []);

  useEffect(() => {
    window.smaranNotification.onShown((info) => {
      setFromBottom(info.fromBottom);
      setOpen(false);
      setPhase('hidden');
      // Next frames: slide in. Then reveal the actions.
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('in')));
      window.setTimeout(() => setOpen(true), ACTIONS_DELAY_MS);
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

  const offscreen = fromBottom ? 'calc(100% + 24px)' : 'calc(-100% - 24px)';
  // Toward the edge follows the pointer; away from it only stretches a little.
  const dragY = drag ? towardEdge(drag.dy) + (drag.dy - towardEdge(drag.dy)) * 0.15 : 0;
  const transform =
    phase === 'in'
      ? `translateY(${dragY}px)`
      : phase === 'measuring'
        ? 'none'
        : `translateY(${offscreen}) scale(0.97)`;
  const transition = drag
    ? 'none'
    : phase === 'out'
      ? 'transform 260ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms ease-in'
      : 'transform 480ms cubic-bezier(0.2, 1.1, 0.3, 1), opacity 260ms ease-out';

  return (
    <div
      ref={wrapper}
      className="flex flex-col"
      style={{
        padding: `${PAD_Y}px ${PAD_X}px`,
        width: WIDTH[size] + PAD_X * 2,
        justifyContent: fromBottom ? 'flex-end' : 'flex-start',
        minHeight: phase === 'measuring' ? undefined : '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-testid="notification"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform,
          transition,
          opacity: phase === 'in' ? 1 - Math.min(0.6, Math.abs(dragY) / 120) : 0,
        }}
        className="glass-card group relative overflow-hidden rounded-[18px] select-none"
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
                className="-mr-1 grid h-5 w-5 place-items-center rounded-full text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-hover hover:text-ink"
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
              className="mt-1 line-clamp-2 text-[13.5px] leading-snug font-semibold text-ink"
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

        {/* Actions slide open after the card lands. */}
        <div
          className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
        >
          <div className="overflow-hidden">
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

        {request.hideAfterSec !== null && (
          <div
            className="absolute inset-x-4 bottom-0 h-[2px] overflow-hidden rounded-full"
            aria-hidden
          >
            <div
              className="h-full origin-left bg-accent/60 transition-transform duration-100 ease-linear"
              style={{ transform: `scaleX(${remaining})` }}
            />
          </div>
        )}
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
