import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { hasRich, plainRich, RICH_MARKERS, type RichMark } from '@shared/richText';
import { ruleSummary } from '@shared/ruleSummary';
import {
  CARD_WIDTH,
  COLORS,
  DEFAULT_NOTIFICATION_MOTION,
  ReminderSchema,
  type Reminder,
} from '@shared/schema';
import { tabVariants } from '../animations';
import { COLOR_BG, COLOR_NAME } from '../../colors';
import { cx } from '../cx';
import { useExit } from '../useExit';
import { whenLabel } from '../format';
import {
  BellIcon,
  ClockIcon,
  CopyIcon,
  FileIcon,
  SendIcon,
  SparkIcon,
  TrashIcon,
  XIcon,
} from '../icons';
import { useApp } from '../store';
import { Button, IconButton, Input, NumberField, Segmented, Switch, TextArea } from '../ui';
import { getScene, type SceneKey } from '@shared/dots/dotsScenes';
import { SmaranDots } from '../../dots';
import { RichText } from '../../RichText';
import { CardPreview, CardShape } from './CardShape';
import { NotificationMotionSettings } from './NotificationMotionSettings';
import { Select } from './Select';
import { AnimationBrowser } from './LogoSettings';
import { ScheduleEditor } from './ScheduleEditor';

type ReminderTab = 'details' | 'timing' | 'notification' | 'lines';

interface ReminderTabItem {
  id: ReminderTab;
  label: string;
  icon: (props: { size?: number; className?: string }) => ReactNode;
}

const REMINDER_TABS: readonly ReminderTabItem[] = [
  { id: 'details', label: 'Details', icon: FileIcon },
  { id: 'timing', label: 'Timing', icon: ClockIcon },
  { id: 'notification', label: 'Notification', icon: BellIcon },
  { id: 'lines', label: 'Lines', icon: SparkIcon },
];

