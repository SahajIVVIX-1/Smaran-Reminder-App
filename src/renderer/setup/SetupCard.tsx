import { useEffect, useState } from 'react';
import type { SetupInit, SetupProgress } from '@shared/setup';
import { SmaranDots } from '../dots';

/** The twinkling spinner, like Claude's: out and back through the glyphs. */
const GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const GLYPH_MS = 110;

/** Little verbs that rotate while the files copy. */
const VERBS = [
  'Unpacking',
  'Gathering dots',
  'Polishing',
  'Brewing reminders',
  'Tidying the tray',
  'Tuning chimes',
  'Smaran-ing',
  'Choreographing dots',
  'Untangling',
  'Folding notes',
  'Remembering',
  'Arranging',
  'Sprinkling calm',
  'Warming up',
  'Lining things up',
  'Settling in',
  'Conjuring',
  'Percolating',
  'Whispering to Windows',
  'Fluffing pillows',
];
const VERB_MS = 2200;

const pick = (not: number) => {
  let i = not;
  while (i === not) i = Math.floor(Math.random() * VERBS.length);
  return i;
};

/** What the uninstaller says while it works. */
const UNINSTALL_STEPS = ['Closing Smaran', 'Removing shortcuts', 'Tidying up', 'Packing away dots'];

const primary =
  'h-[30px] flex-1 rounded-[10px] bg-accent text-[12.5px] font-medium text-on-accent hover:bg-accent-hover';
const secondary = 'glass-button h-[30px] flex-1 rounded-[10px] text-[12.5px] font-medium text-ink';

/**
 * The installer and the uninstaller: a floating Smaran card with the travelling colour light
 * round its border, liquid dots, a Claude-style spinner with rotating verbs, and a progress bar.
 * It stays where it opens and has no right-click menu.
 */
