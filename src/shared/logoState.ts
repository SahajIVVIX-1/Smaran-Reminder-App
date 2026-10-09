import type { SceneKey } from './dots/dotsScenes';

/**
 * What the Smaran dots show, in the title bar, the tray and the taskbar. Main decides it from what
 * the app is doing; the highest-priority condition wins.
 */
export type LogoState =
  | 'alert' // a reminder is on screen: the bell rings
  | 'done' // a reminder was just marked done: a check
  | 'snoozed' // a reminder was just snoozed: an hourglass
  | 'startup' // Smaran just started: the dots form the S
  | 'paused' // reminders are paused: a moon with a "z"
  | 'quiet' // quiet hours: the moon too
  | 'soon' // the next reminder is due within a minute: a clock
  | 'idle'; // nothing going on

export interface LogoInputs {
  /** Reminder cards on screen. */
  showing: number;
  paused: boolean;
  quiet: boolean;
  nextAt: Date | null;
  /** A short-lived "done" / "snoozed" flourish and when it ends (ms since epoch). */
  flash: { kind: 'done' | 'snoozed'; until: number } | null;
  /** When the startup animation ends (ms since epoch). */
  startupUntil: number;
}

/** How soon a reminder must be to show the clock. */
export const SOON_MS = 60_000;

export function logoStateFor(i: LogoInputs, now: number): LogoState {
  if (i.showing > 0) return 'alert';
  if (i.flash && now < i.flash.until) return i.flash.kind;
  if (now < i.startupUntil) return 'startup';
  if (i.paused) return 'paused';
  if (i.quiet) return 'quiet';
  if (i.nextAt) {
    const left = i.nextAt.getTime() - now;
    if (left >= 0 && left <= SOON_MS) return 'soon';
  }
  return 'idle';
}

/** The next moment the state could change by itself (a flash or startup ends, "soon" begins). */
export function nextChangeAt(i: LogoInputs, now: number): number | null {
  const times = [
    i.flash && i.flash.until > now ? i.flash.until : null,
    i.startupUntil > now ? i.startupUntil : null,
    i.nextAt && i.nextAt.getTime() - SOON_MS > now ? i.nextAt.getTime() - SOON_MS : null,
    i.nextAt && i.nextAt.getTime() > now ? i.nextAt.getTime() + 1 : null,
  ].filter((t): t is number => t !== null);
  return times.length ? Math.min(...times) : null;
}

export interface LogoAnimation {
  /** The scene to show; 'auto' lets the dots dance and form shapes on their own. */
  scene: SceneKey;
  /** Keep animating (true) or settle into a still picture (false). */
  loop: boolean;
  /** Frames per second for the tray and taskbar. */
  fps: number;
}

/** Tray and taskbar: animate only while something is happening; otherwise a still S. */
export const LOGO_ANIMATIONS: Readonly<Record<LogoState, LogoAnimation>> = {
  alert: { scene: 'bell-ring', loop: true, fps: 14 },
  done: { scene: 'check', loop: false, fps: 14 },
  snoozed: { scene: 'hourglass', loop: true, fps: 12 },
  startup: { scene: 's-mark', loop: false, fps: 14 },
  paused: { scene: 'moon', loop: true, fps: 6 },
  quiet: { scene: 'moon', loop: true, fps: 6 },
  soon: { scene: 'clock', loop: true, fps: 10 },
  idle: { scene: 's-mark', loop: false, fps: 14 },
};

/** How long the done / snoozed flourishes and the startup animation play. */
export const FLASH_MS = 2600;
export const STARTUP_MS = 2400;
