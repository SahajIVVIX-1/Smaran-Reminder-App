import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { stepsSummary, triggerSummary } from '@shared/automationSummary';
import { createAutomation, defaultAction } from '@shared/defaults';
import { separator } from '@shared/menu';
import type { Action, Automation } from '@shared/schema';
import { openContextMenu } from '../contextMenu';
import { cx } from '../cx';
import { whenLabel } from '../format';
import {
  AppIcon,
  BoltIcon,
  FileIcon,
  LinkIcon,
  LockIcon,
  PlayIcon,
  PlusIcon,
  PowerIcon,
  TerminalIcon,
} from '../icons';
import { useApp } from '../store';
import { Button, IconButton, Pill, Switch } from '../ui';

/** A new automation: daily at 23:00, lock the PC. */
function blankAutomation(): Automation {
  return createAutomation({
    name: '',
    trigger: { kind: 'schedule', rule: { kind: 'daily', times: ['23:00'] } },
    actions: [defaultAction('power')],
  });
}

/** Starting points shown while the list is short. */
const IDEAS: { label: string; make: () => Automation }[] = [
  {
    label: 'Shut down every night at 23:30',
    make: () =>
      createAutomation({
        name: 'Bedtime',
        trigger: { kind: 'schedule', rule: { kind: 'daily', times: ['23:30'] } },
        actions: [{ kind: 'power', power: 'shutdown' }],
      }),
  },
  {
    label: 'Open my apps when I sign in',
    make: () =>
      createAutomation({
        name: 'Start my day',
        trigger: { kind: 'start', when: 'signIn', delaySec: 30 },
        actions: [defaultAction('app'), defaultAction('link')],
      }),
  },
  {
    label: 'Lock the PC when I’m away 10 min',
    make: () =>
      createAutomation({
        name: 'Away lock',
        trigger: { kind: 'event', event: 'idle', idleMin: 10 },
        actions: [{ kind: 'power', power: 'lock' }],
      }),
  },
  {
    label: 'Run a backup script every Friday',
    make: () =>
      createAutomation({
        name: 'Weekly backup',
        trigger: { kind: 'schedule', rule: { kind: 'weekly', weekdays: [5], time: '18:00' } },
        actions: [defaultAction('script')],
      }),
  },
];

export function ActionIcon({ action, size = 16 }: { action: Action; size?: number }) {
  if (action.kind === 'link') return <LinkIcon size={size} />;
  if (action.kind === 'open')
    return action.what === 'script' ? (
      <TerminalIcon size={size} />
    ) : action.what === 'file' ? (
      <FileIcon size={size} />
    ) : (
      <AppIcon size={size} />
    );
  return action.power === 'lock' ? <LockIcon size={size} /> : <PowerIcon size={size} />;
}

/** Re-renders every second while something counts down. */
function useTick(on: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [on]);
}

