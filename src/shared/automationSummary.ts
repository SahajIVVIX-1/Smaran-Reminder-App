import { ruleSummary } from './ruleSummary';
import type { Action, Automation, PowerAction, Trigger, WindowsEvent } from './schema';

export const POWER_LABEL: Record<PowerAction, string> = {
  lock: 'Lock the PC',
  signOut: 'Sign out',
  sleep: 'Sleep',
  hibernate: 'Hibernate',
  shutdown: 'Shut down',
  restart: 'Restart',
};

/** For the countdown card: "Smaran will shut down this PC". */
export const POWER_SOON: Record<PowerAction, string> = {
  lock: 'Smaran will lock this PC',
  signOut: 'Smaran will sign you out',
  sleep: 'Smaran will put this PC to sleep',
  hibernate: 'Smaran will hibernate this PC',
  shutdown: 'Smaran will shut down this PC',
  restart: 'Smaran will restart this PC',
};

export const EVENT_LABEL: Record<WindowsEvent, string> = {
  lock: 'When I lock the PC',
  unlock: 'When I unlock the PC',
  sleep: 'When the PC goes to sleep',
  wake: 'When the PC wakes up',
  pluggedIn: 'When the charger is plugged in',
  onBattery: 'When the charger is unplugged',
  idle: 'When I’ve been away',
  active: 'When I’m back after being away',
};

export const START_LABEL: Record<Extract<Trigger, { kind: 'start' }>['when'], string> = {
  boot: 'When the computer starts',
  signIn: 'When I sign in',
  smaran: 'When Smaran opens',
};

/** The last part of a Windows or POSIX path. */
export function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** "Daily at 22:00", "When I lock the PC", "When I sign in, after 30 s". */
export function triggerSummary(trigger: Trigger): string {
  switch (trigger.kind) {
    case 'schedule':
      return ruleSummary(trigger.rule);
    case 'start':
      return trigger.delaySec > 0
        ? `${START_LABEL[trigger.when]}, after ${seconds(trigger.delaySec)}`
        : START_LABEL[trigger.when];
    case 'event':
      if (trigger.event === 'idle') return `When I’ve been away ${trigger.idleMin} min`;
      if (trigger.event === 'active') return `When I’m back after ${trigger.idleMin} min away`;
      return EVENT_LABEL[trigger.event];
  }
}

/** "Lock the PC", "Open Spotify.exe", "Run backup.bat", "Open youtube.com". */
export function actionSummary(action: Action): string {
  switch (action.kind) {
    case 'power':
      return POWER_LABEL[action.power];
    case 'open': {
      const name = action.path ? baseName(action.path) : '…';
      return action.what === 'script' ? `Run ${name}` : `Open ${name}`;
    }
    case 'link': {
      let host = action.url;
      try {
        host = new URL(action.url).host || action.url;
      } catch {
        // Not a full URL yet; show what was typed.
      }
      return `Open ${host.replace(/^www\./, '')}`;
    }
  }
}

/** "Open Spotify.exe, then Lock the PC". */
export function stepsSummary(automation: Pick<Automation, 'steps'>): string {
  return automation.steps.map((s) => actionSummary(s.action)).join(', then ');
}

/** "30 s", "2 min", "1 min 30 s". */
export function seconds(total: number): string {
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}
