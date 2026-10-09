import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../cx';
import { Popover } from './Popover';

export interface Option<T> {
  value: T;
  label: string;
}

/** A themed dropdown (replaces the browser's native select and its system-styled list). */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  className,
  id,
  ...aria
}: {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  className?: string;
  id?: string;
  'aria-label'?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const show = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };
  const choose = (o: Option<T>) => {
    onChange(o.value);
    setOpen(false);
    trigger.current?.focus();
  };

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'ArrowDown') setActive((i) => Math.min(options.length - 1, i + 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      const o = options[active];
      if (o) choose(o);
    } else if (e.key === 'Tab') setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        {...aria}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={cx(
          'inline-flex h-8 items-center justify-between gap-2 rounded-lg border border-line bg-surface pr-2 pl-2.5 text-left text-[13px] text-ink',
          'transition-[border-color,box-shadow,background-color] duration-150 hover:bg-raised',
          'focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent-soft focus-visible:outline-none',
          open && 'border-accent/60 ring-3 ring-accent-soft',
          className?.includes('w-') ? className : cx('w-full', className),
        )}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={cx(
            'shrink-0 text-faint transition-transform duration-200',
            open && 'rotate-180',
          )}
        >
          <path
            d="M3 4.5l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <Popover anchor={trigger} open={open} onClose={() => setOpen(false)} matchWidth>
        <div ref={list} id={listId} role="listbox" className="max-h-64 overflow-y-auto">
          {options.map((o, i) => (
            <div
              key={String(o.value)}
              role="option"
              data-index={i}
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              className={cx(
                'flex h-8 cursor-default items-center gap-2 rounded-lg px-2.5 text-[13px] whitespace-nowrap transition-colors duration-100',
                i === active ? 'bg-hover text-ink' : 'text-ink',
                o.value === value && 'font-medium',
              )}
            >
              <span className="flex-1">{o.label}</span>
              {o.value === value && (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-accent">
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
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
