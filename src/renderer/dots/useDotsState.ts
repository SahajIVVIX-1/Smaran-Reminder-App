import { useEffect, useState } from 'react';
import type { SceneKey } from '@shared/dots/dotsScenes';

/** What the app is doing — decides what the dots show. */
export type DotsState =
  | 'startup' // app just opened: dots form the "S"
  | 'idle' // auto mode: dance → shape → dance…
  | 'loading' // saving / loading
  | 'alert' // a reminder popup is firing
  | 'success' // saved / reminder done
  | 'error' // something failed
  | 'snooze'; // reminders paused (AppSettings.pausedUntil set)

export interface StateScene {
  /** undefined = auto mode */
  scene?: SceneKey;
  /** go back to auto mode after this many ms */
  backToAutoAfterMs?: number;
}

export const DEFAULT_STATE_SCENES: Readonly<Record<DotsState, StateScene>> = {
  startup: { scene: 's-mark', backToAutoAfterMs: 1800 },
  idle: {},
  loading: { scene: 'bounce' },
  alert: { scene: 'bell-ring' },
  success: { scene: 'check', backToAutoAfterMs: 2200 },
  error: { scene: 'cross', backToAutoAfterMs: 3000 },
  snooze: { scene: 'moon' },
};

/**
 * Turns an app state into the `scene` prop for <SmaranDots />.
 *
 *   const scene = useDotsState(isFiring ? 'alert' : 'idle');
 *   <SmaranDots scene={scene} />
 */
export function useDotsState(
  state: DotsState,
  map: Readonly<Record<DotsState, StateScene>> = DEFAULT_STATE_SCENES,
): SceneKey | undefined {
  const entry = map[state];
  // remembers which state timed out, so a new state is never skipped by a stale flag
  const [expiredFor, setExpiredFor] = useState<DotsState | null>(null);
  // A new state clears the old timeout flag (derived during render, not in an effect).
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setExpiredFor(null);
  }

  useEffect(() => {
    if (entry.backToAutoAfterMs === undefined) return undefined;
    const timer = window.setTimeout(() => setExpiredFor(state), entry.backToAutoAfterMs);
    return () => window.clearTimeout(timer);
  }, [state, entry]);

  return expiredFor === state ? undefined : entry.scene;
}
