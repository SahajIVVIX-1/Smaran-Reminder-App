import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DANCES,
  DANCE_CATEGORIES,
  getScene,
  SCENES,
  SHAPES,
  SHAPE_CATEGORIES,
  type SceneKey,
} from '@shared/dots/dotsScenes';
import { shapesIn } from '@shared/logoSettings';
import type { LogoSettings as LogoSettingsT } from '@shared/schema';
import { SmaranDots } from '../../dots';
import { cx } from '../cx';
import { SearchIcon } from '../icons';
import { useApp } from '../store';
import { Button, Card, Dialog, Row, Segmented, Switch } from '../ui';
import { Select } from './Select';

const SLOW = 0.12;
const EVERY: { value: number; label: string }[] = [
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
];

/**
 * Settings → Logo: everything the dots explorer offers, for the title-bar logo and the tray icon.
 * A live preview with Auto / Prev / Next / Random / Replay / Pause and slow motion, the auto-mode
 * shape families, speed, liquid merge, hover effects, and a browser for all 259 animations.
 */
export function LogoSettingsCard({ className }: { className?: string }) {
  const logo = useApp((s) => s.config?.settings.logo);
  const { setSettings } = useApp.getState();
  const [browsing, setBrowsing] = useState(false);
  // Preview playback (not saved): a scene to try, pause and slow motion.
  const [preview, setPreview] = useState<SceneKey | null>(null);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [replay, setReplay] = useState(0);
  const [nowShowing, setNowShowing] = useState<string>('s-mark');

  if (!logo) return null;
  const set = (patch: Partial<LogoSettingsT>) =>
    setSettings((x) => ({ ...x, logo: { ...x.logo, ...patch } }));
  const setTray = (patch: Partial<LogoSettingsT['tray']>) =>
    setSettings((x) => ({ ...x, logo: { ...x.logo, tray: { ...x.logo.tray, ...patch } } }));

  const fixed = preview ?? (logo.mode === 'scene' ? (logo.scene as SceneKey) : undefined);
  const index = SCENES.findIndex((s) => s.key === (fixed ?? nowShowing));
  const step = (by: number) =>
    setPreview(SCENES[(index + by + SCENES.length) % SCENES.length]?.key as SceneKey);

  return (
    <Card
      title="Logo"
      description="The Smaran dots in the title bar and the tray."
      className={className}
    >
      <div className="flex items-center gap-5 border-b border-line py-4">
        <div className="grid h-[120px] w-[120px] shrink-0 place-items-center rounded-2xl border border-line bg-raised">
          <SmaranDots
            size={88}
            scene={fixed}
            sequence={shapesIn(logo.families)}
            speed={slow ? SLOW : logo.speed}
            paused={paused || !logo.animate}
            goo={logo.liquid}
            interactive={logo.interactive}
            replayToken={replay}
            onSceneChange={setNowShowing}
            label="Logo preview"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[16px] font-semibold">
            {getScene(fixed ?? nowShowing).name}
          </div>
          <div className="font-serif text-[13px] text-muted italic">
            {fixed
              ? `${getScene(fixed).category} · ${preview ? 'trying it out' : 'your chosen animation'}`
              : 'Auto mode: dancing and forming shapes in turn'}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={!preview && logo.mode === 'auto' ? 'primary' : 'secondary'}
              onClick={() => {
                setPreview(null);
                set({ mode: 'auto' });
              }}
            >
              Auto
            </Button>
            <Button size="sm" onClick={() => step(-1)}>
              ‹ Prev
            </Button>
            <Button size="sm" onClick={() => step(1)}>
              Next ›
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setPreview(SCENES[Math.floor(Math.random() * SCENES.length)]?.key as SceneKey)
              }
            >
              Random
            </Button>
            <Button size="sm" onClick={() => setReplay((r) => r + 1)}>
              Replay
            </Button>
            <Button size="sm" onClick={() => setPaused((p) => !p)}>
              {paused ? 'Play' : 'Pause'}
            </Button>
          </div>
          {preview && (
            <div className="mt-2 flex animate-fade items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  set({ mode: 'scene', scene: preview });
                  setPreview(null);
                }}
              >
                Use This Animation
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                Back
              </Button>
            </div>
          )}
        </div>
      </div>

      <Row label="Animate the Logo" hint="Off keeps the S still.">
        <Switch
          label="Animate the logo"
          checked={logo.animate}
          onChange={(animate) => set({ animate })}
        />
      </Row>
      <Row
        label="What It Shows"
        hint={
          logo.mode === 'scene'
            ? `${getScene(logo.scene).name}, all the time.`
            : 'Dances, then flows into a shape, then the next…'
        }
      >
        <Segmented
          label="What the logo shows"
          value={logo.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'scene', label: 'One Animation' },
          ]}
        />
        <Button size="sm" onClick={() => setBrowsing(true)}>
          Browse All…
        </Button>
      </Row>
      {logo.mode === 'auto' && (
        <>
          <Row label="Shapes in Auto Mode" hint="Pick families, or none for everyday shapes.">
            <FamilyPicker
              value={logo.families}
              onChange={(families) => set({ families })}
              label="Auto mode shapes"
            />
          </Row>
          <Row label="Dance Between Shapes">
            <Switch
              label="Dance between shapes"
              checked={logo.dances}
              onChange={(dances) => set({ dances })}
            />
          </Row>
        </>
      )}
      <Row label="Speed" hint={slow ? 'Slow motion is on for the preview.' : undefined}>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <input
            type="checkbox"
            className="accent-[var(--accent)]"
            checked={slow}
            onChange={(e) => setSlow(e.currentTarget.checked)}
          />
          Slow motion
        </label>
        <input
          type="range"
          aria-label="Speed"
          min={0.25}
          max={2}
          step={0.05}
          value={logo.speed}
          onChange={(e) => set({ speed: Number(e.currentTarget.value) })}
          className="w-36 accent-[var(--accent)]"
        />
        <span className="w-11 text-right font-mono text-[12px] text-muted">
          {logo.speed.toFixed(2)}×
        </span>
      </Row>
      <Row label="Liquid Merge" hint="Dots melt together when they touch. Shown from 48 px up.">
        <Switch label="Liquid merge" checked={logo.liquid} onChange={(liquid) => set({ liquid })} />
      </Row>
      <Row label="Hover and Click Effects" hint="Grows on hover, squeezes on press, pops on click.">
        <Switch
          label="Hover and click effects"
          checked={logo.interactive}
          onChange={(interactive) => set({ interactive })}
        />
      </Row>
      <Row
        label="React to Reminders"
        hint="A bell while a reminder is up, a check on Done, a moon when paused."
      >
        <Switch
          label="React to reminders"
          checked={logo.reactToReminders}
          onChange={(reactToReminders) => set({ reactToReminders })}
        />
      </Row>

      <div className="pt-3 pb-1 font-serif text-[14px] font-semibold">System Tray</div>
      <Row label="Animate the Tray Icon" hint="Off shows the still S.">
        <Switch
          label="Animate the tray icon"
          checked={logo.tray.animate}
          onChange={(animate) => setTray({ animate })}
        />
      </Row>
      {logo.tray.animate && (
        <>
          <Row label="Tray Icons" hint="When nothing is happening the icon moves between these.">
            <FamilyPicker
              value={logo.tray.families}
              onChange={(families) => setTray({ families })}
              label="Tray icon shapes"
            />
          </Row>
          <Row label="Change Every">
            <Select
              aria-label="Change the tray icon every"
              value={logo.tray.everySec}
              options={
                EVERY.some((o) => o.value === logo.tray.everySec)
                  ? EVERY
                  : [
                      { value: logo.tray.everySec, label: `${logo.tray.everySec} seconds` },
                      ...EVERY,
                    ]
              }
              onChange={(everySec) => setTray({ everySec })}
            />
          </Row>
          <Row label="Dance When I Point at It">
            <Switch
              label="Dance when I point at it"
              checked={logo.tray.hoverDance}
              onChange={(hoverDance) => setTray({ hoverDance })}
            />
          </Row>
        </>
      )}

      <AnimationBrowser
        open={browsing}
        current={logo.mode === 'scene' ? logo.scene : null}
        onClose={() => setBrowsing(false)}
        onPick={(scene) => {
          set({ mode: 'scene', scene });
          setPreview(null);
          setBrowsing(false);
        }}
      />
    </Card>
  );
}

