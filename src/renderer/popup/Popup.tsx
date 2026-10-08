import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { StyleFields } from '@shared/schema';
import { PopupCard } from '../ui/PopupCard';

type Phase = 'waiting' | 'in' | 'stay' | 'out';

/**
 * One popup: measure → (main shows the window) → fade in → stay (paused while hovered) → fade out → done.
 * Dragging moves the window through main; main saves the spot when the drag ends.
 */
export function Popup({ text, style }: { text: string; style: StyleFields }) {
  const card = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('waiting');
  const hovered = useRef(false);
  const dragging = useRef<{ dx: number; dy: number } | null>(null);
  const stay = useRef({ remaining: style.timing.stayMs, startedAt: 0, timer: 0 });

  // Measure once fonts are ready, then wait for main to show the window.
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        if (cancelled || !card.current) return;
        const rect = card.current.getBoundingClientRect();
        window.smaranPopup.onShown(() => setPhase('in'));
        window.smaranPopup.measured(rect.width, rect.height);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Phase timers.
  useEffect(() => {
    if (phase === 'in') {
      const t = window.setTimeout(() => setPhase('stay'), Math.max(16, style.timing.fadeInMs));
      return () => window.clearTimeout(t);
    }
    if (phase === 'stay') {
      const timers = stay.current;
      startStayTimer();
      return () => window.clearTimeout(timers.timer);
    }
    if (phase === 'out') {
      const t = window.setTimeout(() => window.smaranPopup.done(), style.timing.fadeOutMs);
      return () => window.clearTimeout(t);
    }
    return undefined;
    // startStayTimer reads refs only.
  }, [phase, style.timing.fadeInMs, style.timing.fadeOutMs]);

  function startStayTimer() {
    window.clearTimeout(stay.current.timer);
    if (hovered.current || dragging.current) return;
    stay.current.startedAt = performance.now();
    stay.current.timer = window.setTimeout(() => setPhase('out'), stay.current.remaining);
  }

  function pauseStayTimer() {
    if (phase !== 'stay') return;
    window.clearTimeout(stay.current.timer);
    const elapsed = performance.now() - stay.current.startedAt;
    stay.current.remaining = Math.max(0, stay.current.remaining - elapsed);
  }

  function onEnter() {
    hovered.current = true;
    pauseStayTimer();
    // Hovering during the fade-out brings the popup back.
    if (phase === 'out') setPhase('stay');
  }

  function onLeave() {
    hovered.current = false;
    if (phase === 'stay' && !dragging.current) startStayTimer();
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { dx: e.screenX - window.screenX, dy: e.screenY - window.screenY };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = dragging.current;
    if (d) window.smaranPopup.dragMove(e.screenX - d.dx, e.screenY - d.dy);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragging.current = null;
    window.smaranPopup.dragEnd();
    if (phase === 'stay' && !hovered.current) startStayTimer();
  }

  const visible = phase === 'in' || phase === 'stay';
  const transitionMs = phase === 'out' ? style.timing.fadeOutMs : style.timing.fadeInMs;

  return (
    <PopupCard
      ref={card}
      text={text}
      style={style}
      visibility={visible ? 1 : 0}
      transitionMs={phase === 'waiting' ? 0 : transitionMs}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onContextMenu={(e) => {
        e.preventDefault();
        window.smaranPopup.contextMenu();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      data-testid="popup-card"
    />
  );
}
