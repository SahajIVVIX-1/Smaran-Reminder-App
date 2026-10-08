import { format } from 'date-fns';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { NotificationAction, NotificationLook, NotificationRequest } from '@shared/ipc';
import { COLOR_BG } from '../colors';
import { playChime } from './chime';

const WIDTH: Record<NotificationLook['size'], number> = {
  compact: 320,
  comfortable: 368,
  large: 420,
};
const TITLE: Record<NotificationLook['size'], string> = {
  compact: 'text-[14px]',
  comfortable: 'text-[15px]',
  large: 'text-[17px]',
};
const SHADOW = 16;

const SNOOZE: { label: string; minutes: number | 'tomorrow' }[] = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: 'Tomorrow', minutes: 'tomorrow' },
];

type Phase = 'waiting' | 'in' | 'out';

/**
 * One reminder card: slides in, counts down (paused while hovered), and offers Done and Snooze.
 * It never takes keyboard focus; everything works with the mouse.
 */
export function NotificationCard({
  request,
  size,
}: {
  request: NotificationRequest;
  size: NotificationLook['size'];
}) {
  const card = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [fromBottom, setFromBottom] = useState(true);
  const [snoozing, setSnoozing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [remaining, setRemaining] = useState(1); // 1 → 0 progress of the auto-hide timer
  const acted = useRef(false);
  const shownAt = useRef(format(new Date(), 'HH:mm'));
  const summary = request.reminderId === null && !request.preview;

  // Report the card's size whenever it changes (e.g. when the snooze choices open).
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const report = () => window.smaranNotification.measured(el.offsetWidth, el.offsetHeight);
    void document.fonts.ready.then(report);
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.smaranNotification.onShown((info) => {
      setFromBottom(info.fromBottom);
      setPhase('in');
      if (request.sound) playChime(request.important);
    });
    window.smaranNotification.onClose(() => {
      setPhase('out');
      window.setTimeout(() => window.smaranNotification.done(), 180);
    });
  }, [request.sound, request.important]);

  // Auto-hide countdown; hovering (or choosing a snooze) pauses it.
  useEffect(() => {
    if (phase !== 'in' || request.hideAfterSec === null || hovered || snoozing) return;
    const total = request.hideAfterSec * 1000;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const step = (now - last) / total;
      last = now;
      setRemaining((r) => {
        const next = Math.max(0, r - step);
        if (next === 0) act({ kind: 'expired' });
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, hovered, snoozing, request.hideAfterSec]);

  function act(action: NotificationAction) {
    if (acted.current) return;
    acted.current = true;
    window.smaranNotification.act(action);
  }

  const offscreen = fromBottom ? 'translate-y-3' : '-translate-y-3';
  const visible = phase === 'in';

  return (
    <div style={{ padding: SHADOW }}>
      <div
        ref={card}
        data-testid="notification"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: WIDTH[size] }}
        className={[
          'relative overflow-hidden rounded-2xl border border-line bg-surface text-ink select-none',
          'shadow-[0_8px_24px_-6px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.08)]',
          'transition-[opacity,transform] duration-[260ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          visible ? 'translate-y-0 opacity-100' : `${offscreen} opacity-0`,
          phase === 'out' && 'duration-[180ms]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={`absolute inset-y-0 left-0 w-1 ${COLOR_BG[request.color]}`} aria-hidden />
        <div className="py-3 pr-3 pl-4">
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="font-medium">Smaran</span>
            <span aria-hidden>·</span>
            <span>{request.label || shownAt.current}</span>
            {request.important && (
              <span className="ml-1 rounded-full bg-accent-soft px-1.5 py-px text-[10.5px] font-medium text-accent">
                Important
              </span>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => act({ kind: 'dismiss' })}
              className="ml-auto grid h-6 w-6 place-items-center rounded-md text-faint transition-colors hover:bg-hover hover:text-ink"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path
                  d="M3 3l6 6M9 3l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div
            className={`mt-0.5 font-semibold leading-snug ${TITLE[size]}`}
            data-testid="notification-title"
          >
            {request.title}
          </div>
          {request.body && (
            <div className="mt-1 line-clamp-4 text-[13px] leading-relaxed whitespace-pre-wrap text-muted">
              {request.body}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            {summary ? (
              <>
                <CardButton primary onClick={() => window.smaranNotification.openApp()}>
                  Open History
                </CardButton>
                <CardButton onClick={() => act({ kind: 'dismiss' })}>Dismiss</CardButton>
              </>
            ) : snoozing ? (
              <div className="flex animate-fade flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-[12px] text-muted">Remind me in</span>
                {SNOOZE.map((s) => (
                  <CardButton
                    key={s.label}
                    small
                    onClick={() => act({ kind: 'snooze', minutes: s.minutes })}
                  >
                    {s.label}
                  </CardButton>
                ))}
                <button
                  type="button"
                  onClick={() => setSnoozing(false)}
                  className="ml-0.5 text-[12px] text-faint hover:text-ink"
                >
                  Back
                </button>
              </div>
            ) : (
              <>
                <CardButton primary onClick={() => act({ kind: 'done' })}>
                  Done
                </CardButton>
                <CardButton onClick={() => setSnoozing(true)}>Snooze</CardButton>
              </>
            )}
          </div>
        </div>
        {request.hideAfterSec !== null && (
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-transparent" aria-hidden>
            <div
              className="h-full origin-left bg-accent/50 transition-transform duration-100 ease-linear"
              style={{ transform: `scaleX(${remaining})` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CardButton({
  children,
  onClick,
  primary,
  small,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg font-medium transition-colors duration-150',
        small ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3.5 text-[13px]',
        primary
          ? 'bg-accent text-on-accent hover:bg-accent-hover'
          : 'border border-line bg-raised text-ink hover:bg-hover',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