/** Multi-select of shape families, as toggle chips. */
function FamilyPicker({
  value,
  onChange,
  label,
}: {
  value: readonly string[];
  onChange: (families: string[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex max-w-[340px] flex-wrap justify-end gap-1">
      {SHAPE_CATEGORIES.map((family) => {
        const on = value.includes(family);
        return (
          <button
            key={family}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((f) => f !== family) : [...value, family])}
            className={cx(
              'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors duration-150',
              on
                ? 'border-accent/50 bg-accent-soft text-accent'
                : 'border-line text-muted hover:bg-hover hover:text-ink',
            )}
          >
            {family}
          </button>
        );
      })}
    </div>
  );
}

type Tab = 'all' | 'dance' | 'shape';

/** Every animation, like the dots explorer: search, dances/shapes, families, live tiles. */
function AnimationBrowser({
  open,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  current: string | null;
  onClose: () => void;
  onPick: (scene: SceneKey) => void;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [family, setFamily] = useState('');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(current);
  const scroller = useRef<HTMLDivElement>(null);

  const families = tab === 'dance' ? DANCE_CATEGORIES : tab === 'shape' ? SHAPE_CATEGORIES : [];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = tab === 'dance' ? DANCES : tab === 'shape' ? SHAPES : SCENES;
    return base.filter(
      (s) =>
        (!family || s.category === family) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.key.includes(q) ||
          s.category.toLowerCase().includes(q)),
    );
  }, [tab, family, query]);

  return (
    <Dialog
      open={open}
      title="All Animations"
      size="xl"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            disabled={!chosen}
            onClick={() => chosen && onPick(chosen as SceneKey)}
          >
            Use This Animation
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-accent/60 focus-within:ring-3 focus-within:ring-accent-soft">
          <SearchIcon size={14} className="text-faint" />
          <input
            aria-label="Search animations"
            placeholder={`Search ${SCENES.length} animations…`}
            className="h-full flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
        <Segmented<Tab>
          label="Kind"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setFamily('');
          }}
          options={[
            { value: 'all', label: `All ${SCENES.length}` },
            { value: 'dance', label: `Dances ${DANCES.length}` },
            { value: 'shape', label: `Shapes ${SHAPES.length}` },
          ]}
        />
      </div>
      {families.length > 0 && (
        <div className="mt-2.5 flex animate-fade flex-wrap gap-1">
          {['', ...families].map((f) => (
            <button
              key={f || 'all'}
              type="button"
              aria-pressed={family === f}
              onClick={() => setFamily(f)}
              className={cx(
                'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors duration-150',
                family === f
                  ? 'border-accent/50 bg-accent-soft text-accent'
                  : 'border-line text-muted hover:bg-hover hover:text-ink',
              )}
            >
              {f || 'Every family'}
            </button>
          ))}
        </div>
      )}
      <div
        ref={scroller}
        className="mt-3 grid max-h-[38vh] grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2 overflow-y-auto pr-1"
      >
        {list.map((s) => (
          <Tile
            key={s.key}
            scene={s.key as SceneKey}
            name={s.name}
            chosen={chosen === s.key}
            root={scroller}
            onClick={() => setChosen(s.key)}
          />
        ))}
        {list.length === 0 && (
          <p className="col-span-full py-8 text-center font-serif text-[14px] italic">
            No animations match.
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** One live animation; only tiles in view are mounted, so hundreds stay smooth. */
function Tile({
  scene,
  name,
  chosen,
  root,
  onClick,
}: {
  scene: SceneKey;
  name: string;
  chosen: boolean;
  root: React.RefObject<HTMLDivElement | null>;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false), {
      root: root.current,
      rootMargin: '80px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={chosen}
      title={name}
      onClick={onClick}
      className={cx(
        'flex flex-col items-center gap-1 rounded-xl border px-1 pt-2 pb-1.5 transition-colors duration-150',
        chosen ? 'border-accent/60 bg-accent-soft' : 'border-line hover:bg-hover',
      )}
    >
      <span className="grid h-12 w-12 place-items-center">
        {visible && <SmaranDots size={44} scene={scene} interactive={false} goo={false} />}
      </span>
      <span className="w-full truncate text-center text-[11px] text-muted">{name}</span>
    </button>
  );
}
