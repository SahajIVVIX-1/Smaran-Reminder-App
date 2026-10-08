import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';

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
        size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-9 px-3.5 text-[13.5px]',
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
        'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150',
        'hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent',
        className,
      )}
      {...rest}
    />
  );
}

const field =
  'rounded-lg border border-line bg-surface px-3 text-[13.5px] text-ink placeholder:text-faint ' +
  'transition-[border-color,box-shadow] duration-150 focus:border-accent/60 focus:ring-3 focus:ring-accent-soft focus:outline-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} type="text" className={cx(field, 'h-9 w-full', className)} {...rest} />;
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

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        field,
        'h-9 cursor-pointer pr-8',
        className?.includes('w-') ? className : cx('w-full', className),
      )}
      {...rest}
    />
  );
}

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
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className={cx(field, 'h-9 w-20 text-center')}
      />
      {suffix && <span className="text-[13px] text-muted">{suffix}</span>}
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
        'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );
}

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
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg bg-raised p-0.5 ring-1 ring-line"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-8 rounded-md px-3 text-[13px] transition-[background-color,color,box-shadow] duration-150',
            o.value === value
              ? 'bg-surface font-medium text-ink shadow-sm ring-1 ring-line'
              : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
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
    <section className={cx('rounded-2xl border border-line bg-surface', className)}>
      {title && (
        <header className="px-5 pt-4 pb-1">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
        </header>
      )}
      <div className="px-5 py-2">{children}</div>
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
    <div className="flex items-center gap-6 border-b border-line py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-[13.5px]">
          {label}
        </label>
        {hint && <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{hint}</div>}
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
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid animate-fade place-items-center bg-black/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-[460px] max-w-[92vw] animate-pop rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 className="font-serif text-[22px] leading-tight">{title}</h2>
        <div className="mt-3 text-[13.5px] leading-relaxed text-muted">{children}</div>
        <div className="mt-6 flex justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}
