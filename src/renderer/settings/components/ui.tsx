import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cx } from '../cx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'default' | 'danger' | 'ghost';
  small?: boolean;
};

export function Button({ tone = 'default', small, className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        small ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        tone === 'primary' && 'border-accent bg-accent text-accent-ink hover:brightness-110',
        tone === 'default' && 'border-line bg-panel text-ink hover:bg-raised',
        tone === 'danger' && 'border-line bg-panel text-danger hover:bg-raised',
        tone === 'ghost' &&
          'border-transparent bg-transparent text-muted hover:bg-raised hover:text-ink',
        className,
      )}
      {...rest}
    />
  );
}

const fieldClass =
  'w-full rounded-md border border-line bg-panel px-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60';

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={cx(fieldClass, 'h-8', className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldClass, 'min-h-24 py-2 leading-snug', className)} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldClass, 'h-8 pr-7', className)} {...rest} />;
}

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  id?: string;
  'aria-label'?: string;
}

/** Number box that clamps to [min, max] when it loses focus. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  ...rest
}: NumberInputProps) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        className={cx(fieldClass.replace('w-full ', ''), 'h-8 w-24')}
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (!Number.isNaN(n)) onChange(n);
        }}
        onBlur={(e) => {
          const n = e.currentTarget.valueAsNumber;
          onChange(Math.min(max, Math.max(min, Number.isNaN(n) ? min : n)));
        }}
        {...rest}
      />
      {unit && <span className="text-xs text-muted">{unit}</span>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
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
        'relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  action,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3 py-1.5">
      <label htmlFor={htmlFor} className="text-sm text-muted">
        {label}
      </label>
      <div>
        {children}
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      <div>{action}</div>
    </div>
  );
}

export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
        {aside}
      </div>
      <div className="rounded-lg border border-line bg-panel px-4 py-2">{children}</div>
    </section>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] leading-4 text-muted">
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-muted">
      {children}
    </div>
  );
}

export function Modal({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-[440px] max-w-[90vw] rounded-xl border border-line bg-panel p-5 shadow-2xl">
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
        <div className="mb-4 text-sm">{children}</div>
        <div className="flex justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}
