# Smaran Dots

Three dots for the top-left of Smaran's title bar. They **dance** around each other, then **flow together like liquid into a shape**, keep that shape alive, and melt back into dots for the next move.

- **126 dances** in 8 families: Loaders & UI, Choreography, Illusions, Orbits & space, Physics, Nature & life, Juggling & sport, Mechanics.
- **133 shapes** in 10 families: Time, Communication, Writing & work, Status, Tech, Media, Nature & weather, Objects, Science & symbols, Letters & digits.
- **Always continuous.** Any scene can change to any other at any moment, even mid-change or 20 times a second, and nothing jumps. The test suite checks thousands of random switches.
- **No new dependencies.** React 18+ and TypeScript only, and the code is strict-mode clean.
- **Theme-aware** in light, dark and system modes; respects `prefers-reduced-motion`.

Open **`smaran-dots-explorer.html`** in any browser to browse, play and compare every animation.

## Some highlights

| Scene | What's clever about it |
|---|---|
| `tusi-couple` | Each dot only ever moves in a straight line, yet together they roll around a circle. |
| `ghost-pass` | The dots bounce off each other, but their colours swap inside the liquid merge, so they seem to pass straight through. |
| `portal` | A dot dives into one ring and comes out of the other. |
| `trefoil-3d`, `mobius-3d`, `dna-helix`, `atom-3d` | Real 3D paths with perspective and correct front/back overlap. |
| `tautochrone` | On a cycloid, balls released from different heights reach the bottom at the same instant. |
| `robot-arm` | A two-joint arm solves inverse kinematics to pick up a dot and carry it. |
| `black-hole`, `infinite-zoom`, `sunflower` | Dots respawn invisibly, so the effect loops forever. |
| `play-pause`, `cube` (Necker), `smile` | One drawing morphs into another, point by point. |
| `phasor` | A rotating dot traces the sine wave next to it. |

## 1. Add the files

Copy this `dots/` folder to `src/renderer/components/dots/`. The `explorer/` folder is a dev tool; you can leave it out of the app.

| Path | What it is |
|---|---|
| `SmaranDots.tsx` | The React component |
| `dotsScenes.ts` | Registry of all scenes (re-exports types) |
| `scenes/kit.ts` | Toolkit used to write scenes (maths, 3D, smear, builders) |
| `scenes/dances-*.ts`, `scenes/shapes-*.ts` | The scenes, by family |
| `dotsEngine.ts` | Spring physics + auto mode (no DOM, unit-tested) |
| `dotsRender.ts` | Draws the engine into SVG (shared by component and explorer) |
| `dotsTypes.ts`, `dotsGeometry.ts` | Types and shape helpers |
| `dotsColors.ts`, `dotsTicker.ts` | Theme colours, shared frame loop |
| `useDotsState.ts` | App state → which scene to show |
| `dots.css` | **Colours** and layout |
| `DotsGallery.tsx` | Small in-app dev picker |
| `explorer/` | Source of the standalone explorer page |
| `dotsEngine.test.ts` | Vitest suite |

## 2. Match your colours

In `dots.css`, point the variables at your own tokens:

```css
:root {
  --smaran-logo-primary:  var(--color-text);     /* dot 1, main lines */
  --smaran-logo-accent:   var(--color-accent);   /* dot 2 */
  --smaran-logo-accent-2: var(--color-accent-2); /* dot 3 */
  --smaran-logo-alert:    var(--color-warning);
  --smaran-logo-success:  var(--color-success);
  --smaran-logo-error:    var(--color-danger);
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

| App state | Shows |
|---|---|
| `idle` | Auto mode: dance → shape → dance → next shape… |
| `startup` | The "S", then auto mode |
| `loading` | `bounce` |
| `alert` | `bell-ring` |
| `success` | `check`, then auto mode |
| `error` | `cross`, then auto mode |
| `snooze` | `moon` |

Play any specific scene with `<SmaranDots scene="trefoil-3d" />`. Choose what auto mode cycles through with `sequence={['pen', 'clock', 'rocket']}`.

## 4. Props

| Prop | Default | |
|---|---|---|
| `scene` | — | a fixed scene; leave out for auto mode |
| `sequence` | 24 everyday shapes | shapes auto mode cycles through (dances are mixed in between) |
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

## 5. How it works

- Every scene returns **three strokes of 40 points** for any moment. A dot is just a stroke whose 40 points coincide (round caps make it a circle).
- Every point is a **critically damped spring**, so position and speed are always continuous. When a shape forms, points further along each line use softer springs, so the line **unrolls out of the dot**. Once formed, the springs stiffen so the shape's own motion stays crisp.
- Dots are matched to the **nearest stroke** (and the stroke direction is chosen) so they take the shortest path.
- **Smear:** fast dots stretch along their direction of travel, like an animator's smear frames.
- **Depth:** 3D scenes project with perspective, and strokes are re-ordered so whatever is in front is drawn in front.
- **Teleport:** a stroke may jump only while it is invisible. That's how portals, respawning stars and infinite loops work without anything visibly jumping.
- **Liquid merge:** an SVG "goo" filter. It thresholds transparency, so strokes that are fading are drawn outside the filter and stay visible.

## 6. Write your own scene

```ts
import { shape, S, P, circle, line, polar, TAU } from './kit';

shape('radar', 'Radar', 'Tech', (t) => [
  S(circle(32, 32, 18), 'primary'),
  S(line([32, 32], polar(18, (360 * t) / 2)), 'accent'),
  P(polar(12, 40), 'accent2', { width: 6 * Math.abs(Math.sin(t * 3)) }),
]),
```

Dances use `dots3(key, name, family, hold, t => [p1, p2, p3])` for position-only moves (smear included), or `motion(...)` with `dot`, `capsule`, `path` and `trio` for full control. Two rules keep everything seamless:

1. A scene must be **continuous in time**. Looping drawings should retract (`drawUndo`) rather than restart.
2. Anything that needs to jump must first fade to **width 0** and set `teleport: true`.

Then run the tests. They check every scene for broken points, off-screen parts, hidden jumps, and smooth switching:

```
npx vitest run src/renderer/components/dots
```
