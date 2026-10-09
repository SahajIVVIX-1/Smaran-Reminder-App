import { format } from 'date-fns';
import { emptyState, type NewId } from '@shared/defaults';
import type { NextFire, NotificationAction, NotificationRequest, SaveResult } from '@shared/ipc';
import { nextFireAt } from '@shared/nextFireAt';
import {
  isTimeOfDay,
  type Config,
  type HistoryEntry,
  type Id,
  type Outcome,
  type Reminder,
  type ReminderState,
} from '@shared/schema';
import { inWindow, latestMissed, tomorrowMorning, windowEnd } from '@shared/time';
import type { SaveOptions } from '../store/ConfigStore';

export interface EngineStore {
  get(): Config;
  update(change: (current: Config) => Config, options?: SaveOptions): SaveResult;
}

export interface Notifier {
  show(request: NotificationRequest): void;
  close(key: string): void;
  closeAll(): void;
}

export interface EngineDeps {
  store: EngineStore;
  history: { add(entry: HistoryEntry): void };
  notifier: Notifier;
  /** Full-screen app, game or presentation in front. */
  isBusy(): Promise<boolean>;
  now?: () => Date;
  random?: () => number;
  newId?: NewId;
}

/** Re-check at least this often, so a changed system clock is noticed. */
export const MAX_TIMER_MS = 60 * 60_000;
/** A one-time reminder missed by more than this is recorded, not shown. */
export const ONCE_SHOW_LATE_MS = 12 * 60 * 60_000;
/** At most this many missed reminders pop up after a restart; the rest are summarised. */
export const MAX_MISSED_POPUPS = 3;
/** How often a notification held for a full-screen app checks again, and for how long. */
export const BUSY_RECHECK_MS = 60_000;
export const BUSY_GIVE_UP_MS = 3 * 60 * 60_000;
/** Later than this counts as missed (e.g. after sleep) rather than just on time. */
export const LATE_MS = 2 * 60_000;

type Source = 'scheduled' | 'snooze' | 'manual';

interface Due {
  at: Date | null;
  key: string;
}

interface Open {
  key: string;
  reminderId: Id;
  dueAt: Date;
  body: string;
  attempt: number;
}

interface Held {
  dueAt: Date;
  since: Date;
  reason: 'quiet' | 'busy';
  source: Source;
}

const hm = (d: Date) => format(d, 'HH:mm');

/**
 * Decides what to show and when. Never polls for schedules: one timer to the earliest due time,
 * recomputed after every change, fire, wake and unlock. Free of Electron so it can be unit-tested.
 */
export class Engine {
  private readonly due = new Map<Id, Due>();
  private readonly open = new Map<string, Open>();
  private readonly followUps = new Map<Id, ReturnType<typeof setTimeout>>();
  private readonly held = new Map<Id, Held>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private quietTimer: ReturnType<typeof setTimeout> | null = null;
  private busyTimer: ReturnType<typeof setTimeout> | null = null;
  private writing = false;
  private seq = 0;
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly newId: NewId;