export function Automations() {
  const config = useApp((s) => s.config);
  const next = useApp((s) => s.automationNext);
  const running = useApp((s) => s.running);
  const { editAutomation, upsertAutomation, removeAutomation, track, toastMsg } = useApp.getState();
  useTick(running.length > 0);

  if (!config) return null;
  const list = config.automations;

  const toggle = (a: Automation, enabled = !a.enabled) =>
    upsertAutomation({ ...a, enabled, updatedAt: new Date().toISOString() });
  const runNow = (a: Automation) => {
    void track(window.smaran.automations.run(a.id));
    toastMsg(`Running “${a.name}”`);
  };
  const duplicate = (a: Automation) =>
    editAutomation({
      mode: 'new',
      draft: { ...structuredClone(a), id: crypto.randomUUID(), name: `${a.name} (copy)` },
    });
  const rowMenu = (e: MouseEvent, a: Automation) =>
    openContextMenu(
      e,
      [
        { kind: 'item', id: 'edit', label: 'Edit', hint: 'Enter' },
        { kind: 'item', id: 'run', label: 'Run Now' },
        { kind: 'item', id: 'duplicate', label: 'Duplicate' },
        { kind: 'item', id: 'toggle', label: a.enabled ? 'Turn Off' : 'Turn On' },
        separator,
        { kind: 'item', id: 'delete', label: 'Delete', hint: 'Del', danger: true },
      ],
      (id) => {
        if (id === 'edit') editAutomation({ mode: 'edit', id: a.id });
        else if (id === 'run') runNow(a);
        else if (id === 'duplicate') duplicate(a);
        else if (id === 'toggle') toggle(a);
        else if (id === 'delete') removeAutomation(a.id);
      },
    );

  return (
    <div className="mx-auto max-w-[820px] px-7 pt-8 pb-16">
      <header className="flex animate-enter items-end gap-4">
        <div className="flex-1">
          <h1 className="font-serif text-[26px] leading-tight">Automations</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Lock, sleep or shut down, open apps, files and links: at a time, when you sign in, or
            when something happens on your PC.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => editAutomation({ mode: 'new', draft: blankAutomation() })}
        >
          <PlusIcon size={16} /> New Automation
        </Button>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 animate-fade text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <BoltIcon size={22} />
          </span>
          <p className="mt-3 font-serif text-[15px] text-muted italic">
            No automations yet. Start from an idea, or make your own.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2" aria-label="Automations">
          {list.map((a, i) => {
            const run = running.find((r) => r.automationId === a.id);
            const at = next.find((n) => n.automationId === a.id)?.at;
            const first = a.steps[0]?.action;
            return (
              <li
                key={a.id}
                className="animate-enter"
                style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => editAutomation({ mode: 'edit', id: a.id })}
                  onContextMenu={(e) => rowMenu(e, a)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter') editAutomation({ mode: 'edit', id: a.id });
                    else if (e.key === 'Delete') removeAutomation(a.id);
                  }}
                  className={cx(
                    'group flex cursor-pointer items-center gap-3.5 rounded-xl border border-line bg-surface px-3.5 py-2.5',
                    'transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-px hover:border-ink/15 hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.15)]',
                    'focus-visible:outline-2 focus-visible:outline-accent',
                  )}
                >
                  <span
                    className={cx(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent',
                      !a.enabled && 'opacity-45',
                    )}
                  >
                    {first ? <ActionIcon action={first} /> : <BoltIcon size={16} />}
                  </span>
                  <div className={cx('min-w-0 flex-1', !a.enabled && 'opacity-55')}>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium">{a.name}</span>
                      {run && <Pill tone="accent">{runLabel(run.state, run.until)}</Pill>}
                      {a.steps.length > 1 && <Pill>{a.steps.length} steps</Pill>}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">
                      {triggerSummary(a.trigger)} → {stepsSummary(a)}
                      {a.enabled && at && ` · next ${whenLabel(new Date(at))}`}
                    </div>
                  </div>
                  {run ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        void window.smaran.automations.cancel(a.id);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <IconButton
                      aria-label={`Run ${a.name} now`}
                      title="Run Now"
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        runNow(a);
                      }}
                    >
                      <PlayIcon size={14} />
                    </IconButton>
                  )}
                  <Switch
                    label={`${a.enabled ? 'Turn Off' : 'Turn On'} ${a.name}`}
                    checked={a.enabled}
                    onChange={(enabled) => toggle(a, enabled)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {list.length < 4 && (
        <section className="mt-8 animate-enter [animation-delay:60ms]">
          <h2 className="mb-2 text-[12.5px] font-medium text-muted">Ideas</h2>
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <Idea
                key={idea.label}
                onClick={() => editAutomation({ mode: 'new', draft: idea.make() })}
              >
                {idea.label}
              </Idea>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 font-serif text-[13px] leading-snug text-faint italic">
        Automations run while Smaran is running, so turn on “Start when I sign in” in Settings.
        Nothing runs before you sign in to Windows.
      </p>
    </div>
  );
}

function runLabel(state: 'running' | 'waiting' | 'countdown', until: string | null): string {
  const left = until ? Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000)) : 0;
  if (state === 'countdown') return `Starts in ${left} s`;
  if (state === 'waiting') return `Waiting ${left} s`;
  return 'Running';
}

function Idea({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] text-ink transition-colors duration-150 hover:border-accent/40 hover:bg-accent-soft"
    >
      <PlusIcon size={13} className="text-accent" />
      {children}
    </button>
  );
}
