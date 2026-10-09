import { useEffect, useRef, useState } from 'react';
import { parseClock } from '@shared/quickParse';
import { cx } from '../cx';
import { Popover } from './Popover';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

/**
 * A themed time picker: type "18:30", "6pm" or "9", or pick hour and minute from the list.
 * Always stores 24-hour 'HH:mm'.
 */
export function TimeField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(value);
  }
  const [h = '09', m = '00'] = value.split(':');
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();

  const commit = () => {
    const t = parseClock(text) ?? (/^\d{1,2}:\d{2}$/.test(text) ? text.padStart(5, '0') : null);
    if (t && t !== value) onChange(t);
    else setText(value);
  };

  return (
    <div ref={box} className="inline-flex">
      <div
        className={cx(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface pr-1 pl-2.5 transition-[border-color,box-shadow] duration-150',
          'focus-within:border-accent/60 focus-within:ring-3 focus-within:ring-accent-soft',
          open && 'border-accent/60 ring-3 ring-accent-soft',
        )}
      >
        <input
          aria-label={label}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              setOpen(false);
            }
          }}
          className="w-12 bg-transparent font-mono text-[12.5px] text-ink tabular-nums outline-none"
        />
        <button
          type="button"
          aria-label={`Choose ${label.toLowerCase()}`}
          onClick={() => setOpen((o) => !o)}
          className="grid h-6 w-6 place-items-center rounded-md text-faint transition-colors hover:bg-hover hover:text-ink"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>
      </div>
      <Popover anchor={box} open={open} onClose={() => setOpen(false)}>
        <div className="flex gap-1">
          <Column label="Hour" items={HOURS} selected={h} onPick={(x) => onChange(`${x}:${m}`)} />
          <div className="w-px bg-line" />
          <Column
            label="Minute"
            items={minutes}
            selected={m}
            onPick={(x) => {
              onChange(`${h}:${x}`);
              setOpen(false);
            }}
          />
        </div>
      </Popover>
    </div>
  );
}

function Column({
  label,
  items,
  selected,
  onPick,
}: {
  label: string;
  items: string[];
  selected: string;
  onPick: (value: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && list.current)
      list.current.scrollTop = el.offsetTop - list.current.clientHeight / 2 + 14;
  }, []);
  return (
    <div ref={list} role="listbox" aria-label={label} className="h-56 w-14 overflow-y-auto">
      {items.map((x) => (
        <button
          key={x}
          type="button"
          role="option"
          aria-selected={x === selected}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(x)}
          className={cx(
            'block h-7 w-full rounded-md text-center font-mono text-[12.5px] tabular-nums transition-colors duration-100',
            x === selected ? 'bg-accent font-medium text-on-accent' : 'text-ink hover:bg-hover',
          )}
        >
          {x}
        </button>
      ))}
    </div>
  );
}
