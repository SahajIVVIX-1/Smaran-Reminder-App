import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';
import { useExit } from './useExit';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap',
        'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-accent text-on-accent shadow-sm hover:bg-accent-hover',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-raised',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-ink',
        variant === 'danger' && 'text-danger hover:bg-hover',
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150',
        'hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent',
        className,
      )}
      {...rest}
    />
  );
}

const field =
  'rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink placeholder:text-faint ' +
  'transition-[border-color,box-shadow] duration-150 focus:border-accent/60 focus:ring-3 focus:ring-accent-soft focus:outline-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} type="text" className={cx(field, 'h-8 w-full', className)} {...rest} />;
  },
);

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(field, 'min-h-20 w-full resize-y py-2 leading-relaxed', className)}
      {...rest}
    />
  );
}

/** Number box with themed − / + steppers. */
export function NumberField({
  value,
  onChange,
  min,
  max,
  suffix,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix?: string;
  label: string;
}) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n))));
  const step =
    'grid h-full w-6 place-items-center text-faint transition-colors hover:bg-hover hover:text-ink disabled:opacity-30';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex h-8 items-center overflow-hidden rounded-lg border border-line bg-surface transition-[border-color,box-shadow] duration-150 focus-within:border-accent/60 focus-within:ring-3 focus-within:ring-accent-soft">
        <button
          type="button"
          aria-label={`Less ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => set(value - 1)}
          className={step}
        >
          −
        </button>
        <input
          type="number"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = e.currentTarget.valueAsNumber;
            if (!Number.isNaN(n)) set(n);
          }}
          className="h-full w-10 bg-transparent text-center text-[13px] text-ink tabular-nums outline-none"
        />
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => set(value + 1)}
          className={step}
        >
          +
        </button>
      </span>
      {suffix && <span className="text-[12.5px] text-muted">{suffix}</span>}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cx(
        'relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] left-[3px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          checked && 'translate-x-[14px]',
        )}
      />
    </button>
  );
}

/** Options with a highlight that slides to the chosen one. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const el = group.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);

  // No slide on first paint; only when the choice changes.
  useEffect(() => {
    const t = window.setTimeout(() => setAnimate(true), 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      className="relative inline-flex rounded-lg bg-raised p-0.5 ring-1 ring-line"
    >
      {thumb && (
        <span
          aria-hidden
          className={cx(
            'absolute top-0.5 bottom-0.5 rounded-md bg-surface shadow-sm ring-1 ring-line',
            animate && 'transition-[left,width] duration-300 ease-[cubic-bezier(0.2,0.9,0.25,1)]',
          )}
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'relative h-7 rounded-md px-2.5 text-[12.5px] whitespace-nowrap transition-colors duration-200',
            o.value === value ? 'font-medium text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Animates its height to fit whatever it contains (e.g. fields that change with a choice). */
export function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    setHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, []);
  return (
    // The 4px inset keeps focus rings from being clipped.
    <div
      className="-m-1 overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.2,0.9,0.25,1)]"
      style={{ height }}
    >
      <div ref={inner} className="p-1">
        {children}
      </div>
    </div>
  );
}

/** A settings-style card: title, optional description, then rows. */
export function Card({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface', className)}>
      {title && (
        <header className="px-4 pt-3.5 pb-0.5">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
        </header>
      )}
      <div className="px-4 py-1">{children}</div>
    </section>
  );
}

/** One labelled row inside a Card. */
export function Row({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex min-h-12 items-center gap-6 border-b border-line py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-[13px]">
          {label}
        </label>
        {hint && <div className="mt-0.5 text-[12px] leading-snug text-muted">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'ok';
}) {
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium',
        tone === 'neutral' && 'bg-raised text-muted ring-1 ring-line',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'ok' && 'bg-ok/12 text-ok',
      )}
    >
      {children}
    </span>
  );
}

export function Dialog({
  open,
  title,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
}) {
  const { mounted, closing } = useExit(open, 190);
  if (!mounted) return null;
  return (
    <div
      className={cx(
        'fixed inset-x-0 top-9 bottom-0 z-50 grid place-items-center bg-black/30 backdrop-blur-[2px]',
        closing ? 'pointer-events-none animate-fade-out' : 'animate-fade',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={cx(
          'w-[420px] max-w-[92vw] rounded-2xl border border-line bg-sheet p-5 shadow-2xl backdrop-blur-xl',
          closing ? 'animate-modal-out' : 'animate-modal',
        )}
      >
        <h2 className="font-serif text-[20px] leading-tight">{title}</h2>
        <div className="mt-2.5 text-[13px] leading-relaxed text-muted">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}
