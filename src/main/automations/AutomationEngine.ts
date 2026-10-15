import { format } from 'date-fns';
import { actionSummary, POWER_SOON, seconds } from '@shared/automationSummary';
import type { NewId } from '@shared/defaults';
import type { AutomationNext, AutomationRun, NotificationAction } from '@shared/ipc';
import { nextFireAt } from '@shared/nextFireAt';
import {
  isDisruptive,
  type Action,
  type Automation,
  type Config,
  type HistoryEntry,
  type Id,
  type Outcome,
  type WindowsEvent,
} from '@shared/schema';
import { inWindow } from '@shared/time';
import { isPaused, LATE_MS, MAX_TIMER_MS, type Notifier } from '../engine/Engine';

export interface AutomationDeps {
  store: { get(): Config };
  history: { add(entry: HistoryEntry): void; flush(): void };
  notifier: Notifier;
  /** Runs one action; throws an Error with a plain-English message. */
  run(action: Action): Promise<void>;
  /** Seconds since the last keyboard or mouse input. */
  idleSeconds(): number;
  now?: () => Date;
  newId?: NewId;
}

/** How Smaran was started, for the 'start' triggers. */
export interface Launch {
  /** Started by Windows at sign-in. */
  signIn: boolean;
  /** …and the PC itself started only a few minutes before. */
  boot: boolean;
}

/** How often idle time is read while any automation waits for 'idle' or 'active'. */
export const IDLE_POLL_MS = 15_000;
/** Back after being away: input within this many seconds. */
const ACTIVE_WITHIN_SEC = 20;
/** Key prefix of the Cancel cards, so SmaranApp can route their buttons here. */
export const CARD_PREFIX = 'auto-';

interface Run {
  automation: Automation;
  state: AutomationRun['state'];
  until: Date | null;
  cancelled: boolean;
  /** Ends the current wait early (cancel). */
  wake: (() => void) | null;
  /** Answers the Cancel card: true = go ahead. */
  decide: ((go: boolean) => void) | null;
  cardKey: string | null;
}

/**
 * Runs automations: on a schedule (one timer to the earliest, like the reminder engine), when
 * Smaran starts, and on Windows events SmaranApp passes in. Free of Electron so it can be tested.
 */
export class AutomationEngine {
  private readonly due = new Map<Id, { at: Date | null; key: string }>();
  private readonly runs = new Map<Id, Run>();
  private readonly startTimers = new Set<ReturnType<typeof setTimeout>>();
  /** Idle automations that already ran during this stretch away; 'active' ones armed by one. */
  private readonly idleFired = new Set<Id>();
  private readonly activeArmed = new Set<Id>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private onRuns: (runs: AutomationRun[]) => void = () => undefined;
  private readonly now: () => Date;
  private readonly newId: NewId;

  constructor(private readonly deps: AutomationDeps) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  // ---------- lifecycle ----------