export function SetupCard({ init }: { init: SetupInit }) {
  const uninstalling = init.mode === 'uninstall';
  const [state, setState] = useState<SetupProgress>({
    phase: uninstalling ? 'confirm' : 'preparing',
    progress: 0,
  });
  const [glyph, setGlyph] = useState(0);
  const [verb, setVerb] = useState(() => pick(-1));
  const [seconds, setSeconds] = useState(0);
  const [deleteData, setDeleteData] = useState(false);
  const [doneCountdown, setDoneCountdown] = useState(5);
  const working = !['done', 'error', 'license', 'confirm'].includes(state.phase);

  // The licensee's name stays once known, as the install goes on.
  useEffect(
    () =>
      window.smaranSetup.onProgress((next) =>
        setState((prev) => ({ ...next, licensee: next.licensee ?? prev.licensee })),
      ),
    [],
  );

  useEffect(() => {
    if (uninstalling && state.phase === 'done') {
      const timer = window.setInterval(() => {
        setDoneCountdown((c) => Math.max(0, c - 1));
      }, 1000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [uninstalling, state.phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && state.phase === 'done')) {
        if (!working) window.smaranSetup.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [working, state.phase]);

  useEffect(() => {
    if (!working) return undefined;
    const spin = window.setInterval(() => setGlyph((g) => (g + 1) % GLYPHS.length), GLYPH_MS);
    const words = window.setInterval(() => setVerb((v) => pick(v)), VERB_MS);
    const clock = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      window.clearInterval(spin);
      window.clearInterval(words);
      window.clearInterval(clock);
    };
  }, [working]);

  const percent = Math.round(state.progress * 100);
  const status = uninstalling
    ? state.phase === 'done'
      ? doneCountdown > 0
        ? `Smaran was removed · Closing in ${doneCountdown}s`
        : 'Smaran was removed'
      : (UNINSTALL_STEPS[Math.min(3, Math.floor(state.progress * 4))] ?? 'Tidying up')
    : state.phase === 'done'
      ? 'Opening Smaran'
      : state.phase === 'error'
        ? 'Setup stopped'
        : state.phase === 'finishing'
          ? 'Adding shortcuts'
          : VERBS[verb];
  const title = uninstalling
    ? state.phase === 'done'
      ? 'Goodbye for now'
      : state.phase === 'confirm'
        ? 'Uninstall Smaran?'
        : 'Uninstalling Smaran'
    : state.phase === 'done'
      ? 'Smaran is ready'
      : state.phase === 'license'
        ? 'Your License, Please'
        : 'Installing Smaran';

  return (
    <div className="grid h-screen place-items-center p-[22px] select-none">
      <div className="relative w-full animate-modal rounded-[22px]" data-testid="setup">
        <div className="glass-card absolute inset-0" style={{ borderRadius: 'inherit' }} />

        <div className="relative px-6 pt-5 pb-5">
          <div className="flex items-center gap-4">
            <span className="grid h-[68px] w-[68px] shrink-0 place-items-center" aria-hidden>
              <SmaranDots
                size={64}
                goo
                interactive={false}
                scene={
                  state.phase === 'done' ? 'check' : state.phase === 'error' ? 'cross' : undefined
                }
              />
            </span>
            <div className="min-w-0">
              <div className="font-serif text-[23px] leading-tight font-semibold text-ink">
                {title}
              </div>
              <div className="mt-0.5 text-[12px] text-muted">
                Version {init.version} ·{' '}
                {state.licensee
                  ? `Licensed to ${state.licensee}`
                  : 'Gentle reminders, on your schedule'}
              </div>
            </div>
          </div>

          {state.phase === 'confirm' ? (
            <div className="mt-4">
              <p className="text-[12.5px] leading-snug text-muted">
                Smaran will be removed from this PC: the app, its shortcuts and start-at-login.
              </p>
              <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink">
                <input
                  type="checkbox"
                  checked={deleteData}
                  onChange={(e) => setDeleteData(e.currentTarget.checked)}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Also delete my reminders, automations and settings
              </label>
              <div className="relative z-10 mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.smaranSetup.uninstall(deleteData)}
                  className={primary}
                >
                  Uninstall
                </button>
                <button
                  type="button"
                  onClick={() => window.smaranSetup.close()}
                  className={secondary}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : state.phase === 'license' ? (
            <div className="mt-4">
              <p
                className={`text-[12.5px] leading-snug ${state.error ? 'text-danger' : 'text-muted'}`}
                role={state.error ? 'alert' : undefined}
              >
                {state.error ??
                  'Smaran installs with a license. Choose your license image.'}
              </p>
              <div className="no-drag relative z-10 mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.smaranSetup.chooseLicense()}
                  className="h-[30px] flex-1 rounded-[10px] bg-accent text-[12.5px] font-medium text-on-accent hover:bg-accent-hover"
                >
                  Choose License Image…
                </button>
                <button
                  type="button"
                  onClick={() => window.smaranSetup.close()}
                  className="glass-button h-[30px] flex-1 rounded-[10px] text-[12.5px] font-medium text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : state.phase === 'error' ? (
            <div className="mt-4">
              <p className="text-[12.5px] leading-snug text-danger">{state.error}</p>
              {/* Buttons sit outside the drag area, or Windows swallows their clicks. */}
              <div className="no-drag relative z-10 mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.smaranSetup.retry()}
                  className="h-[30px] flex-1 rounded-[10px] bg-accent text-[12.5px] font-medium text-on-accent hover:bg-accent-hover"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => window.smaranSetup.close()}
                  className="glass-button h-[30px] flex-1 rounded-[10px] text-[12.5px] font-medium text-ink"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-baseline gap-2 text-[13px]">
                <span
                  className="inline-block w-[14px] text-center text-[15px] leading-none text-accent"
                  aria-hidden
                >
                  {state.phase === 'done' ? '✓' : GLYPHS[glyph]}
                </span>
                <span key={status} className="animate-fade font-medium text-ink">
                  {status}…
                </span>
                <span className="ml-auto font-mono text-[11.5px] text-faint">
                  {working ? `${seconds}s · ` : ''}
                  {percent}%
                </span>
              </div>

              <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-hover">
                <div
                  className={state.phase === 'done' ? 'setup-bar setup-bar--done' : 'setup-bar'}
                  style={{ width: `${Math.max(3, percent)}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-faint">
                <span className="truncate" title={init.target}>
                  {init.target}
                </span>
                {uninstalling && state.phase === 'done' && (
                  <button
                    type="button"
                    onClick={() => window.smaranSetup.close()}
                    className="no-drag ml-2 shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-medium text-muted hover:bg-hover hover:text-ink active:scale-[0.97]"
                  >
                    Close now
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* The same colourful light that travels round a reminder card's border. */}
        <div className="ring-light ring-glow" aria-hidden />
        <div className="ring-light" aria-hidden />
      </div>
    </div>
  );
}
