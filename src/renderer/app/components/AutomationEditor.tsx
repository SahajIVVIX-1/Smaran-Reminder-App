import { useEffect, useRef, useState, type ReactNode } from 'react';
import { baseName, EVENT_LABEL, START_LABEL, triggerSummary } from '@shared/automationSummary';
import { defaultAction } from '@shared/defaults';
import type { Browser } from '@shared/ipc';
import {
  AutomationSchema,
  isDisruptive,
  WINDOWS_EVENTS,
  type Action,
  type Automation,
  type Step,
  type Trigger,
} from '@shared/schema';
import { cx } from '../cx';
import { whenLabel } from '../format';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from '../icons';
import { ActionIcon } from '../pages/Automations';
import { useApp } from '../store';
import { useExit } from '../useExit';
import { Button, IconButton, Input, NumberField, Segmented, Switch } from '../ui';
import { ScheduleEditor } from './ScheduleEditor';
import { Select } from './Select';

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

const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
    <span className="w-20 shrink-0 text-[13px] text-muted">{label}</span>
    {children}
  </div>
);

// ---------- trigger ----------

const TRIGGER_KINDS = [
  { value: 'schedule', label: 'At a Time' },
  { value: 'start', label: 'Startup & Sign-in' },
  { value: 'event', label: 'Windows Event' },
] as const;

function defaultTrigger(kind: Trigger['kind']): Trigger {
  switch (kind) {
    case 'schedule':
      return { kind, rule: { kind: 'daily', times: ['23:00'] } };
    case 'start':
      return { kind, when: 'signIn', delaySec: 0 };
    case 'event':
      return { kind, event: 'lock', idleMin: 10 };
  }
}

