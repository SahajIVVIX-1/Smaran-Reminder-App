// The Smaran bloom: six rounded petals in a turning ring, each its own colour, overlapping at the
// centre. Drawn in a 100 x 100 space; transparent background.
export const PETALS = {
  light: ['#D97757', '#F2A93B', '#3FA27A', '#3E7FD8', '#8A63D2', '#D9608C'],
  dark: ['#E8876A', '#F6B955', '#4FB98C', '#5A95E6', '#9B78E0', '#E5739C'],
};
export const PETAL = { r0: 0, r1: 46, w: 24, tilt: 22, opacity: 0.86 };
/** Petals are a touch more solid on dark backgrounds so the colours don't go muddy. */
export const DARK_OPACITY = 0.93;

function petalRect(i, p, attrs) {
  return (
    `<rect x="${50 - p.w / 2}" y="${50 - p.r1}" width="${p.w}" height="${p.r1 - p.r0}" rx="${p.w / 2}"` +
    ` transform="rotate(${i * 60} 50 50) rotate(${p.tilt} 50 44)" ${attrs}/>`
  );
}

/** Petals with fixed colours. `size` lets small icons use slightly fuller petals. */
export function bloomInner(mode = 'light', p = PETAL) {
  const op = mode === 'dark' ? Math.max(p.opacity, DARK_OPACITY) : p.opacity;
  return PETALS[mode].map((c, i) => petalRect(i, p, `fill="${c}" fill-opacity="${op}"`)).join('');
}

/** Petals that switch palette with prefers-color-scheme. */
export function bloomAdaptive(p = PETAL) {
  const css = (mode) => PETALS[mode].map((c, i) => `.p${i}{fill:${c}}`).join('');
  return (
    `<style>${css('light')}@media (prefers-color-scheme:dark){${css('dark')}}</style>` +
    PETALS.light.map((_, i) => petalRect(i, p, `class="p${i}" fill-opacity="${p.opacity}"`)).join('')
  );
}

/** Small sizes: fuller petals and less see-through, so the colours stay clear at 16-24 px. */
export function petalFor(px) {
  if (px <= 20) return { r0: 0, r1: 48, w: 30, tilt: 20, opacity: 0.94 };
  if (px <= 32) return { r0: 0, r1: 47, w: 27, tilt: 21, opacity: 0.9 };
  return PETAL;
}

export const bloomSvg = (mode, px = 100, p = petalFor(px)) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">${bloomInner(mode, p)}</svg>`;
