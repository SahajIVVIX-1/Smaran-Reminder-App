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

/**
 * The installer: a floating Smaran card with the travelling colour light round its border,
 * liquid dots, a Claude-style spinner with rotating verbs, and a progress bar.
 */
export function SetupCard({ init }: { init: SetupInit }) {
  const [state, setState] = useState<SetupProgress>({ phase: 'preparing', progress: 0 });
  const [glyph, setGlyph] = useState(0);
  const [verb, setVerb] = useState(() => pick(-1));
  const [seconds, setSeconds] = useState(0);
  const working = state.phase !== 'done' && state.phase !== 'error';

  useEffect(() => window.smaranSetup.onProgress(setState), []);

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
  const status =
    state.phase === 'done'
      ? 'Opening Smaran'
      : state.phase === 'error'
        ? 'Setup stopped'
        : state.phase === 'finishing'
          ? 'Adding shortcuts'
          : VERBS[verb];

  return (
    <div className="grid h-screen place-items-center p-[22px] select-none">
      <div
        className="drag relative w-full animate-modal rounded-[22px]"
        data-testid="setup"
      >
        <div className="glass-card absolute inset-0" style={{ borderRadius: 'inherit' }} />

        <div className="relative px-6 pt-5 pb-5">
          <div className="flex items-center gap-4">
            <span className="grid h-[68px] w-[68px] shrink-0 place-items-center" aria-hidden>
              <SmaranDots
                size={64}
                goo
                interactive={false}
                scene={state.phase === 'done' ? 'check' : state.phase === 'error' ? 'cross' : undefined}
              />
            </span>
            <div className="min-w-0">
              <div className="font-serif text-[23px] leading-tight font-semibold text-ink">
                {state.phase === 'done' ? 'Smaran is ready' : 'Installing Smaran'}
              </div>
              <div className="mt-0.5 text-[12px] text-muted">
                Version {init.version} · Gentle reminders, on your schedule
              </div>
            </div>
          </div>

          {state.phase === 'error' ? (
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

              <div className="mt-2.5 truncate text-[11px] text-faint" title={init.target}>
                {init.target}
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