const STAY_PRESETS = [5, 8, 12, 20, 30, 60, 120];

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
    <section className="border-t border-line px-5 py-4 first:border-t-0">
      <h3 className="font-serif text-[15px] font-semibold">{title}</h3>
      {hint && (
        <p className="mt-0.5 font-serif text-[13px] leading-snug text-muted italic">{hint}</p>
      )}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** Popup to create or edit one reminder. Organized into focused tabs with live notification previews. */
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
  const [tab, setTab] = useState<ReminderTab>('details');
  const [customHideSec, setCustomHideSec] = useState(
    () =>
      source?.hideAfterSec !== null &&
      source?.hideAfterSec !== undefined &&
      source?.hideAfterSec > 0 &&
      !STAY_PRESETS.includes(source.hideAfterSec),
  );

  if (source && formFor !== source.id) {
    setFormFor(source.id);
    setForm(source);
    setTab('details');
    setCustomHideSec(
      source.hideAfterSec !== null &&
        source.hideAfterSec > 0 &&
        !STAY_PRESETS.includes(source.hideAfterSec),
    );
  }

  const title = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // The B / I / U / S buttons style whichever of title or note was used last.
  const lastField = useRef<'title' | 'note'>('note');

  useEffect(() => {
    if (editing?.mode === 'new' && tab === 'details') title.current?.focus();
  }, [editing?.mode, formFor, tab]);

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

  /** Wraps the selected title or note text in a style's markers, or unwraps it if already styled. */
  const wrap = (mark: RichMark) => {
    const field = lastField.current;
    const el = field === 'title' ? title.current : noteRef.current;
    if (!el) return;
    const marker = RICH_MARKERS[mark];
    const { value } = el;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? s;
    const wrapped =
      value.slice(Math.max(0, s - marker.length), s) === marker &&
      value.slice(e, e + marker.length) === marker &&
      // Inside **bold**, a single * either side is bold's, not italic's.
      !(mark === 'italic' && (value[s - 2] === '*' || value[e + 1] === '*'));
    const text = wrapped
      ? value.slice(0, s - marker.length) + value.slice(s, e) + value.slice(e + marker.length)
      : value.slice(0, s) + marker + value.slice(s, e) + marker + value.slice(e);
    const shift = wrapped ? -marker.length : marker.length;
    change(field === 'title' ? { title: text } : { note: text });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + shift, e + shift);
    });
  };

  /** Ctrl+B / I / U and Ctrl+Shift+X style the selection in the title or the note. */
  const formatKeys = (e: ReactKeyboardEvent<HTMLElement>) => {
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
    wrap(mark);
  };

  const handleTabKeyDown = (e: ReactKeyboardEvent) => {
    const currentIndex = REMINDER_TABS.findIndex((t) => t.id === tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextTab = REMINDER_TABS[(currentIndex + 1) % REMINDER_TABS.length];
      if (nextTab) setTab(nextTab.id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevTab =
        REMINDER_TABS[(currentIndex - 1 + REMINDER_TABS.length) % REMINDER_TABS.length];
      if (prevTab) setTab(prevTab.id);
    }
  };

  const stayMode: 'default' | 'permanent' | 'custom' =
    form.hideAfterSec === null ? 'default' : form.hideAfterSec === 0 ? 'permanent' : 'custom';

  const activeCard = form.card ?? config?.settings.notification.card ?? {
    width: null,
    height: null,
    radius: null,
    padding: null,
  };
  const activeMotion =
    form.motion ?? config?.settings.notification.motion ?? DEFAULT_NOTIFICATION_MOTION;
  const presetWidth = config
    ? CARD_WIDTH[config.settings.notification.size]
    : CARD_WIDTH.comfortable;

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
          'relative flex max-h-full w-[620px] max-w-full flex-col overflow-hidden rounded-2xl border border-line bg-sheet shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl',
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

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label="Reminder sections"
          onKeyDown={handleTabKeyDown}
          className="flex items-center gap-1 border-b border-line bg-raised/50 px-4 py-1.5"
        >
          {REMINDER_TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const isLines = t.id === 'lines';
            const linesCount = form.lines.length;
            const hasError = t.id === 'details' && errors.length > 0;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                id={`reminder-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`reminder-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cx(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-2.5 text-[12.5px] font-medium transition-all duration-150 whitespace-nowrap',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                  active
                    ? 'bg-surface text-ink shadow-sm ring-1 ring-line'
                    : 'text-muted hover:bg-hover/60 hover:text-ink',
                )}
              >
                <Icon size={14} className={active ? 'text-accent' : 'text-faint'} />
                <span>{t.label}</span>
                {isLines && linesCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-accent/15 px-1.5 py-0.2 text-[10px] font-semibold text-accent">
                    {linesCount}
                  </span>
                )}
                {hasError && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              role="tabpanel"
              id={`reminder-panel-${tab}`}
              aria-labelledby={`reminder-tab-${tab}`}
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
          {/* Tab 1: Details (Title, Note, Schedule, Colour) */}
          {tab === 'details' && (
            <div>
              <div className="space-y-2.5 px-5 pt-4 pb-4">
                <Input
                  ref={title}
                  aria-label="Title"
                  placeholder="What should Smaran remind you about?"
                  className="h-10 text-[14px] font-medium"
                  value={form.title}
                  onChange={(e) => change({ title: e.currentTarget.value })}
                  onFocus={() => (lastField.current = 'title')}
                  onKeyDown={formatKeys}
                />
                {hasRich(form.title) && (
                  <p className="px-1 text-[14px] font-medium">
                    <span className="mr-1.5 text-[11px] font-normal tracking-wide text-faint uppercase">
                      Title
                    </span>
                    <RichText text={form.title} />
                  </p>
                )}
                <FormatBar onFormat={(mark) => wrap(mark)} />
                <TextArea
                  ref={noteRef}
                  aria-label="Note"
                  placeholder="Add a note (optional). Select words, then B, I, U or S to style them."
                  className="min-h-16 font-serif text-[14px]"
                  value={form.note}
                  onChange={(e) => change({ note: e.currentTarget.value })}
                  onFocus={() => (lastField.current = 'note')}
                  onKeyDown={formatKeys}
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
          )}

          {/* Tab 2: Timing (Stay on screen, Priority, Follow-up) */}
          {tab === 'timing' && (
            <div>
              <Section
                title="Stay on Screen"
                hint={
                  form.priority === 'important'
                    ? 'Important reminders stay until you act.'
                    : stayMode === 'default'
                      ? `Uses the app setting (currently ${
                          config?.settings.notification.hideAfterSec === null
                            ? 'Permanent'
                            : `${config?.settings.notification.hideAfterSec} seconds`
                        }).`
                      : stayMode === 'permanent'
                        ? 'Stays on screen until you click Dismiss, Snooze, or Done.'
                        : `Hides itself automatically after ${form.hideAfterSec} seconds.`
                }
              >
                {form.priority === 'important' ? (
                  <p className="text-[13px] text-muted">
                    Important reminders always stay on screen until you act, and bypass quiet hours
                    and full-screen apps.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <Segmented<'default' | 'permanent' | 'custom'>
                      label="Stay on screen mode"
                      value={stayMode}
                      options={[
                        { value: 'default', label: 'App Setting' },
                        { value: 'permanent', label: 'Permanent' },
                        { value: 'custom', label: 'Custom Seconds' },
                      ]}
                      onChange={(mode) => {
                        if (mode === 'default') {
                          change({ hideAfterSec: null });
                        } else if (mode === 'permanent') {
                          change({ hideAfterSec: 0 });
                        } else {
                          change({
                            hideAfterSec:
                              form.hideAfterSec && form.hideAfterSec > 0 ? form.hideAfterSec : 20,
                          });
                        }
                      }}
                    />
                    {stayMode === 'custom' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Select<number>
                          id="rem-hide"
                          className="w-36"
                          value={
                            customHideSec || !STAY_PRESETS.includes(form.hideAfterSec ?? 20)
                              ? -1
                              : (form.hideAfterSec ?? 20)
                          }
                          options={[
                            { value: 5, label: '5 seconds' },
                            { value: 8, label: '8 seconds' },
                            { value: 12, label: '12 seconds' },
                            { value: 20, label: '20 seconds' },
                            { value: 30, label: '30 seconds' },
                            { value: 60, label: '1 minute' },
                            { value: 120, label: '2 minutes' },
                            { value: -1, label: 'Custom…' },
                          ]}
                          onChange={(sec) => {
                            if (sec === -1) {
                              setCustomHideSec(true);
                            } else {
                              setCustomHideSec(false);
                              change({ hideAfterSec: sec });
                            }
                          }}
                        />
                        {(customHideSec || !STAY_PRESETS.includes(form.hideAfterSec ?? 20)) && (
                          <NumberField
                            label="Seconds on screen"
                            value={form.hideAfterSec && form.hideAfterSec > 0 ? form.hideAfterSec : 20}
                            min={3}
                            max={600}
                            suffix="seconds"
                            onChange={(n) => change({ hideAfterSec: n })}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Section>

              <Section
                title="Priority"
                hint={
                  form.priority === 'important'
                    ? 'Stays on screen until you act, comes through quiet hours and full-screen apps.'
                    : 'Waits during quiet hours and full-screen apps.'
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
                        onChange={(everyMin) =>
                          change({ followUp: { ...form.followUp, everyMin } })
                        }
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
            </div>
          )}

          {/* Tab 3: Notification (Shape, Motion & Fade, Sound, Animation) */}
          {tab === 'notification' && (
            <div>
              <Section
                title="Attention Motion & Fade"
                hint={
                  form.motion
                    ? 'This reminder has its own motion and fade effect.'
                    : 'Uses the attention motion from Settings.'
                }
              >
                <label className="flex items-center gap-2.5 text-[13px]">
                  <Switch
                    label="Use motion from Settings"
                    checked={!form.motion}
                    onChange={(useDefault) => {
                      if (useDefault) change({ motion: undefined });
                      else if (config) {
                        change({
                          motion: {
                            ...(config.settings.notification.motion ?? DEFAULT_NOTIFICATION_MOTION),
                          },
                        });
                      }
                    }}
                  />
                  Use motion from Settings
                </label>
                {form.motion && (
                  <div className="mt-3">
                    <NotificationMotionSettings
                      motion={form.motion}
                      onChange={(motion) => change({ motion })}
                    />
                  </div>
                )}
              </Section>

              <Section
                title="Notification Shape"
                hint={
                  form.card
                    ? 'This reminder’s card has its own width, height and corners.'
                    : 'Uses the card shape from Settings.'
                }
              >
                <label className="flex items-center gap-2.5 text-[13px]">
                  <Switch
                    label="Use the shape from Settings"
                    checked={!form.card}
                    onChange={(useDefault) => {
                      if (useDefault) change({ card: undefined });
                      else if (config) {
                        change({ card: { ...config.settings.notification.card } });
                      }
                    }}
                  />
                  Use the shape from Settings
                </label>
                {form.card && config && (
                  <div className="mt-2">
                    <CardShape
                      n={{
                        ...config.settings.notification,
                        card: form.card,
                        motion: form.motion ?? config.settings.notification.motion,
                      }}
                      onChange={(card) => change({ card })}
                    />
                  </div>
                )}
              </Section>

              <div className="border-t border-line px-5 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-medium">Card Preview</span>
                    <span className="ml-2 text-[12px] text-muted">Hover to see it expand</span>
                  </div>
                </div>
                <CardPreview
                  customWidth={activeCard.width}
                  presetWidth={presetWidth}
                  customHeight={activeCard.height}
                  customRadius={activeCard.radius}
                  customPadding={activeCard.padding ?? null}
                  motion={activeMotion}
                />
              </div>

              <Section
                title="Sound"
                hint={
                  form.sound === 'default'
                    ? `Follows the app setting (currently ${
                        config?.settings.notification.sound ? 'on' : 'off'
                      }).`
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
            </div>
          )}

          {/* Tab 4: Lines (Rotating Lines) */}
          {tab === 'lines' && (
            <div className="pt-2">
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
            </div>
          )}
            </motion.div>
          </AnimatePresence>
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
                  toastMsg(`Added “${plainRich(parsed.data.title)}”`);
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

/** B / I / U / S buttons. They wrap the title or note selection in **, *, __ or ~~. */
function FormatBar({ onFormat }: { onFormat: (mark: RichMark) => void }) {
  return (
    <div className="flex items-center gap-1" role="toolbar" aria-label="Text formatting">
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
      <span className="ml-1.5 text-[11.5px] text-faint">
        Select text in the title or note to style it
      </span>
    </div>
  );
}
