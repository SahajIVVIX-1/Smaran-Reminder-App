import { useEffect, useRef, useState, type ReactNode } from 'react';
import { hasRich, RICH_MARKERS, type RichMark } from '@shared/richText';
import { ruleSummary } from '@shared/ruleSummary';
import { COLORS, ReminderSchema, type Reminder } from '@shared/schema';
import { COLOR_BG, COLOR_NAME } from '../../colors';
import { cx } from '../cx';
import { useExit } from '../useExit';
import { whenLabel } from '../format';
import { CopyIcon, SendIcon, TrashIcon, XIcon } from '../icons';
import { useApp } from '../store';
import { Button, IconButton, Input, NumberField, Segmented, Switch, TextArea } from '../ui';
import { getScene, type SceneKey } from '@shared/dots/dotsScenes';
import { SmaranDots } from '../../dots';
import { RichText } from '../../RichText';
import { AnimationBrowser } from './LogoSettings';
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
      <h3 className="font-serif text-[15px] font-semibold">{title}</h3>
      {hint && (
        <p className="mt-0.5 font-serif text-[13px] leading-snug text-muted italic">{hint}</p>
      )}
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
  const noteRef = useRef<HTMLTextAreaElement>(null);
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
  const [choosingAnimation, setChoosingAnimation] = useState(false);
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

  /** Wraps the selected note text in a style's markers, or unwraps it if already styled. */
  const wrapNote = (mark: RichMark) => {
    const el = noteRef.current;
    if (!el) return;
    const marker = RICH_MARKERS[mark];
    const { selectionStart: s, selectionEnd: e, value } = el;
    const wrapped =
      value.slice(Math.max(0, s - marker.length), s) === marker &&
      value.slice(e, e + marker.length) === marker &&
      // Inside **bold**, a single * either side is bold's, not italic's.
      !(mark === 'italic' && (value[s - 2] === '*' || value[e + 1] === '*'));
    const note = wrapped
      ? value.slice(0, s - marker.length) + value.slice(s, e) + value.slice(e + marker.length)
      : value.slice(0, s) + marker + value.slice(s, e) + marker + value.slice(e);
    const shift = wrapped ? -marker.length : marker.length;
    change({ note });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + shift, e + shift);
    });
  };

  return (
    <div
      // Below the title bar, so the window's own buttons stay clear.
      className={cx(
        'fixed inset-x-0 top-9 bottom-0 z-40 grid place-items-center p-6',
        closing && 'pointer-events-none',
      )}
      role="dialog"
      aria-label={isNew ? 'New Reminder' : 'Edit Reminder'}
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
          <span className="font-serif text-[17px]">{isNew ? 'New Reminder' : 'Edit Reminder'}</span>
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
            <FormatBar onFormat={(mark) => wrapNote(mark)} />
            <TextArea
              ref={noteRef}
              aria-label="Note"
              placeholder="Add a note (optional). Select words, then B, I, U or S to style them."
              className="min-h-16 font-serif text-[14px]"
              value={form.note}
              onChange={(e) => change({ note: e.currentTarget.value })}
              onKeyDown={(e) => {
                if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
                const key = e.key.toLowerCase();
                const mark: RichMark | null =
                  key === 'b'
                    ? 'bold'
                    : key === 'i'
                      ? 'italic'
                      : key === 'u'
                        ? 'underline'
                        : key === 'x' && e.shiftKey
                          ? 'strike'
                          : null;
                if (!mark) return;
                e.preventDefault();
                wrapNote(mark);
              }}
            />
            {hasRich(form.note) && (
              <p className="px-1 font-serif text-[13px] leading-snug text-muted">
                <span className="mr-1.5 font-sans text-[11px] tracking-wide text-faint uppercase">
                  Preview
                </span>
                <RichText text={form.note} />
              </p>
            )}
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
            title="If I Don’t Respond"
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
                <span className="text-muted">Don’t Remind Again</span>
              )}
            </div>
          </Section>

          <Section
            title="Rotating Lines"
            hint="Optional. Each time it appears, the reminder shows the next line: stretches, affirmations, tips."
          >
            <LinesEditor lines={form.lines} onChange={(lines) => change({ lines })} />
            {form.lines.length > 1 && (
              <div className="mt-3">
                <Segmented
                  label="Line order"
                  value={form.lineOrder}
                  options={[
                    { value: 'inOrder', label: 'In Order' },
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
                { value: 'default', label: 'App Setting' },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              onChange={(sound) => change({ sound })}
            />
          </Section>

          <Section
            title="Animation"
            hint={
              form.animation === 'auto'
                ? 'Auto: the dots dance and form shapes beside the title.'
                : `${getScene(form.animation).name} · ${getScene(form.animation).category}`
            }
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-raised">
                <SmaranDots
                  size={34}
                  scene={form.animation === 'auto' ? undefined : (form.animation as SceneKey)}
                  interactive={false}
                />
              </span>
              <Segmented
                label="Notification animation"
                value={form.animation === 'auto' ? 'auto' : 'one'}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'one', label: 'One Animation' },
                ]}
                onChange={(v) =>
                  v === 'auto' ? change({ animation: 'auto' }) : setChoosingAnimation(true)
                }
              />
              <Button size="sm" onClick={() => setChoosingAnimation(true)}>
                Choose…
              </Button>
            </div>
            <AnimationBrowser
              open={choosingAnimation}
              current={form.animation === 'auto' ? null : form.animation}
              onClose={() => setChoosingAnimation(false)}
              onPick={(animation) => {
                change({ animation });
                setChoosingAnimation(false);
              }}
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
                Create Reminder
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
                title="Show It Now"
                onClick={() =>
                  void useApp.getState().track(window.smaran.reminders.showNow(form.id))
                }
              >
                <SendIcon size={15} /> Show Now
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

const FORMATS: { mark: RichMark; label: string; title: string; className: string }[] = [
  { mark: 'bold', label: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold' },
  { mark: 'italic', label: 'I', title: 'Italic (Ctrl+I)', className: 'font-serif italic' },
  { mark: 'underline', label: 'U', title: 'Underline (Ctrl+U)', className: 'underline' },
  { mark: 'strike', label: 'S', title: 'Strikethrough (Ctrl+Shift+X)', className: 'line-through' },
];

/** B / I / U / S buttons above the note. They wrap the selection in **, *, __ or ~~. */
function FormatBar({ onFormat }: { onFormat: (mark: RichMark) => void }) {
  return (
    <div className="flex items-center gap-1" role="toolbar" aria-label="Note formatting">
      {FORMATS.map((f) => (
        <button
          key={f.mark}
          type="button"
          title={f.title}
          aria-label={f.title}
          // Keep the note's selection while clicking.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormat(f.mark)}
          className={cx(
            'grid h-7 w-7 place-items-center rounded-md text-[13.5px] text-muted transition-colors duration-150 hover:bg-hover hover:text-ink',
            f.className,
          )}
        >
          {f.label}
        </button>
      ))}
      <span className="ml-1.5 text-[11.5px] text-faint">Select text in the note to style it</span>
    </div>
  );
}
