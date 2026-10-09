import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useRef, useState } from 'react';
import { cx } from '../cx';
import { Popover } from './Popover';

const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** A themed date picker with a month calendar. `value` and `onChange` use 'yyyy-MM-dd'. */
export function DateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const date = parseISO(value);
  const [month, setMonth] = useState(() => startOfMonth(date));
  const [dir, setDir] = useState<1 | -1>(1);
  const today = startOfDay(new Date());
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));

  const go = (delta: 1 | -1) => {
    setDir(delta);
    setMonth((m) => addMonths(m, delta));
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          setMonth(startOfMonth(date));
          setOpen((o) => !o);
        }}
        className={cx(
          'inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface pr-2 pl-2.5 text-[13px] text-ink',
          'transition-[border-color,box-shadow,background-color] duration-150 hover:bg-raised focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent-soft focus-visible:outline-none',
          open && 'border-accent/60 ring-3 ring-accent-soft',
        )}
      >
        {format(date, 'EEE d MMM yyyy')}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
          className="text-faint"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      <Popover anchor={trigger} open={open} onClose={() => setOpen(false)}>
        <div className="w-[248px] p-1.5" role="dialog" aria-label="Choose a date">
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => go(-1)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
            >
              ‹
            </button>
            <span key={month.toISOString()} className="animate-fade text-[13px] font-medium">
              {format(month, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => go(1)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-faint">
            {WEEK.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div
            key={month.toISOString()}
            className="grid grid-cols-7 gap-0.5"
            style={{
              animation: `${dir > 0 ? 'cal-next' : 'cal-prev'} 220ms cubic-bezier(0.2,0.9,0.25,1) both`,
            }}
          >
            {days.map((d) => {
              const past = d < today;
              const chosen = isSameDay(d, date);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={past}
                  aria-pressed={chosen}
                  aria-label={format(d, 'EEEE d MMMM yyyy')}
                  onClick={() => {
                    onChange(format(d, 'yyyy-MM-dd'));
                    setOpen(false);
                  }}
                  className={cx(
                    'h-8 rounded-md text-[12.5px] tabular-nums transition-colors duration-100 disabled:opacity-30',
                    chosen
                      ? 'bg-accent font-medium text-on-accent'
                      : isSameDay(d, today)
                        ? 'text-accent ring-1 ring-accent/50 ring-inset hover:bg-hover'
                        : 'hover:bg-hover',
                    !isSameMonth(d, month) && !chosen && 'text-faint',
                  )}
                >
                  {format(d, 'd')}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onChange(format(today, 'yyyy-MM-dd'));
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-[12px] text-accent hover:bg-hover"
            >
              Today
            </button>
          </div>
        </div>
      </Popover>
    </>
  );
}