  start(launch: Launch): void {
    for (const a of this.deps.store.get().automations) {
      this.due.set(a.id, { at: null, key: keyOf(a) });
      if (!a.enabled) continue;
      this.schedule(a);
      const { trigger } = a;
      if (trigger.kind !== 'start') continue;
      const fires =
        trigger.when === 'smaran' ||
        (trigger.when === 'signIn' && launch.signIn) ||
        (trigger.when === 'boot' && launch.boot);
      if (!fires) continue;
      const timer = setTimeout(() => {
        this.startTimers.delete(timer);
        const fresh = this.find(a.id);
        if (fresh?.enabled && fresh.trigger.kind === 'start') this.fire(fresh, 'Smaran started');
      }, trigger.delaySec * 1000);
      this.startTimers.add(timer);
    }
    this.arm();
    this.watchIdle();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.idleTimer) clearInterval(this.idleTimer);
    for (const t of this.startTimers) clearTimeout(t);
    this.timer = this.idleTimer = null;
    this.startTimers.clear();
    for (const id of [...this.runs.keys()]) this.cancel(id, false);
  }

  /** After every config change: new, edited, turned off and deleted automations. */
  onConfigChanged(): void {
    const config = this.deps.store.get();
    const ids = new Set(config.automations.map((a) => a.id));
    for (const a of config.automations) {
      const key = keyOf(a);
      if (this.due.get(a.id)?.key === key) continue;
      this.due.set(a.id, { at: null, key });
      this.idleFired.delete(a.id);
      this.activeArmed.delete(a.id);
      if (a.enabled) this.schedule(a);
    }
    for (const id of [...this.due.keys()]) {
      if (ids.has(id)) continue;
      this.due.delete(id);
      this.cancel(id, false);
    }
    this.arm();
    this.watchIdle();
  }

  /** Lock, unlock, sleep, wake, charger in or out (from Electron's powerMonitor). */
  onEvent(event: WindowsEvent): void {
    if (event === 'wake') this.onDue();
    for (const a of this.deps.store.get().automations) {
      if (a.enabled && a.trigger.kind === 'event' && a.trigger.event === event)
        this.fire(a, eventDetail(event));
    }
  }

  // ---------- user actions ----------

  /** "Run Now" in the app: runs it at once, whatever its trigger. */
  runNow(id: Id): boolean {
    const a = this.find(id);
    if (!a) return false;
    this.fire(a, 'Run now', true);
    return true;
  }

  /** Stops a running automation (between steps or on its Cancel card). */
  cancel(id: Id, record = true): void {
    const run = this.runs.get(id);
    if (!run) return;
    run.cancelled = true;
    run.wake?.();
    run.decide?.(false);
    if (record) this.record(run.automation, 'cancelled', 'Cancelled by you');
  }

  /** A button on a Cancel card: Run Now ('done'), Cancel ('dismiss'), or it ran out ('expired'). */
  handleCard(key: string, action: NotificationAction): void {
    const run = [...this.runs.values()].find((r) => r.cardKey === key);
    if (!run) {
      this.deps.notifier.close(key);
      return;
    }
    if (action.kind === 'dismiss' || action.kind === 'snooze') this.cancel(run.automation.id);
    else run.decide?.(true);
  }

  // ---------- queries ----------

  nextTimes(): AutomationNext[] {
    return this.deps.store.get().automations.map((a) => ({
      automationId: a.id,
      at: a.enabled ? (this.due.get(a.id)?.at?.toISOString() ?? null) : null,
    }));
  }

  running(): AutomationRun[] {
    return [...this.runs.values()].map((r) => ({
      automationId: r.automation.id,
      state: r.state,
      until: r.until?.toISOString() ?? null,
    }));
  }

  watchRuns(listener: (runs: AutomationRun[]) => void): void {
    this.onRuns = listener;
  }

  // ---------- scheduling ----------

  private find(id: Id): Automation | undefined {
    return this.deps.store.get().automations.find((a) => a.id === id);
  }

  private schedule(a: Automation): void {
    const entry = this.due.get(a.id);
    if (entry)
      entry.at = a.trigger.kind === 'schedule' ? nextFireAt(a.trigger.rule, this.now()) : null;
  }

  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const times = [...this.due.values()].flatMap((d) => (d.at ? [d.at.getTime()] : []));
    if (times.length === 0) return;
    const delay = Math.min(Math.max(0, Math.min(...times) - this.now().getTime()), MAX_TIMER_MS);
    this.timer = setTimeout(() => this.onDue(), delay);
  }

  private onDue(): void {
    const now = this.now();
    for (const a of this.deps.store.get().automations) {
      const due = this.due.get(a.id);
      if (!a.enabled || a.trigger.kind !== 'schedule' || !due?.at) continue;
      if (due.at.getTime() > now.getTime() + 1000) continue;
      const at = due.at;
      due.at = nextFireAt(a.trigger.rule, now);
      // Asleep or off at the time: never shut down (or anything else) hours late.
      if (now.getTime() - at.getTime() > LATE_MS)
        this.record(a, 'skipped', `Missed at ${format(at, 'HH:mm')}: the PC was asleep or off`, at);
      else this.fire(a, `At ${format(at, 'HH:mm')}`, false, at);
    }
    this.arm();
  }

  /** Polls idle time only while an automation waits for 'idle' or 'active'. */
  private watchIdle(): void {
    const wanted = this.deps.store
      .get()
      .automations.some(
        (a) =>
          a.enabled &&
          a.trigger.kind === 'event' &&
          (a.trigger.event === 'idle' || a.trigger.event === 'active'),
      );
    if (wanted && !this.idleTimer)
      this.idleTimer = setInterval(() => this.checkIdle(), IDLE_POLL_MS);
    if (!wanted && this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private checkIdle(): void {
    const idle = this.deps.idleSeconds();
    for (const a of this.deps.store.get().automations) {
      const t = a.trigger;
      if (!a.enabled || t.kind !== 'event') continue;
      const away = idle >= t.idleMin * 60;
      if (t.event === 'idle') {
        if (away && !this.idleFired.has(a.id)) {
          this.idleFired.add(a.id);
          this.fire(a, `Away for ${t.idleMin} min`);
        } else if (!away) this.idleFired.delete(a.id);
      } else if (t.event === 'active') {
        if (away) this.activeArmed.add(a.id);
        else if (this.activeArmed.has(a.id) && idle <= ACTIVE_WITHIN_SEC) {
          this.activeArmed.delete(a.id);
          this.fire(a, `Back after ${t.idleMin} min or more away`);
        }
      }
    }
  }

  // ---------- running ----------

  /** An automation's trigger happened: check pause and quiet hours, then run its steps. */
  private fire(a: Automation, detail: string, manual = false, dueAt?: Date): void {
    if (this.runs.has(a.id)) {
      this.record(a, 'skipped', 'It was still running from before', dueAt);
      return;
    }
    const config = this.deps.store.get();
    const now = this.now();
    if (!manual && a.respectPause) {
      if (isPaused(config, now)) {
        this.record(a, 'skipped', 'Paused', dueAt);
        return;
      }
      const { quietHours } = config.settings;
      if (quietHours.enabled && inWindow(quietHours, now)) {
        this.record(a, 'skipped', 'Quiet hours', dueAt);
        return;
      }
    }
    const run: Run = {
      automation: a,
      state: 'running',
      until: null,
      cancelled: false,
      wake: null,
      decide: null,
      cardKey: null,
    };
    this.runs.set(a.id, run);
    this.changed();
    void this.steps(run, detail, dueAt).finally(() => {
      this.runs.delete(a.id);
      this.changed();
    });
  }

  private async steps(run: Run, trigger: string, dueAt?: Date): Promise<void> {
    const a = run.automation;
    const done: string[] = [];
    let recorded = false;
    for (const step of a.steps) {
      if (step.waitSec > 0 && !(await this.wait(run, step.waitSec * 1000))) return;
      if (run.cancelled) return;
      const label = actionSummary(step.action);
      if (isDisruptive(step.action)) {
        if (a.warnSec > 0 && !(await this.countdown(run, step.action))) return;
        // Signing out, sleeping or shutting down may end Smaran: write History first.
        this.record(a, 'ran', `${trigger}: ${[...done, label].join(', then ')}`, dueAt);
        this.deps.history.flush();
        recorded = true;
      }
      run.state = 'running';
      run.until = null;
      this.changed();
      try {
        await this.deps.run(step.action);
      } catch (error) {
        this.record(a, 'failed', `${label}: ${(error as Error).message}`, dueAt);
        return;
      }
      done.push(label);
    }
    if (!recorded) this.record(a, 'ran', `${trigger}: ${done.join(', then ')}`, dueAt);
  }

  /** Waits `ms`; false if the run was cancelled meanwhile. */
  private wait(run: Run, ms: number): Promise<boolean> {
    if (run.cancelled) return Promise.resolve(false);
    run.state = 'waiting';
    run.until = new Date(this.now().getTime() + ms);
    this.changed();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        run.wake = null;
        resolve(!run.cancelled);
      }, ms);
      run.wake = () => {
        clearTimeout(timer);
        run.wake = null;
        resolve(false);
      };
    });
  }

  /** Shows the Cancel card for `warnSec`; true = go ahead (it ran out, or Run Now). */
  private countdown(run: Run, action: Action): Promise<boolean> {
    if (run.cancelled || action.kind !== 'power') return Promise.resolve(!run.cancelled);
    const a = run.automation;
    const key = `${CARD_PREFIX}${++this.seq}`;
    run.state = 'countdown';
    run.until = new Date(this.now().getTime() + a.warnSec * 1000);
    run.cardKey = key;
    this.changed();
    this.deps.notifier.show({
      key,
      reminderId: null,
      title: POWER_SOON[action.power],
      body: `“${a.name}” · in ${seconds(a.warnSec)}. Press Cancel to stop it.`,
      color: 'clay',
      important: true,
      label: 'Automation',
      hideAfterSec: a.warnSec,
      sound: true,
      countdown: true,
    });
    return new Promise((resolve) => {
      // Main keeps the time, so it goes ahead even if the card never loads.
      const timer = setTimeout(() => run.decide?.(true), a.warnSec * 1000);
      run.decide = (go) => {
        clearTimeout(timer);
        run.decide = null;
        run.cardKey = null;
        this.deps.notifier.close(key);
        resolve(go && !run.cancelled);
      };
    });
  }

  private changed(): void {
    this.onRuns(this.running());
  }

  private record(a: Automation, outcome: Outcome, detail: string, dueAt?: Date): void {
    const now = this.now();
    this.deps.history.add({
      id: this.newId(),
      reminderId: a.id,
      title: a.name,
      dueAt: (dueAt ?? now).toISOString(),
      at: now.toISOString(),
      outcome,
      detail,
    });
  }
}

/** Trigger + enabled: when this changes, the next time is recomputed. */
function keyOf(a: Automation): string {
  return JSON.stringify([a.enabled, a.trigger]);
}

function eventDetail(event: WindowsEvent): string {
  switch (event) {
    case 'lock':
      return 'PC locked';
    case 'unlock':
      return 'PC unlocked';
    case 'sleep':
      return 'PC going to sleep';
    case 'wake':
      return 'PC woke up';
    case 'pluggedIn':
      return 'Charger plugged in';
    case 'onBattery':
      return 'Charger unplugged';
    case 'idle':
      return 'Away';
    case 'active':
      return 'Back';
  }
}
