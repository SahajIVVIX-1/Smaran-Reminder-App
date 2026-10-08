import type { ReactNode } from 'react';
import { MONTH_SHORT, WEEKDAY_SHORT } from '@shared/ruleSummary';
import type { Rule } from '@shared/schema';
import { cx } from '../cx';
import { defaultRule } from '../rules';
import { Button, NumberField, Segmented, Select } from '../ui';

const KINDS = [
  { value: 'once', label: 'Once' },
  { value: 'interval', label: 'Every…' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

const timeClass =
  'h-9 rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink focus:border-accent/60 focus:ring-3 focus:ring-accent-soft focus:outline-none';

function TimeInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => e.currentTarget.value && onChange(e.currentTarget.value)}
      className={timeClass}
    />
  );
}

function Days({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Days of the week">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = on ? value.filter((x) => x !== d) : [...value, d];
              if (next.length > 0) onChange(next.sort((a, b) => a - b));
            }}
            className={cx(
              'h-8 w-10 rounded-lg text-[12.5px] transition-colors duration-150',
              on
                ? 'bg-accent text-on-accent'
                : 'bg-raised text-muted ring-1 ring-line hover:text-ink',
            )}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
    <span className="w-20 shrink-0 text-[13px] text-muted">{label}</span>
    {children}
  </div>
);

/** Builds a schedule rule: pick a kind, then only the fields that kind needs. */
export function ScheduleEditor({ rule, onChange }: { rule: Rule; onChange: (r: Rule) => void }) {
  return (
    <div className="space-y-3">
      <Segmented
        label="Repeat"
        value={rule.kind}
        options={KINDS}
        onChange={(kind) => kind !== rule.kind && onChange(defaultRule(kind))}
      />
      <div key={rule.kind} className="animate-fade space-y-3">
        <KindFields rule={rule} onChange={onChange} />
      </div>
    </div>
  );
}

function KindFields({ rule, onChange }: { rule: Rule; onChange: (r: Rule) => void }) {
  switch (rule.kind) {
    case 'once':
      return (
        <Line label="On">
          <input
            type="datetime-local"
            aria-label="Date and time"
            value={rule.at.slice(0, 16)}
            onChange={(e) =>
              e.currentTarget.value && onChange({ ...rule, at: `${e.currentTarget.value}:00` })
            }
            className={timeClass}
          />
        </Line>
      );
    case 'interval': {
      const minutes = Math.round(rule.everyMs / 60_000);
      const hours = minutes % 60 === 0 && minutes >= 60;
      return (
        <>
          <Line label="Every">
            <NumberField
              label="Every"
              value={hours ? minutes / 60 : minutes}
              min={1}
              max={hours ? 168 : 1440}
              onChange={(n) => onChange({ ...rule, everyMs: (hours ? n * 60 : n) * 60_000 })}
            />
            <Select
              aria-label="Unit"
              className="w-28"
              value={hours ? 'h' : 'm'}
              onChange={(e) => {
                const toHours = e.currentTarget.value === 'h';
                const n = hours ? minutes / 60 : minutes;
                onChange({
                  ...rule,
                  everyMs: (toHours ? Math.max(1, Math.round(n)) * 60 : n) * 60_000,
                });
              }}
            >
              <option value="m">minutes</option>
              <option value="h">hours</option>
            </Select>
          </Line>
          <Line label="Between">
            {rule.activeHours ? (
              <>
                <TimeInput
                  label="From"
                  value={rule.activeHours.from}
                  onChange={(from) =>
                    onChange({
                      ...rule,
                      activeHours: { from, to: rule.activeHours?.to ?? '18:00' },
                    })
                  }
                />
                <span className="text-muted">and</span>
                <TimeInput
                  label="Until"
                  value={rule.activeHours.to}
                  onChange={(to) =>
                    onChange({
                      ...rule,
                      activeHours: { from: rule.activeHours?.from ?? '09:00', to },
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = { ...rule };
                    delete next.activeHours;
                    onChange(next);
                  }}
                >
                  All day
                </Button>
              </>
            ) : (
              <>
                <span className="text-[13px]">All day</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ ...rule, activeHours: { from: '09:00', to: '18:00' } })}
                >
                  Set hours
                </Button>
              </>
            )}
          </Line>
          <Line label="On">
            {rule.weekdays ? (
              <>
                <Days
                  value={rule.weekdays}
                  onChange={(weekdays) => onChange({ ...rule, weekdays })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = { ...rule };
                    delete next.weekdays;
                    onChange(next);
                  }}
                >
                  Every day
                </Button>
              </>
            ) : (
              <>
                <span className="text-[13px]">Every day</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ ...rule, weekdays: [1, 2, 3, 4, 5] })}
                >
                  Pick days
                </Button>
              </>
            )}
          </Line>
        </>
      );
    }
    case 'daily':
      return (
        <Line label="At">
          {rule.times.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              <TimeInput
                label={`Time ${i + 1}`}
                value={t}
                onChange={(v) =>
                  onChange({ ...rule, times: rule.times.map((x, j) => (j === i ? v : x)) })
                }
              />
              {rule.times.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => onChange({ ...rule, times: rule.times.filter((_, j) => j !== i) })}
                  className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {rule.times.length < 12 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...rule, times: [...rule.times, '13:00'] })}
            >
              + Add time
            </Button>
          )}
        </Line>
      );
    case 'weekly':
      return (
        <>
          <Line label="On">
            <Days value={rule.weekdays} onChange={(weekdays) => onChange({ ...rule, weekdays })} />
          </Line>
          <Line label="At">
            <TimeInput
              label="Time"
              value={rule.time}
              onChange={(time) => onChange({ ...rule, time })}
            />
          </Line>
        </>
      );
    case 'monthly':
      return (
        <>
          <Line label="On day">
            <Select
              aria-label="Day of the month"
              className="w-48"
              value={String(rule.day)}
              onChange={(e) => {
                const v = e.currentTarget.value;
                onChange({ ...rule, day: v === 'last' ? 'last' : Number(v) });
              }}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                  {i + 1 > 28 ? ' (or the last day)' : ''}
                </option>
              ))}
              <option value="last">The last day</option>
            </Select>
          </Line>
          <Line label="At">
            <TimeInput
              label="Time"
              value={rule.time}
              onChange={(time) => onChange({ ...rule, time })}
            />
          </Line>
        </>
      );
    case 'yearly':
      return (
        <>
          <Line label="On">
            <Select
              aria-label="Day"
              className="w-20"
              value={rule.day}
              onChange={(e) => onChange({ ...rule, day: Number(e.currentTarget.value) })}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Month"
              className="w-24"
              value={rule.month}
              onChange={(e) => onChange({ ...rule, month: Number(e.currentTarget.value) })}
            >
              {MONTH_SHORT.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Line>
          <Line label="At">
            <TimeInput
              label="Time"
              value={rule.time}
              onChange={(time) => onChange({ ...rule, time })}
            />
          </Line>
        </>
      );
  }
}
