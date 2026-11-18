import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import { useExit } from '../useExit';

/**
 * A themed floating panel under (or above, if there's no room) its anchor. Rendered in a portal so
 * scrolling panels and popups never clip it. Closes on outside click, Escape and window blur.
 */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  className,
  matchWidth,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  matchWidth?: boolean;
}) {
  const { mounted, closing } = useExit(open, 160);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!mounted) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current;
      if (!a || !p) return;
      const h = p.offsetHeight;
      const w = matchWidth ? a.width : p.offsetWidth;
      const up = a.bottom + 6 + h > window.innerHeight - 8 && a.top - 6 - h > 8;
      const left = Math.min(Math.max(8, a.left), window.innerWidth - w - 8);
      setPos({ top: up ? a.top - 6 - h : a.bottom + 6, left, width: a.width, up });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [mounted, anchor, matchWidth]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onClose);
    };
  }, [open, onClose, anchor]);

  if (!mounted) return null;
  return createPortal(
    <div
      ref={panel}
      className={cx(
        'fixed z-[60] rounded-xl border border-line bg-sheet p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] backdrop-blur-xl',
        closing ? 'animate-pop-out' : 'animate-pop',
        className,
      )}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        minWidth: matchWidth ? pos?.width : undefined,
        transformOrigin: pos?.up ? 'bottom' : 'top',
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
