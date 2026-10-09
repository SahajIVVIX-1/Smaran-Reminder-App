# Smaran dots logo

Three dots for the top-left of Smaran's title bar. They **dance around each other** — shuffle, orbit, juggle, bounce — and then **flow together like liquid into a shape**: a pen writing, a bell, a clock with moving hands, a heart, an envelope… then melt back into dots and do the next one.

- **Always smooth.** Every point is a spring, so nothing ever jumps — not between dances, not between shapes, not even if the scene changes 20 times a second.
- **Liquid merge.** When dots touch they blend like drops of ink (an SVG "goo" filter). Turn it off with `goo={false}`.
- **No new dependencies.** React 18+ and TypeScript only; strict-mode clean.
- **Theme-aware.** Colours come from CSS variables and update live in light / dark / system.
- **Accessible.** Respects `prefers-reduced-motion` (shows a still shape, no movement); keyboard focus outline when used as a button.

## 1. Add the files

Copy this `dots/` folder to `src/renderer/components/dots/`.

| File | What it is |
|---|---|
| `SmaranDots.tsx` | The component |
| `dotsScenes.ts` | 10 dances + 14 shapes |
| `dotsEngine.ts` | Spring physics + auto mode (no DOM, unit-tested) |
| `dotsGeometry.ts` | Shape building and resampling helpers |
| `dotsColors.ts`, `dotsTicker.ts` | Theme colours, shared frame loop |
| `useDotsState.ts` | App state → what the dots show |
| `dots.css` | **Colours** and layout |
| `DotsGallery.tsx`, `dots-gallery.css` | Dev-only preview |
| `dotsEngine.test.ts` | Vitest tests (all 552 scene-to-scene switches) |

## 2. Match your colours

In `dots.css`, point the variables at your own tokens:

```css
:root {
  --smaran-logo-primary:  var(--color-text);    /* dot 1, main lines */
  --smaran-logo-accent:   var(--color-accent);  /* dot 2 */
  --smaran-logo-accent-2: var(--color-accent-2);/* dot 3 */
  --smaran-logo-alert:    var(--color-warning); /* ringing bell */
  --smaran-logo-success:  var(--color-success); /* done */
  --smaran-logo-error:    var(--color-danger);  /* error */
}
```

Set the theme from `AppSettings.theme`:

```ts
const root = document.documentElement;
if (settings.app.theme === 'system') root.removeAttribute('data-theme');
else root.setAttribute('data-theme', settings.app.theme);
```

## 3. Put it in the title bar

```tsx
import { SmaranDots, useDotsState } from './components/dots';

export function TitleBar({ isFiring, isSaving, pausedUntil }: Props) {
  const state = isFiring ? 'alert' : isSaving ? 'loading' : pausedUntil ? 'snooze' : 'idle';
  const scene = useDotsState(state);

  return (
    <header className="titlebar">
      <span className="smaran-titlebar-logo">
        <SmaranDots size={28} scene={scene} onClick={openMainMenu} />
      </span>
      <span className="titlebar__name">Smaran</span>
    </header>
  );
}
```

The logo is `-webkit-app-region: no-drag`, so it stays clickable in a draggable frameless title bar. Keep `overflow: visible` on the header — a click "pop" briefly throws the dots outward.

### App state → scene

| State | Shows |
|---|---|
| `idle` | **Auto mode**: dance → shape → dance → next shape… |
| `startup` | Dots form the "S", then auto mode |
| `loading` | Typing bounce |
| `alert` (popup firing) | Bell ringing |
| `success` | Check in a circle, then back to auto |
| `error` | Cross that shakes, then back to auto |
| `snooze` (`pausedUntil` set) | Moon with a "z" |

## 4. Props

| Prop | Default | |
|---|---|---|
| `scene` | — | a fixed scene; leave out for auto mode |
| `sequence` | all everyday shapes | which shapes auto mode cycles through, in order |
| `size` | `28` | px or any CSS length |
| `speed` | `1` | `0.1` = slow motion |
| `paused` | `false` | |
| `goo` | `true` | liquid merge |
| `interactive` | `true` | hover grows, press squeezes, click pops the dots apart |
| `onClick` | — | makes it a `<button>` |
| `onSceneChange` | — | called on each auto-mode change |
| `replayToken` | — | change it to replay the current scene |
| `label` | `'Smaran'` | accessible name |
| `reducedMotion` | `'auto'` | `'always'` / `'never'` |

## 5. The scenes

**Dances (10):** `shuffle` (shell game — pairs swap over and under), `orbit`, `bounce` (typing dots), `figure-eight`, `juggle`, `merge-split` (dots melt into one and split), `triangle-spin`, `cradle` (Newton's cradle), `spiral`, `wave`.

**Shapes (14):** `s-mark` (the Smaran S + reminder dot), `pen` (writing a wavy line), `bell`, `bell-ring`, `clock` (hands turn), `check`, `cross`, `heart` (beats), `envelope` (new-message dot pops), `calendar` (day dot hops), `moon`, `sparkle` (spins), `bulb`, `hourglass` (sand falls).

## 6. Preview

Mount `<DotsGallery />` on a dev-only route: auto mode, every scene, slow motion, stress test, liquid toggle, sizes 28 / 64 / 160 px.

## 7. How it works

- Each scene returns **three strokes of 40 points** for any moment in time. A dot is just a stroke whose 40 points sit on top of each other (round caps make it a circle).
- Every point is a **critically damped spring** chasing its target, so position and speed are always continuous.
- When a shape starts, each dot is matched to the **nearest stroke** (and the stroke's direction is chosen) so dots take the shortest path. Points further along the stroke use softer springs, which makes the line **unroll out of the dot**.
- Dancing dots keep their own colours; shapes use their stroke colours; colours glide between the two.

## 8. Add your own shape

In `dotsScenes.ts`, add to `SHAPES` (any polylines in a 64×64 box, centre 32,32):

```ts
shape('star', 'Star', (t) => [
  stroke(STAR_OUTLINE, 'accent2'),
  stroke(line([28, 50], [36, 50]), 'primary'),
  still([48, 14], 'accent'),           // a stroke can stay a dot
]),
```

Add its key to the `SceneKey` type (and to `DEFAULT_SEQUENCE` if auto mode should show it), then run:

```
npx vitest run src/renderer/components/dots
```
