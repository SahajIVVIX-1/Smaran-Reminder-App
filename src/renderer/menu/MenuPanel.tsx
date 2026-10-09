import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { MenuEntry } from '@shared/menu';
import { cx } from '../app/cx';

/**
 * Smaran's right-click menu: a rounded glass panel with separators, shortcut hints on the right and
 * destructive items in red. The tray, notifications and the app all draw their menus with this.
 * Arrow keys move, Enter chooses, Escape closes. Items never take focus, so a text field keeps its
 * selection while its menu is open.
 */
export function MenuPanel({
  items,
  onPick,
  className,
  style,
}: {
  items: MenuEntry[];
  onPick: (id: string | null) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const [active, setActive] = useState(-1);
  const pick = useRef(onPick);
  const current = useRef(active);
  useEffect(() => {
    pick.current = onPick;
    current.current = active;
  });

  useEffect(() => {
    const enabled = items.flatMap((e, i) => (e.kind === 'item' && !e.disabled ? [i] : []));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        pick.current(null);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActive((cur) => {
          const at = enabled.indexOf(cur);
          if (enabled.length === 0) return -1;
          if (at < 0) return (e.key === 'ArrowDown' ? enabled[0] : enabled.at(-1)) ?? -1;
          const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
          return enabled[next] ?? -1;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const entry = items[current.current];
        if (entry?.kind === 'item' && !entry.disabled) pick.current(entry.id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [items]);

  const anyChecked = items.some((e) => e.kind === 'item' && e.checked !== undefined);

  return (
    <div
      role="menu"
      style={style}
      className={cx(
        'min-w-[208px] rounded-xl border border-line bg-sheet p-1 text-ink shadow-[0_14px_36px_-10px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.12)] backdrop-blur-xl select-none',
        className,
      )}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => setActive(-1)}
    >
      {items.map((entry, i) => {
        if (entry.kind === 'separator')
          return <div key={i} role="separator" className="mx-2 my-1 h-px bg-line" />;
        if (entry.kind === 'heading')
          return (
            <div key={i} className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-medium text-faint">
              {entry.label}
            </div>
          );
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={entry.disabled}
            onMouseEnter={() => setActive(entry.disabled ? -1 : i)}
            onClick={() => !entry.disabled && onPick(entry.id)}
            className={cx(
              'flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-75',
              entry.danger ? 'text-danger' : 'text-ink',
              active === i && (entry.danger ? 'bg-danger/12' : 'bg-hover'),
              entry.disabled && 'opacity-40',
            )}
          >
            {anyChecked && (
              <span className="flex w-3.5 shrink-0 justify-center text-accent">
                {entry.checked && (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path
                      d="M2.5 6.5l2.5 2.5 4.5-5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            )}
            <span className="flex-1 truncate">{entry.label}</span>
            {entry.hint && (
              <span className="ml-6 shrink-0 font-mono text-[11px] text-faint">{entry.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
