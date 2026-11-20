# Vector Dots Brandmark & Animation Engine

## 1. Engine Overview

Smaran features a custom mathematical vector graphics engine (`src/shared/dots/`) that renders animated vector dot constellations into HTML5 `<canvas>` and `<svg>` elements at a locked **60 frames per second**:
- **Geometry Core (`dotsGeometry.ts`):** Calculates 2D point transformations, parametric splines, easing functions, and polar coordinates.
- **Scene Library (`dotsScenes.ts`):** Contains dozens of hand-choreographed mathematical animations categorized by family:
  - `dance`: Organic flowing human-like movements.
  - `nature`: Birds, mountains, trees, water ripples, sunrises.
  - `physics`: Pendulums, orbital mechanics, planetary gravity, elastic springs.
  - `mech`: Gears, clock escapements, pistons, mechanical switches.
  - `space`: Galaxies, satellites, constellations.
  - `illusion`: Moiré interference patterns, optical rotations.

---

## 2. Liquid Merging Algorithm (`settings.logo.liquid`)

When multiple vector dots pass near one another, the engine computes an organic metaball-style blend:
1. Calculates Euclidean distance $d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$.
2. If $d < R_1 + R_2$, applies a cubic Hermite polynomial blend curve to bridge the outer contours.
3. Renders the resulting continuous path onto the canvas context with sub-pixel anti-aliasing.

---

## 3. Interactive Response & System State Feedback

- **Mouse Interaction (`settings.logo.interactive`):**
  - Hovering over the dots gently inflates point radii (`grow`).
  - Pressing the mouse squeezes points tangentially.
  - Clicking triggers an outward shockwave dispersal before snapping back into formation.
- **Reactive State Sync (`settings.logo.reactToReminders`):**
  - When a reminder is due, the dots morph into a ringing bell shape.
  - When the user clicks `Done`, the dots celebrate with a checkmark morph.
  - When Smaran is paused or in quiet hours, the dots gently transition into a sleeping crescent moon.
