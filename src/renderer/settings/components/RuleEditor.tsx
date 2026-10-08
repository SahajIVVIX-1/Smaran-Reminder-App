import type { Rule } from '@shared/schema';
import { MONTH_SHORT, WEEKDAY_SHORT } from '@shared/ruleSummary';
import { defaultRule } from '../actions';
import { Button, Field, NumberInput, Select } from './ui';
import { cx } from '../cx';

type Kind = Rule['kind'];

const KINDS: { value: Kind; label: string }[] = [
  { value: 'interval', label: 'Every few minutes or hours' },
  { value: 'once', label: 'Once, at a date and time' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
];

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
      className="h-8 rounded-md border border-line bg-panel px-2 text-sm text-ink focus:border-accent focus:outline-none"
    />
  );
}

function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
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
              'h-8 w-11 rounded-md border text-xs',
              on
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-panel text-muted hover:bg-raised',
            )}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

export function RuleEditor({ rule, onChange }: { rule: Rule; onChange: (r: Rule) => void }) {
  return (
    <>
      <Field label="Repeat" htmlFor="rule-kind">
        <Select
          id="rule-kind"
          value={rule.kind}
          onChange={(e) => onChange(defaultRule(e.currentTarget.value as Kind))}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </Field>
      <KindFields rule={rule} onChange={onChange} />
    </>
  );
}

function KindFields({ rule, onChange }: { rule: Rule; onChange: (r: Rule) => void }) {
  switch (rule.kind) {
    case 'interval': {
      const minutes = Math.round(rule.everyMs / 60_000);
      return (
        <>
          <Field label="Every">
            <NumberInput
              aria-label="Every how many minutes"
              value={minutes}
              min={1}
              max={10_080}
              unit="minutes"
              onChange={(n) => onChange({ ...rule, everyMs: Math.max(1, Math.round(n)) * 60_000 })}
            />
          </Field>
          <Field
            label="Only between"
            hint={rule.activeHours ? 'An end before the start runs overnight.' : 'All day.'}
            action={
              <Button
                small
                tone="ghost"
                onClick={() => {
                  const next = { ...rule };
                  if (next.activeHours) delete next.activeHours;
                  else next.activeHours = { from: '09:00', to: '17:00' };
                  onChange(next);
                }}
              >
                {rule.activeHours ? 'All day' : 'Set hours'}
              </Button>
            }
          >
            {rule.activeHours && (
              <div className="flex items-center gap-2">
                <TimeInput
                  label="From"
                  value={rule.activeHours.from}
                  onChange={(from) =>
                    onChange({
                      ...rule,
                      activeHours: { from, to: rule.activeHours?.to ?? '17:00' },
                    })
                  }
                />
                <span className="text-muted">to</span>
                <TimeInput
                  label="To"
                  value={rule.activeHours.to}
                  onChange={(to) =>
                    onChange({
                      ...rule,
                      activeHours: { from: rule.activeHours?.from ?? '09:00', to },
                    })
                  }
                />
              </div>
            )}
          </Field>
          <Field
            label="On days"
            action={
              <Button
                small
                tone="ghost"
                onClick={() => {
                  const next = { ...rule };
                  if (next.weekdays) delete next.weekdays;
                  else next.weekdays = [1, 2, 3, 4, 5];
                  onChange(next);
                }}
              >
                {rule.weekdays ? 'Every day' : 'Pick days'}
              </Button>
            }
          >
            {rule.weekdays ? (
              <WeekdayPicker
                value={rule.weekdays}
                onChange={(weekdays) => onChange({ ...rule, weekdays })}
              />
            ) : (
              <span className="text-sm text-muted">Every day</span>
            )}
          </Field>
        </>
      );
    }
    case 'once':
      return (
        <Field label="Date and time" htmlFor="rule-at">
          <input
            id="rule-at"
            type="datetime-local"
            value={rule.at.slice(0, 16)}
            onChange={(e) =>
              e.currentTarget.value && onChange({ ...rule, at: `${e.currentTarget.value}:00` })
            }
            className="h-8 rounded-md border border-line bg-panel px-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </Field>
      );
    case 'daily':
      return (
        <Field label="At">
          <div className="flex flex-wrap items-center gap-2">
            {rule.times.map((t, i) => (
              <span key={i} className="flex items-center gap-1">
                <TimeInput
                  label={`Time ${i + 1}`}
                  value={t}
                  onChange={(v) =>
                    onChange({ ...rule, times: rule.times.map((x, j) => (j === i ? v : x)) })
                  }
                />
                {rule.times.length > 1 && (
                  <Button
                    small
                    tone="ghost"
                    aria-label={`Remove ${t}`}
                    onClick={() =>
                      onChange({ ...rule, times: rule.times.filter((_, j) => j !== i) })
                    }
                  >
                    ✕
                  </Button>
                )}
              </span>
            ))}
            <Button small onClick={() => onChange({ ...rule, times: [...rule.times, '12:00'] })}>
              Add time
            </Button>
          </div>
        </Field>
      );
    case 'weekly':
      return (
        <>
          <Field label="On">
            <WeekdayPicker
              value={rule.weekdays}
              onChange={(weekdays) => onChange({ ...rule, weekdays })}
            />
          </Field>
          <Field label="At">
            <TimeInput
              label="Time"
              value={rule.time}
              onChange={(time) => onChange({ ...rule, time })}
            />
          </Field>
        </>
      );
    case 'monthly':
      return (
        <>
          <Field
            label="On day"
            htmlFor="rule-day"
            hint="Days past the end of a short month use its last day."
          >
            <Select
              id="rule-day"
              value={String(rule.day)}
              onChange={(e) => {
                const v = e.currentTarget.value;
                onChange({ ...rule, day: v === 'last' ? 'last' : Number(v) });
              }}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
              <option value="last">Last day of the month</option>
            </Select>
          </Field>
          <Field label="At">
            <TimeInput
              label="Time"
              value={rule.time}
              onChange={(time) => onChange({ ...rule, time })}
            />
          </Field>
        </>
      );
    case 'yearly':
      return (
        <>
          <Field label="On" hint="29 February falls on the 28th in other years.">
            <div className="flex gap-2">
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
                className="w-28"
                value={rule.month}
                onChange={(e) => onChange({ ...rule, month: Number(e.currentTarget.value) })}
              >
                {MONTH_SHORT.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
          <Field label="At">
            <TimeInput
              label="Time"
              value={rule.time}
              onChange={(time) => onChange({ ...rule, time })}
            />
          </Field>
        </>
      );
  }
}
