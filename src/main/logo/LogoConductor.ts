import { DEFAULT_SETTINGS } from '@shared/defaults';
import type { SceneKey } from '@shared/dots/dotsScenes';
import {
  FLASH_MS,
  LOGO_ANIMATIONS,
  logoStateFor,
  nextChangeAt,
  STARTUP_MS,
  type LogoInputs,
  type LogoState,
} from '@shared/logoState';
import { shapesIn } from '@shared/logoSettings';
import type { LogoSettings } from '@shared/schema';
import type { LogoAnimator } from './LogoAnimator';

/** Hovering the tray icon can ask for a dance at most this often. */
const HOVER_COOLDOWN_MS = 45_000;
/** With the tray tour off, the idle tray still does a little dance now and then. */
const FLOURISH_EVERY_MS = 20 * 60_000;

/**
 * Decides what the Smaran dots show from what the app is doing (a reminder on screen, done or
 * snoozed, paused, quiet hours, a reminder due within a minute) and plays it on the tray and the
 * taskbar. When nothing is happening the tray icon tours the chosen shape families (Science &
 * symbols by default), morphing to the next shape every so often and holding it still in between.
 * The title bar gets the same state through `onState`.
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
  private settings: LogoSettings = DEFAULT_SETTINGS.logo;
  private tour: SceneKey[] = shapesIn(DEFAULT_SETTINGS.logo.tray.families);
  private tourIndex = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private lastFlourish = 0;

  constructor(
    private readonly animator: LogoAnimator,
    private readonly onState: (state: LogoState) => void,
    private readonly now: () => number = Date.now,
  ) {}

  start(lightTaskbar: boolean, settings: LogoSettings): void {
    this.lightTaskbar = lightTaskbar;
    this.settings = settings;
    this.tour = shapesIn(settings.tray.families);
    this.inputs.startupUntil = this.now() + STARTUP_MS;
    this.update();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.stopIdle();
    this.timer = null;
  }

  get current(): LogoState {
    return this.state ?? 'idle';
  }

  /** Settings changed: re-plan the tray tour and redraw if anything visible changed. */
  configure(settings: LogoSettings): void {
    const before = JSON.stringify(this.settings);
    this.settings = settings;
    if (JSON.stringify(settings) === before) return;
    this.tour = shapesIn(settings.tray.families);
    this.tourIndex = 0;
    this.update(true);
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

  /** A short dance when idle: when the pointer rests on the tray icon (if allowed), or on a timer. */
  flourish(fromHover = false): void {
    const now = this.now();
    if (this.state !== 'idle' || !this.settings.tray.animate) return;
    if (
      fromHover &&
      (!this.settings.tray.hoverDance || now - this.lastFlourish < HOVER_COOLDOWN_MS)
    )
      return;
    this.lastFlourish = now;
    this.animator.play(
      { ...LOGO_ANIMATIONS.idle, scene: this.idleScene() },
      this.lightTaskbar,
      true,
    );
  }

  private idleScene(): SceneKey {
    if (!this.settings.tray.animate) return 's-mark';
    return this.tour[this.tourIndex % this.tour.length] ?? 's-mark';
  }

  private playIdle(): void {
    this.animator.play({ ...LOGO_ANIMATIONS.idle, scene: this.idleScene() }, this.lightTaskbar);
  }

  private startIdle(): void {
    this.stopIdle();
    if (!this.settings.tray.animate) return;
    const tour = this.tour.length > 1;
    this.idleTimer = setInterval(
      () => {
        if (tour) {
          this.tourIndex = (this.tourIndex + 1) % this.tour.length;
          this.playIdle();
        } else this.flourish();
      },
      tour ? this.settings.tray.everySec * 1000 : FLOURISH_EVERY_MS,
    );
  }

  private stopIdle(): void {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
  }

  private update(force = false): void {
    const now = this.now();
    const raw = logoStateFor(this.inputs, now);
    const state = this.settings.reactToReminders || raw === 'startup' ? raw : 'idle';
    if (force || state !== this.state) {
      this.state = state;
      if (state === 'idle') {
        this.playIdle();
        this.startIdle();
      } else {
        this.stopIdle();
        this.animator.play(LOGO_ANIMATIONS[state], this.lightTaskbar);
      }
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
