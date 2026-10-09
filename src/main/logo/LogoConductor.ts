import {
  FLASH_MS,
  LOGO_ANIMATIONS,
  logoStateFor,
  nextChangeAt,
  STARTUP_MS,
  type LogoInputs,
  type LogoState,
} from '@shared/logoState';
import type { LogoAnimator } from './LogoAnimator';

/** Now and then, when nothing is happening, the tray dots do a little dance. */
const FLOURISH_EVERY_MS = 20 * 60_000;
/** Hovering the tray icon can ask for a dance at most this often. */
const HOVER_COOLDOWN_MS = 45_000;

/**
 * Decides what the Smaran dots show from what the app is doing (a reminder on screen, done or
 * snoozed, paused, quiet hours, a reminder due within a minute) and plays it on the tray and the
 * taskbar. The title bar gets the same state through `onState`.
 */
export class LogoConductor {
  private inputs: LogoInputs = {
    showing: 0,
    paused: false,
    quiet: false,
    nextAt: null,
    flash: null,
    startupUntil: 0,
  };
  private state: LogoState | null = null;
  private lightTaskbar = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flourishTimer: ReturnType<typeof setInterval> | null = null;
  private lastFlourish = 0;

  constructor(
    private readonly animator: LogoAnimator,
    private readonly onState: (state: LogoState) => void,
    private readonly now: () => number = Date.now,
  ) {}

  start(lightTaskbar: boolean): void {
    this.lightTaskbar = lightTaskbar;
    this.inputs.startupUntil = this.now() + STARTUP_MS;
    this.update();
    this.flourishTimer = setInterval(() => this.flourish(), FLOURISH_EVERY_MS);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.flourishTimer) clearInterval(this.flourishTimer);
    this.timer = null;
    this.flourishTimer = null;
  }

  get current(): LogoState {
    return this.state ?? 'idle';
  }

  set(change: Partial<Pick<LogoInputs, 'showing' | 'paused' | 'quiet' | 'nextAt'>>): void {
    this.inputs = { ...this.inputs, ...change };
    this.update();
  }

  /** A reminder was just marked done or snoozed. */
  flash(kind: 'done' | 'snoozed'): void {
    this.inputs = { ...this.inputs, flash: { kind, until: this.now() + FLASH_MS } };
    this.update();
  }

  /** The taskbar switched between light and dark: redraw in the right colours. */
  setLightTaskbar(light: boolean): void {
    if (light === this.lightTaskbar) return;
    this.lightTaskbar = light;
    this.update(true);
  }

  /** A short dance when idle: on a timer, or when the pointer rests on the tray icon. */
  flourish(fromHover = false): void {
    const now = this.now();
    if (this.state !== 'idle') return;
    if (fromHover && now - this.lastFlourish < HOVER_COOLDOWN_MS) return;
    this.lastFlourish = now;
    this.animator.play(LOGO_ANIMATIONS.idle, this.lightTaskbar, true);
  }

  private update(force = false): void {
    const now = this.now();
    const state = logoStateFor(this.inputs, now);
    if (force || state !== this.state) {
      this.state = state;
      this.animator.play(LOGO_ANIMATIONS[state], this.lightTaskbar);
      this.onState(state);
    }
    if (this.timer) clearTimeout(this.timer);
    const at = nextChangeAt(this.inputs, now);
    this.timer =
      at === null
        ? null
        : setTimeout(() => this.update(), Math.min(Math.max(0, at - now), 86_400_000));
  }
}
