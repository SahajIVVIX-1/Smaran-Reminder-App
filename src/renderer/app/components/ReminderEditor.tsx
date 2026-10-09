import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ruleSummary } from '@shared/ruleSummary';
import { COLORS, ReminderSchema, type Reminder } from '@shared/schema';
import { COLOR_BG, COLOR_NAME } from '../../colors';
import { cx } from '../cx';
import { useExit } from '../useExit';
import { whenLabel } from '../format';
import { CopyIcon, SendIcon, TrashIcon, XIcon } from '../icons';
import { useApp } from '../store';
import { Button, IconButton, Input, NumberField, Segmented, Switch, TextArea } from '../ui';
import { ScheduleEditor } from './ScheduleEditor';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line px-5 py-4">
      <h3 className="text-[12.5px] font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-[12px] leading-snug text-muted">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** Popup to create or edit one reminder. Edits to an existing reminder save as you type. */
export function ReminderEditor() {
  const editing = useApp((s) => s.editing);
  const config = useApp((s) => s.config);
  const nextTimes = useApp((s) => s.nextTimes);
  const { edit, upsertReminder, removeReminder, toastMsg } = useApp.getState();

  const source =
    editing?.mode === 'new'
      ? editing.draft
      : editing?.mode === 'edit'
        ? config?.reminders.find((r) => r.id === editing.id)
        : undefined;

  const [form, setForm] = useState<Reminder | null>(source ?? null);
  const [formFor, setFormFor] = useState(source?.id);
  if (source && formFor !== source.id) {
    setFormFor(source.id);
    setForm(source);
  }
  const title = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing?.mode === 'new') title.current?.focus();
  }, [editing?.mode, formFor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && edit(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edit]);

  // Stay mounted briefly after closing so the popup can animate out.
  const { mounted, closing } = useExit(editing !== null, 190);
  const [lastMode, setLastMode] = useState<'new' | 'edit'>('edit');
  if (editing && editing.mode !== lastMode) setLastMode(editing.mode);
  if (!mounted || !form) return null;
  const isNew = lastMode === 'new';
  const parsed = ReminderSchema.safeParse(form);
  const errors = parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  const next = nextTimes.find((n) => n.reminderId === form.id)?.at;

  const change = (patch: Partial<Reminder>) => {
    const updated = { ...form, ...patch, updatedAt: new Date().toISOString() };
    setForm(updated);
    if (!isNew) {
      const valid = ReminderSchema.safeParse(updated);
      if (valid.success) upsertReminder(valid.data);
    }
  };

  return (
    <div
      // Below the title bar, so the window's own buttons stay clear.
      className={cx(
        'fixed inset-x-0 top-9 bottom-0 z-40 grid place-items-center p-6',
        closing && 'pointer-events-none',
      )}
      role="dialog"
      aria-label={isNew ? 'New reminder' : 'Edit reminder'}
    >
      <button
        type="button"
        aria-label="Close"
        className={cx(
          'absolute inset-0 bg-black/30 backdrop-blur-[2px]',
          closing ? 'animate-fade-out' : 'animate-fade',
        )}
        onClick={() => edit(null)}
      />
      <aside
        className={cx(
          'relative flex max-h-full w-[600px] max-w-full flex-col overflow-hidden rounded-2xl border border-line bg-sheet shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl',
          closing ? 'animate-modal-out' : 'animate-modal',
        )}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-5">
          <span className="font-serif text-[17px]">{isNew ? 'New reminder' : 'Edit reminder'}</span>
          {!isNew && (
            <span className="text-[12.5px] text-muted">
              {form.enabled
                ? next
                  ? `· next ${whenLabel(new Date(next))}`
                  : '· not scheduled'
                : '· off'}
            </span>
          )}
          <IconButton className="ml-auto" aria-label="Close panel" onClick={() => edit(null)}>
            <XIcon size={16} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <div className="space-y-2.5 px-5 pt-4 pb-4">
            <Input
              ref={title}
              aria-label="Title"
              placeholder="What should Smaran remind you about?"
              className="h-10 text-[14px] font-medium"
              value={form.title}
              onChange={(e) => change({ title: e.currentTarget.value })}
            />
            <TextArea
              aria-label="Note"
              placeholder="Add a note (optional)"
              className="min-h-16"
              value={form.note}
              onChange={(e) => change({ note: e.currentTarget.value })}
            />
          </div>

          <Section title="When" hint={ruleSummary(form.rule)}>
            <ScheduleEditor rule={form.rule} onChange={(rule) => change({ rule })} />
          </Section>

          <Section
            title="Priority"
            hint={
              form.priority === 'important'
                ? 'Stays on screen until you act, comes through quiet hours and full-screen apps.'
                : 'Hides itself after a few seconds and waits during quiet hours and full-screen apps.'
            }
          >
            <Segmented
              label="Priority"
              value={form.priority}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'important', label: 'Important' },
              ]}
              onChange={(priority) => change({ priority })}
            />
            {form.priority === 'normal' && (
              <div className="mt-3 flex items-center gap-3 text-[13px]">
                <Switch
                  label="Custom display time"
                  checked={form.hideAfterSec !== null}
                  onChange={(on) => change({ hideAfterSec: on ? 20 : null })}
                />
                {form.hideAfterSec === null ? (
                  <span className="text-muted">Stays for the default time (Settings)</span>
                ) : (
                  <>
                    <span className="text-muted">Stays for</span>
                    <NumberField
                      label="Seconds on screen"
                      value={form.hideAfterSec}
                      min={3}
                      max={600}
                      suffix="seconds"
                      onChange={(n) => change({ hideAfterSec: n })}
                    />
                  </>
                )}
              </div>
            )}
          </Section>

          <Section
            title="If I don’t respond"
            hint="Smaran can remind you again when a reminder hides itself unanswered."
          >
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <Switch
                label="Remind again"
                checked={form.followUp.enabled}
                onChange={(enabled) => change({ followUp: { ...form.followUp, enabled } })}
              />
              {form.followUp.enabled ? (
                <>
                  <span className="text-muted">Again every</span>
                  <NumberField
                    label="Minutes between"
                    value={form.followUp.everyMin}
                    min={1}
                    max={240}
                    suffix="min,"
                    onChange={(everyMin) => change({ followUp: { ...form.followUp, everyMin } })}
                  />
                  <span className="text-muted">up to</span>
                  <NumberField
                    label="Times"
                    value={form.followUp.times}
                    min={1}
                    max={20}
                    suffix="times"
                    onChange={(times) => change({ followUp: { ...form.followUp, times } })}
                  />
                </>
              ) : (
                <span className="text-muted">Don’t remind again</span>
              )}
            </div>
          </Section>

          <Section
            title="Rotating lines"
            hint="Optional. Each time it appears, the reminder shows the next line: stretches, affirmations, tips."
          >
            <LinesEditor lines={form.lines} onChange={(lines) => change({ lines })} />
            {form.lines.length > 1 && (
              <div className="mt-3">
                <Segmented
                  label="Line order"
                  value={form.lineOrder}
                  options={[
                    { value: 'inOrder', label: 'In order' },
                    { value: 'shuffle', label: 'Shuffled' },
                  ]}
                  onChange={(lineOrder) => change({ lineOrder })}
                />
              </div>
            )}
          </Section>

          <Section
            title="Sound"
            hint={
              form.sound === 'default'
                ? `Follows the app setting (currently ${config?.settings.notification.sound ? 'on' : 'off'}).`
                : form.sound === 'on'
                  ? 'Always plays a soft chime for this reminder.'
                  : 'This reminder is always silent.'
            }
          >
            <Segmented
              label="Sound"
              value={form.sound}
              options={[
                { value: 'default', label: 'App setting' },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              onChange={(sound) => change({ sound })}
            />
          </Section>

          <Section title="Colour">
            <div className="flex gap-2" role="radiogroup" aria-label="Colour">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.color === c}
                  aria-label={COLOR_NAME[c]}
                  title={COLOR_NAME[c]}
                  onClick={() => change({ color: c })}
                  className={cx(
                    'h-6 w-6 rounded-full transition-transform duration-150 hover:scale-110',
                    COLOR_BG[c],
                    form.color === c && 'ring-2 ring-ink/70 ring-offset-2 ring-offset-bg',
                  )}
                />
              ))}
            </div>
          </Section>
        </div>

        <footer className="flex shrink-0 items-center gap-1.5 border-t border-line px-5 py-2.5">
          {errors.length > 0 && (
            <span className="mr-auto truncate text-[12.5px] text-danger">{errors[0]}</span>
          )}
          {isNew ? (
            <>
              <span className="flex-1" />
              <Button variant="ghost" onClick={() => edit(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!parsed.success}
                onClick={() => {
                  if (!parsed.success) return;
                  upsertReminder(parsed.data);
                  edit(null);
                  toastMsg(`Added “${parsed.data.title}”`);
                }}
              >
                Create reminder
              </Button>
            </>
          ) : (
            <>
              {errors.length === 0 && (
                <span className="mr-auto flex items-center gap-2 text-[12.5px] text-muted">
                  <Switch
                    label="Reminder on"
                    checked={form.enabled}
                    onChange={(enabled) => change({ enabled })}
                  />
                  {form.enabled ? 'On' : 'Off'}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                title="Show it now"
                onClick={() =>
                  void useApp.getState().track(window.smaran.reminders.showNow(form.id))
                }
              >
                <SendIcon size={15} /> Show now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const copy: Reminder = {
                    ...structuredClone(form),
                    id: crypto.randomUUID(),
                    title: `${form.title} (copy)`,
                  };
                  edit({ mode: 'new', draft: copy });
                }}
              >
                <CopyIcon size={15} /> Duplicate
              </Button>
              <Button variant="danger" size="sm" onClick={() => removeReminder(form.id)}>
                <TrashIcon size={15} /> Delete
              </Button>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

function LinesEditor({
  lines,
  onChange,
}: {
  lines: string[];
  onChange: (lines: string[]) => void;
}) {
  const [text, setText] = useState('');
  const add = () => {
    const line = text.trim();
    if (!line) return;
    onChange([...lines, line]);
    setText('');
  };
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => (
        <div
          key={i}
          className="group flex items-center gap-2 rounded-lg bg-raised px-2.5 py-0.5 ring-1 ring-line"
        >
          <span className="w-5 text-[12px] text-faint">{i + 1}</span>
          <input
            aria-label={`Line ${i + 1}`}
            className="h-7 flex-1 bg-transparent text-[13px] outline-none"
            value={line}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange(lines.map((l, j) => (j === i ? value : l)));
            }}
            onBlur={() => !line.trim() && onChange(lines.filter((_, j) => j !== i))}
          />
          <button
            type="button"
            aria-label={`Remove line ${i + 1}`}
            onClick={() => onChange(lines.filter((_, j) => j !== i))}
            className="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          aria-label="New line"
          placeholder={lines.length ? 'Add another line' : 'Add a line, then press Enter'}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button onClick={add} disabled={!text.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