function TriggerEditor({
  trigger,
  onChange,
  startAtLogin,
}: {
  trigger: Trigger;
  onChange: (t: Trigger) => void;
  startAtLogin: boolean;
}) {
  return (
    <div className="space-y-3">
      <Segmented
        label="Trigger"
        value={trigger.kind}
        options={TRIGGER_KINDS}
        onChange={(kind) => kind !== trigger.kind && onChange(defaultTrigger(kind))}
      />
      <div key={trigger.kind} className="animate-enter space-y-3">
        {trigger.kind === 'schedule' && (
          <ScheduleEditor rule={trigger.rule} onChange={(rule) => onChange({ ...trigger, rule })} />
        )}
        {trigger.kind === 'start' && (
          <>
            <Line label="When">
              <Select
                aria-label="When"
                className="w-64"
                value={trigger.when}
                options={(['boot', 'signIn', 'smaran'] as const).map((w) => ({
                  value: w,
                  label: START_LABEL[w],
                }))}
                onChange={(when) => onChange({ ...trigger, when })}
              />
            </Line>
            <Line label="Wait">
              <NumberField
                label="Seconds to wait"
                value={trigger.delaySec}
                min={0}
                max={3600}
                suffix="seconds first"
                onChange={(delaySec) => onChange({ ...trigger, delaySec })}
              />
            </Line>
            {trigger.when !== 'smaran' && !startAtLogin && (
              <p className="text-[12.5px] text-danger">
                Turn on “Start When I Sign In” in Settings, or this never runs.
              </p>
            )}
          </>
        )}
        {trigger.kind === 'event' && (
          <>
            <Line label="When">
              <Select
                aria-label="Windows event"
                className="w-72"
                value={trigger.event}
                options={WINDOWS_EVENTS.map((e) => ({ value: e, label: EVENT_LABEL[e] }))}
                onChange={(event) => onChange({ ...trigger, event })}
              />
            </Line>
            {(trigger.event === 'idle' || trigger.event === 'active') && (
              <Line label="Away for">
                <NumberField
                  label="Minutes away"
                  value={trigger.idleMin}
                  min={1}
                  max={240}
                  suffix="minutes (no mouse or keyboard)"
                  onChange={(idleMin) => onChange({ ...trigger, idleMin })}
                />
              </Line>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- actions ----------

type UiKind =
  | 'lock'
  | 'signOut'
  | 'sleep'
  | 'hibernate'
  | 'shutdown'
  | 'restart'
  | 'app'
  | 'file'
  | 'script'
  | 'link';

const ACTION_KINDS: { value: UiKind; label: string }[] = [
  { value: 'app', label: 'Open an app' },
  { value: 'file', label: 'Open a file' },
  { value: 'script', label: 'Run a script (.bat, .cmd, .ps1)' },
  { value: 'link', label: 'Open a link' },
  { value: 'lock', label: 'Lock the PC' },
  { value: 'signOut', label: 'Sign out' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'hibernate', label: 'Hibernate' },
  { value: 'shutdown', label: 'Shut down' },
  { value: 'restart', label: 'Restart' },
];

function uiKind(action: Action): UiKind {
  if (action.kind === 'power') return action.power;
  if (action.kind === 'open') return action.what;
  return 'link';
}

function actionFor(kind: UiKind, previous: Action): Action {
  if (kind === 'app' || kind === 'file' || kind === 'script') {
    // Switching between app, file and script keeps the chosen path.
    return previous.kind === 'open' ? { ...previous, what: kind } : defaultAction(kind);
  }
  if (kind === 'link') return defaultAction('link');
  return { kind: 'power', power: kind };
}

let browserCache: Promise<Browser[]> | null = null;

function useBrowsers(): Browser[] {
  const [browsers, setBrowsers] = useState<Browser[]>([]);
  useEffect(() => {
    browserCache ??= window.smaran.automations.browsers().catch(() => []);
    let live = true;
    void browserCache.then((b) => live && setBrowsers(b));
    return () => {
      live = false;
    };
  }, []);
  return browsers;
}

const PICK_LABEL = { app: 'Choose App…', file: 'Choose File…', script: 'Choose Script…' } as const;
const PATH_PLACEHOLDER = {
  app: 'C:\\Program Files\\…\\app.exe',
  file: 'C:\\Users\\…\\Documents\\notes.pdf',
  script: 'C:\\Scripts\\backup.bat',
} as const;

function ActionFields({ action, onChange }: { action: Action; onChange: (a: Action) => void }) {
  const browsers = useBrowsers();
  if (action.kind === 'power') {
    const text: Record<typeof action.power, string> = {
      lock: 'Locks the screen. Everything keeps running.',
      signOut: 'Closes your apps and signs you out of Windows. Unsaved work is lost.',
      sleep: 'Puts the PC to sleep.',
      hibernate: 'Saves everything to disk and powers off (if hibernation is on in Windows).',
      shutdown: 'Turns the PC off. Unsaved work is lost.',
      restart: 'Restarts the PC. Unsaved work is lost.',
    };
    return <p className="text-[12.5px] text-muted">{text[action.power]}</p>;
  }
  if (action.kind === 'open') {
    const what = action.what;
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            aria-label="Path"
            placeholder={PATH_PLACEHOLDER[what]}
            className="font-mono text-[12px]"
            value={action.path}
            onChange={(e) => onChange({ ...action, path: e.currentTarget.value })}
          />
          <Button
            onClick={() =>
              void window.smaran.automations.pick(what).then((path) => {
                if (path) onChange({ ...action, path });
              })
            }
          >
            {PICK_LABEL[what]}
          </Button>
        </div>
        {what !== 'file' && (
          <Input
            aria-label="Arguments"
            placeholder="Arguments (optional), e.g. --profile work"
            className="font-mono text-[12px]"
            value={action.args}
            onChange={(e) => onChange({ ...action, args: e.currentTarget.value })}
          />
        )}
        {what === 'script' && (
          <label className="flex items-center gap-2.5 text-[13px] text-muted">
            <Switch
              label="Run without a window"
              checked={action.hidden}
              onChange={(hidden) => onChange({ ...action, hidden })}
            />
            Run without a console window
          </label>
        )}
      </div>
    );
  }
  const known = browsers.some((b) => b.path === action.browser);
  const options = [
    { value: '', label: 'Default browser' },
    ...browsers.map((b) => ({ value: b.path, label: b.name })),
    ...(action.browser && !known
      ? [{ value: action.browser, label: baseName(action.browser) }]
      : []),
    { value: '__other', label: 'Other browser…' },
  ];
  return (
    <div className="space-y-2">
      <Input
        aria-label="Link"
        placeholder="https://example.com"
        value={action.url}
        onChange={(e) => onChange({ ...action, url: e.currentTarget.value })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Browser"
          className="w-56"
          value={action.browser}
          options={options}
          onChange={(browser) => {
            if (browser !== '__other') {
              onChange({ ...action, browser, private: browser ? action.private : false });
              return;
            }
            void window.smaran.automations.pick('browser').then((path) => {
              if (path) onChange({ ...action, browser: path });
            });
          }}
        />
        {action.browser && (
          <label className="flex items-center gap-2.5 text-[13px] text-muted">
            <Switch
              label="Private window"
              checked={action.private}
              onChange={(on) => onChange({ ...action, private: on })}
            />
            Private window
          </label>
        )}
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  step: Step;
  index: number;
  count: number;
  onChange: (s: Step) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-raised/60 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <ActionIcon action={step.action} size={15} />
        </span>
        <Select
          aria-label={`Action ${index + 1}`}
          className="w-64"
          value={uiKind(step.action)}
          options={ACTION_KINDS}
          onChange={(kind) => onChange({ ...step, action: actionFor(kind, step.action) })}
        />
        <span className="flex-1" />
        <IconButton
          aria-label="Move up"
          disabled={index === 0}
          className="disabled:opacity-30"
          onClick={() => onMove(-1)}
        >
          <ArrowUpIcon size={14} />
        </IconButton>
        <IconButton
          aria-label="Move down"
          disabled={index === count - 1}
          className="disabled:opacity-30"
          onClick={() => onMove(1)}
        >
          <ArrowDownIcon size={14} />
        </IconButton>
        <IconButton
          aria-label={`Remove action ${index + 1}`}
          disabled={count === 1}
          className="disabled:opacity-30"
          onClick={onRemove}
        >
          <XIcon size={14} />
        </IconButton>
      </div>
      <div className="mt-2.5 pl-9">
        <ActionFields action={step.action} onChange={(action) => onChange({ ...step, action })} />
        <div className="mt-2.5 flex items-center gap-2 text-[13px] text-muted">
          <span>Wait</span>
          <NumberField
            label="Seconds to wait first"
            value={step.waitSec}
            min={0}
            max={3600}
            suffix={index === 0 ? 'seconds before this' : 'seconds after the step above'}
            onChange={(waitSec) => onChange({ ...step, waitSec })}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- editor ----------

/** Popup to create or edit one automation. Edits to an existing one save as you type. */
export function AutomationEditor() {
  const editing = useApp((s) => s.editingAutomation);
  const config = useApp((s) => s.config);
  const next = useApp((s) => s.automationNext);
  const { editAutomation, upsertAutomation, removeAutomation, toastMsg, track } = useApp.getState();

  const source =
    editing?.mode === 'new'
      ? editing.draft
      : editing?.mode === 'edit'
        ? config?.automations.find((a) => a.id === editing.id)
        : undefined;

  const [form, setForm] = useState<Automation | null>(source ?? null);
  const [formFor, setFormFor] = useState(source?.id);
  if (source && formFor !== source.id) {
    setFormFor(source.id);
    setForm(source);
  }
  const name = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing?.mode === 'new') name.current?.focus();
  }, [editing?.mode, formFor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && editAutomation(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editAutomation]);

  const { mounted, closing } = useExit(editing !== null, 190);
  const [lastMode, setLastMode] = useState<'new' | 'edit'>('edit');
  if (editing && editing.mode !== lastMode) setLastMode(editing.mode);
  if (!mounted || !form || !config) return null;
  const isNew = lastMode === 'new';
  const parsed = AutomationSchema.safeParse(form);
  const errors = parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  const at = next.find((n) => n.automationId === form.id)?.at;
  const disruptive = form.steps.some((s) => isDisruptive(s.action));

  const change = (patch: Partial<Automation>) => {
    const updated = { ...form, ...patch, updatedAt: new Date().toISOString() };
    setForm(updated);
    if (!isNew) {
      const valid = AutomationSchema.safeParse(updated);
      if (valid.success) upsertAutomation(valid.data);
    }
  };
  const setStep = (i: number, step: Step) =>
    change({ steps: form.steps.map((s, j) => (j === i ? step : s)) });
  const moveStep = (i: number, by: -1 | 1) => {
    const steps = [...form.steps];
    const [moved] = steps.splice(i, 1);
    if (!moved) return;
    steps.splice(i + by, 0, moved);
    change({ steps });
  };

  return (
    <div
      className={cx(
        'fixed inset-x-0 top-9 bottom-0 z-40 grid place-items-center p-6',
        closing && 'pointer-events-none',
      )}
      role="dialog"
      aria-label={isNew ? 'New Automation' : 'Edit Automation'}
    >
      <button
        type="button"
        aria-label="Close"
        className={cx(
          'absolute inset-0 bg-black/30 backdrop-blur-[2px]',
          closing ? 'animate-fade-out' : 'animate-fade',
        )}
        onClick={() => editAutomation(null)}
      />
      <aside
        className={cx(
          'relative flex max-h-full w-[640px] max-w-full flex-col overflow-hidden rounded-2xl border border-line bg-sheet shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl',
          closing ? 'animate-modal-out' : 'animate-modal',
        )}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-5">
          <span className="font-serif text-[17px]">
            {isNew ? 'New Automation' : 'Edit Automation'}
          </span>
          {!isNew && (
            <span className="text-[12.5px] text-muted">
              {form.enabled ? (at ? `· next ${whenLabel(new Date(at))}` : '') : '· off'}
            </span>
          )}
          <IconButton
            className="ml-auto"
            aria-label="Close panel"
            onClick={() => editAutomation(null)}
          >
            <XIcon size={16} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <div className="px-5 pt-4 pb-4">
            <Input
              ref={name}
              aria-label="Name"
              placeholder="Name it, e.g. Bedtime or Start my day"
              className="h-10 text-[14px] font-medium"
              value={form.name}
              onChange={(e) => change({ name: e.currentTarget.value })}
            />
          </div>

          <Section title="When" hint={triggerSummary(form.trigger)}>
            <TriggerEditor
              trigger={form.trigger}
              onChange={(trigger) => change({ trigger })}
              startAtLogin={config.settings.startAtLogin}
            />
          </Section>

          <Section title="Do" hint="Steps run in order, top to bottom.">
            <div className="space-y-2">
              {form.steps.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  index={i}
                  count={form.steps.length}
                  onChange={(s) => setStep(i, s)}
                  onMove={(by) => moveStep(i, by)}
                  onRemove={() => change({ steps: form.steps.filter((_, j) => j !== i) })}
                />
              ))}
            </div>
            {form.steps.length < 20 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() =>
                  change({ steps: [...form.steps, { action: defaultAction('app'), waitSec: 0 }] })
                }
              >
                <PlusIcon size={14} /> Add Step
              </Button>
            )}
          </Section>

          {disruptive && (
            <Section
              title="Before It Signs Out, Sleeps or Shuts Down"
              hint="A Smaran card counts down first, with a Cancel button."
            >
              <div className="flex flex-wrap items-center gap-3 text-[13px]">
                <Switch
                  label="Warn first"
                  checked={form.warnSec > 0}
                  onChange={(on) => change({ warnSec: on ? 30 : 0 })}
                />
                {form.warnSec > 0 ? (
                  <>
                    <span className="text-muted">Count down for</span>
                    <NumberField
                      label="Seconds"
                      value={form.warnSec}
                      min={5}
                      max={600}
                      suffix="seconds"
                      onChange={(warnSec) => change({ warnSec })}
                    />
                  </>
                ) : (
                  <span className="text-danger">No warning: it happens straight away.</span>
                )}
              </div>
            </Section>
          )}

          <Section
            title="Pause & Quiet Hours"
            hint={
              form.respectPause
                ? 'Skipped while reminders are paused and during quiet hours.'
                : 'Runs even while reminders are paused or in quiet hours.'
            }
          >
            <label className="flex items-center gap-2.5 text-[13px]">
              <Switch
                label="Follow pause and quiet hours"
                checked={form.respectPause}
                onChange={(respectPause) => change({ respectPause })}
              />
              Follow pause and quiet hours
            </label>
          </Section>
        </div>

        <footer className="flex shrink-0 items-center gap-1.5 border-t border-line px-5 py-2.5">
          {errors.length > 0 && (
            <span className="mr-auto truncate text-[12.5px] text-danger">{errors[0]}</span>
          )}
          {isNew ? (
            <>
              <span className="flex-1" />
              <Button variant="ghost" onClick={() => editAutomation(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!parsed.success}
                onClick={() => {
                  if (!parsed.success) return;
                  upsertAutomation(parsed.data);
                  editAutomation(null);
                  toastMsg(`Added “${parsed.data.name}”`);
                }}
              >
                Create Automation
              </Button>
            </>
          ) : (
            <>
              {errors.length === 0 && (
                <span className="mr-auto flex items-center gap-2 text-[12.5px] text-muted">
                  <Switch
                    label="Automation on"
                    checked={form.enabled}
                    onChange={(enabled) => change({ enabled })}
                  />
                  {form.enabled ? 'On' : 'Off'}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={!parsed.success}
                onClick={() => {
                  void track(window.smaran.automations.run(form.id));
                  toastMsg(`Running “${form.name}”`);
                }}
              >
                <PlayIcon size={14} /> Run Now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editAutomation({
                    mode: 'new',
                    draft: {
                      ...structuredClone(form),
                      id: crypto.randomUUID(),
                      name: `${form.name} (copy)`,
                    },
                  })
                }
              >
                <CopyIcon size={15} /> Duplicate
              </Button>
              <Button variant="danger" size="sm" onClick={() => removeAutomation(form.id)}>
                <TrashIcon size={15} /> Delete
              </Button>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}