  constructor(private readonly deps: EngineDeps) {
    this.now = deps.now ?? (() => new Date());
    this.random = deps.random ?? Math.random;
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  // ---------- lifecycle ----------

  /** Start-up: computes next times, and shows (or records) what came due while Smaran was off. */
  start(): void {
    const now = this.now();
    const config = this.deps.store.get();
    const missed: { reminder: Reminder; at: Date }[] = [];
    const expiredOnce: { reminder: Reminder; at: Date }[] = [];

    for (const reminder of config.reminders) {
      const state = config.state[reminder.id] ?? emptyState();
      this.due.set(reminder.id, { at: null, key: keyOf(reminder) });
      if (!reminder.enabled) continue;
      const { rule } = reminder;

      if (rule.kind === 'once') {
        if (state.completed) continue;
        const at = nextFireAt(rule, new Date(0));
        if (!at) continue;
        if (at > now) this.setDue(reminder.id, at);
        else if (now.getTime() - at.getTime() < ONCE_SHOW_LATE_MS) missed.push({ reminder, at });
        else expiredOnce.push({ reminder, at });
        continue;
      }

      if (rule.kind === 'interval') {
        const last = state.lastDueAt ? new Date(state.lastDueAt) : null;
        // Keep the rhythm across restarts, but never pop up the moment Smaran starts.
        const from = last && last.getTime() + rule.everyMs > now.getTime() ? last : now;
        this.setDue(reminder.id, nextFireAt(rule, from));
        continue;
      }

      const since = new Date(state.lastDueAt ?? reminder.createdAt);
      const at = latestMissed(rule, since, now);
      if (at && now.getTime() - at.getTime() > LATE_MS) missed.push({ reminder, at });
      this.setDue(reminder.id, nextFireAt(rule, now));
    }

    for (const { reminder, at } of expiredOnce) {
      this.record(reminder, at, 'missed', 'Smaran was not running');
      this.saveState(reminder.id, (s) => ({ ...s, lastDueAt: at.toISOString(), completed: true }));
    }

    missed.sort((a, b) => b.at.getTime() - a.at.getTime());
    missed
      .slice(0, MAX_MISSED_POPUPS)
      .forEach(({ reminder, at }) => void this.occur(reminder, at, 'scheduled', true));
    const rest = missed.slice(MAX_MISSED_POPUPS);
    for (const { reminder, at } of rest) {
      this.record(reminder, at, 'missed', 'Smaran was not running');
      this.markDue(reminder, at);
    }
    if (rest.length > 0) {
      this.deps.notifier.show({
        key: `summary-${++this.seq}`,
        reminderId: null,
        title: `${rest.length} more reminder${rest.length === 1 ? ' was' : 's were'} missed`,
        body: 'They came due while Smaran was off. They’re listed in History.',
        color: 'slate',
        important: false,
        label: 'While You Were Away',
        hideAfterSec: config.settings.notification.hideAfterSec,
        sound: false,
      });
    }
    this.arm();
  }

  stop(): void {
    for (const t of [this.timer, this.quietTimer, this.busyTimer]) if (t) clearTimeout(t);
    for (const t of this.followUps.values()) clearTimeout(t);
    this.timer = this.quietTimer = this.busyTimer = null;
    this.followUps.clear();
  }

  /** After every config change: picks up new, edited, disabled and deleted reminders. */
  onConfigChanged(): void {
    if (this.writing) return;
    const config = this.deps.store.get();
    const now = this.now();
    const ids = new Set(config.reminders.map((r) => r.id));

    for (const reminder of config.reminders) {
      const key = keyOf(reminder);
      const previous = this.due.get(reminder.id);
      if (previous?.key === key) continue;
      this.due.set(reminder.id, { at: null, key });
      this.cancelFollowUp(reminder.id);
      this.held.delete(reminder.id);
      if (!reminder.enabled) continue;
      if (reminder.rule.kind === 'once') {
        // Editing a one-time reminder arms it again.
        this.saveState(reminder.id, (s) => ({ ...s, completed: false }));
        const at = nextFireAt(reminder.rule, now);
        this.setDue(reminder.id, at);
      } else {
        this.setDue(reminder.id, nextFireAt(reminder.rule, now));
      }
    }

    for (const id of [...this.due.keys()]) {
      if (ids.has(id)) continue;
      this.due.delete(id);
      this.held.delete(id);
      this.cancelFollowUp(id);
      for (const o of [...this.open.values()]) if (o.reminderId === id) this.closeOpen(o.key);
    }
    this.arm();
  }

  /** Wake from sleep or unlock: anything that came due meanwhile is handled once, now. */
  onResume(): void {
    this.onDue();
  }

  // ---------- user actions ----------

  /** A button on a notification card. */
  handleAction(key: string, action: NotificationAction): void {
    const open = this.open.get(key);
    if (!open) {
      this.deps.notifier.close(key);
      return;
    }
    const reminder = this.deps.store.get().reminders.find((r) => r.id === open.reminderId);
    this.open.delete(key);
    this.deps.notifier.close(key);
    if (!reminder) return;
    const once = reminder.rule.kind === 'once';
    const now = this.now();

    switch (action.kind) {
      case 'done':
      case 'dismiss': {
        this.cancelFollowUp(reminder.id);
        this.record(reminder, open.dueAt, action.kind === 'done' ? 'done' : 'dismissed');
        if (once) this.saveState(reminder.id, (s) => ({ ...s, completed: true }));
        break;
      }
      case 'snooze': {
        this.cancelFollowUp(reminder.id);
        const until =
          action.minutes === 'tomorrow'
            ? tomorrowMorning(now)
            : new Date(now.getTime() + action.minutes * 60_000);
        const detail =
          action.minutes === 'tomorrow'
            ? 'Snoozed until tomorrow 09:00'
            : `Snoozed ${action.minutes >= 60 ? `${action.minutes / 60} h` : `${action.minutes} min`}`;
        this.record(reminder, open.dueAt, 'snoozed', detail);
        this.saveState(reminder.id, (s) => ({ ...s, snoozedUntil: until.toISOString() }));
        this.arm();
        break;
      }
      case 'expired': {
        const { followUp } = reminder;
        if (followUp.enabled && open.attempt <= followUp.times) {
          this.cancelFollowUp(reminder.id);
          const timer = setTimeout(() => {
            this.followUps.delete(reminder.id);
            const fresh = this.deps.store.get().reminders.find((r) => r.id === reminder.id);
            if (!fresh?.enabled) return;
            if (isPaused(this.deps.store.get(), this.now())) return;
            this.show(
              fresh,
              open.dueAt,
              `Again · ${open.attempt} of ${fresh.followUp.times}`,
              open.body,
              open.attempt + 1,
            );
          }, followUp.everyMin * 60_000);
          this.followUps.set(reminder.id, timer);
        } else {
          this.record(reminder, open.dueAt, 'missed', 'Not acknowledged');
          if (once) this.saveState(reminder.id, (s) => ({ ...s, completed: true }));
        }
        break;
      }
    }
  }

  /** Tray "Show Now" / "Remind me now": shows a reminder at once without changing its schedule. */
  showNow(reminderId?: Id): boolean {
    const config = this.deps.store.get();
    const reminder = reminderId
      ? config.reminders.find((r) => r.id === reminderId)
      : (this.upcoming()[0]?.reminder ?? config.reminders.find((r) => r.enabled));
    if (!reminder) return false;
    this.deliver(reminder, this.now(), 'manual', '');
    return true;
  }

  /** A sample notification for the settings preview; it records nothing. */
  test(request: Omit<NotificationRequest, 'key'>): void {
    this.deps.notifier.show({ ...request, key: `test-${++this.seq}` });
  }

  // ---------- queries ----------

  /** Next time per reminder (a pending snooze counts), for the app's lists. */
  nextTimes(): NextFire[] {
    const config = this.deps.store.get();
    return config.reminders.map((r) => {
      const at = this.nextFor(r, config);
      return { reminderId: r.id, at: at?.toISOString() ?? null };
    });
  }

  /** Enabled reminders by their next time, soonest first. */
  upcoming(): { reminder: Reminder; at: Date }[] {
    const config = this.deps.store.get();
    return config.reminders
      .flatMap((reminder) => {
        const at = reminder.enabled ? this.nextFor(reminder, config) : null;
        return at ? [{ reminder, at }] : [];
      })
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  get heldCount(): number {
    return this.held.size;
  }

  // ---------- scheduling ----------

  private nextFor(reminder: Reminder, config: Config): Date | null {
    const scheduled = this.due.get(reminder.id)?.at ?? null;
    const snooze = config.state[reminder.id]?.snoozedUntil;
    const snoozed = snooze ? new Date(snooze) : null;
    if (scheduled && snoozed) return scheduled < snoozed ? scheduled : snoozed;
    return scheduled ?? snoozed;
  }

  private setDue(id: Id, at: Date | null): void {
    const entry = this.due.get(id);
    if (entry) entry.at = at;
  }

  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const config = this.deps.store.get();
    const times = config.reminders.flatMap((r) => {
      const at = r.enabled ? this.nextFor(r, config) : null;
      return at ? [at.getTime()] : [];
    });
    if (times.length === 0) return;
    const delay = Math.min(Math.max(0, Math.min(...times) - this.now().getTime()), MAX_TIMER_MS);
    this.timer = setTimeout(() => this.onDue(), delay);
  }

  private onDue(): void {
    const now = this.now();
    const horizon = now.getTime() + 1000;
    const config = this.deps.store.get();

    for (const reminder of config.reminders) {
      if (!reminder.enabled) continue;
      const snooze = config.state[reminder.id]?.snoozedUntil;
      if (snooze && new Date(snooze).getTime() <= horizon) {
        this.saveState(reminder.id, (s) => ({ ...s, snoozedUntil: null }));
        void this.occur(reminder, new Date(snooze), 'snooze', false);
      }
      const due = this.due.get(reminder.id);
      if (due?.at && due.at.getTime() <= horizon) {
        const at = due.at;
        const late = now.getTime() - at.getTime() > LATE_MS;
        due.at = reminder.rule.kind === 'once' ? null : nextFireAt(reminder.rule, now);
        void this.occur(reminder, at, 'scheduled', late && isTimeOfDay(reminder.rule));
      }
    }
    this.arm();
  }

  /** A reminder came due: apply pause, quiet hours and full-screen rules, then show it. */
  private async occur(
    reminder: Reminder,
    dueAt: Date,
    source: Source,
    missed: boolean,
  ): Promise<void> {
    const config = this.deps.store.get();
    const now = this.now();
    if (source === 'scheduled') this.markDue(reminder, dueAt);

    if (isPaused(config, now)) {
      this.record(reminder, dueAt, 'skipped', 'Paused');
      if (reminder.rule.kind === 'once')
        this.saveState(reminder.id, (s) => ({ ...s, completed: true }));
      return;
    }
    const normal = reminder.priority === 'normal';
    const { quietHours } = config.settings;
    if (normal && quietHours.enabled && inWindow(quietHours, now)) {
      if (!isTimeOfDay(reminder.rule) && source === 'scheduled') {
        this.record(reminder, dueAt, 'skipped', 'Quiet hours');
        return;
      }
      this.hold(reminder.id, { dueAt, since: now, reason: 'quiet', source });
      return;
    }
    if (normal && config.settings.holdWhenBusy && (await this.deps.isBusy())) {
      this.hold(reminder.id, { dueAt, since: now, reason: 'busy', source });
      return;
    }
    const label = missed ? `Missed at ${hm(dueAt)}` : source === 'snooze' ? 'Snoozed' : '';
    this.deliver(reminder, dueAt, source, label);
  }

  private hold(reminderId: Id, held: Held): void {
    // A newer occurrence replaces an older held one.
    this.held.set(reminderId, held);
    if (held.reason === 'quiet') this.armQuiet();
    else this.armBusy();
  }

  private armQuiet(): void {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    const { quietHours } = this.deps.store.get().settings;
    const now = this.now();
    const end = quietHours.enabled ? windowEnd(quietHours, now) : now;
    this.quietTimer = setTimeout(
      () => this.releaseHeld('quiet'),
      Math.max(0, end.getTime() - now.getTime()),
    );
  }

  private armBusy(): void {
    if (this.busyTimer) return;
    this.busyTimer = setTimeout(() => {
      this.busyTimer = null;
      void this.recheckBusy();
    }, BUSY_RECHECK_MS);
  }

  private async recheckBusy(): Promise<void> {
    const now = this.now();
    const config = this.deps.store.get();
    for (const [id, held] of [...this.held]) {
      if (held.reason !== 'busy' || now.getTime() - held.since.getTime() < BUSY_GIVE_UP_MS)
        continue;
      this.held.delete(id);
      const reminder = config.reminders.find((r) => r.id === id);
      if (reminder) this.record(reminder, held.dueAt, 'missed', 'Held while you were busy');
    }
    if (![...this.held.values()].some((h) => h.reason === 'busy')) return;
    if (await this.deps.isBusy()) this.armBusy();
    else this.releaseHeld('busy');
  }

  private releaseHeld(reason: Held['reason']): void {
    const config = this.deps.store.get();
    for (const [id, held] of [...this.held]) {
      if (held.reason !== reason) continue;
      this.held.delete(id);
      const reminder = config.reminders.find((r) => r.id === id);
      if (!reminder?.enabled) continue;
      if (isPaused(config, this.now())) {
        this.record(reminder, held.dueAt, 'skipped', 'Paused');
        continue;
      }
      this.deliver(reminder, held.dueAt, held.source, `Delayed from ${hm(held.dueAt)}`);
    }
  }

  // ---------- showing ----------

  private deliver(reminder: Reminder, dueAt: Date, source: Source, label: string): void {
    let body = reminder.note;
    if (reminder.lines.length > 0) {
      const state = this.deps.store.get().state[reminder.id] ?? emptyState();
      const { index, next } = pickLine(reminder, state, this.random);
      body = reminder.lines[index] ?? '';
      this.saveState(reminder.id, (s) => ({ ...s, ...next }));
    }
    this.show(reminder, dueAt, label, body, 1);
  }

  private show(
    reminder: Reminder,
    dueAt: Date,
    label: string,
    body: string,
    attempt: number,
  ): void {
    // One card per reminder: a newer one replaces an unanswered older one.
    for (const o of [...this.open.values()]) {
      if (o.reminderId !== reminder.id) continue;
      this.closeOpen(o.key);
      this.record(reminder, o.dueAt, 'missed', 'Replaced by a newer reminder');
    }
    const settings = this.deps.store.get().settings;
    const key = `n-${++this.seq}`;
    this.open.set(key, { key, reminderId: reminder.id, dueAt, body, attempt });
    const important = reminder.priority === 'important';
    this.deps.notifier.show({
      key,
      reminderId: reminder.id,
      title: reminder.title,
      body,
      color: reminder.color,
      important,
      label,
      hideAfterSec: important
        ? null
        : (reminder.hideAfterSec ?? settings.notification.hideAfterSec),
      sound: reminder.sound === 'default' ? settings.notification.sound : reminder.sound === 'on',
      animation: reminder.animation,
    });
  }

  private closeOpen(key: string): void {
    this.open.delete(key);
    this.deps.notifier.close(key);
  }

  private cancelFollowUp(reminderId: Id): void {
    const timer = this.followUps.get(reminderId);
    if (timer) clearTimeout(timer);
    this.followUps.delete(reminderId);
  }

  // ---------- persistence ----------

  private markDue(reminder: Reminder, at: Date): void {
    this.saveState(reminder.id, (s) => ({ ...s, lastDueAt: at.toISOString() }));
  }

  private record(reminder: Reminder, dueAt: Date, outcome: Outcome, detail?: string): void {
    this.deps.history.add({
      id: this.newId(),
      reminderId: reminder.id,
      title: reminder.title,
      dueAt: dueAt.toISOString(),
      at: this.now().toISOString(),
      outcome,
      ...(detail ? { detail } : {}),
    });
  }

  private saveState(id: Id, change: (s: ReminderState) => ReminderState): void {
    this.writing = true;
    try {
      this.deps.store.update(
        (config) => {
          if (!config.reminders.some((r) => r.id === id)) return config;
          return {
            ...config,
            state: { ...config.state, [id]: change(config.state[id] ?? emptyState()) },
          };
        },
        { backup: false },
      );
    } finally {
      this.writing = false;
    }
  }
}

/** Rule + enabled: when this changes, the next time is recomputed. */
function keyOf(reminder: Reminder): string {
  return JSON.stringify([reminder.enabled, reminder.rule]);
}

export function isPaused(config: Config, now: Date): boolean {
  const until = config.settings.pausedUntil;
  return until !== null && new Date(until).getTime() > now.getTime();
}

/** Next rotating line: in order, or shuffled with no repeats until every line has been shown. */
export function pickLine(
  reminder: Pick<Reminder, 'lines' | 'lineOrder'>,
  state: Pick<ReminderState, 'nextLine' | 'shuffleBag'>,
  random: () => number,
): { index: number; next: Pick<ReminderState, 'nextLine' | 'shuffleBag'> } {
  const n = reminder.lines.length;
  if (reminder.lineOrder === 'inOrder') {
    const index = state.nextLine % n;
    return { index, next: { nextLine: (index + 1) % n, shuffleBag: [] } };
  }
  let bag = state.shuffleBag.filter((i) => i < n);
  if (bag.length === 0) {
    bag = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j] as number, bag[i] as number];
    }
    // Don't repeat the last line across a refill.
    if (n > 1 && bag[0] === state.nextLine) [bag[0], bag[1]] = [bag[1] as number, bag[0]];
  }
  const [index = 0, ...rest] = bag;
  return { index, next: { nextLine: index, shuffleBag: rest } };
}
