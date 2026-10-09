/**
 * Draws a DotsEngine into three SVG <path> elements. Shared by the React
 * component and the standalone explorer page.
 */
import { mix, toCss, type LogoPalette, type Rgba } from './dotsColors';
import { N } from '@shared/dots/dotsGeometry';
import type { DotsEngine } from '@shared/dots/dotsEngine';
import { COLOR_TOKENS } from '@shared/dots/dotsTypes';

const STROKES = 3;
const cache = new WeakMap<Element, Map<string, string>>();

/** set an attribute only when its value changed */
export function setAttr(el: Element | undefined, attr: string, value: string): void {
  if (!el) return;
  let m = cache.get(el);
  if (!m) {
    m = new Map();
    cache.set(el, m);
  }
  if (m.get(attr) === value) return;
  m.set(attr, value);
  el.setAttribute(attr, value);
}

export function strokeColor(weights: Float64Array | undefined, pal: LogoPalette): Rgba {
  let out: Rgba = pal.primary;
  let total = 0;
  if (!weights) return out;
  COLOR_TOKENS.forEach((token, i) => {
    const w = weights[i] ?? 0;
    if (w <= 0.001) return;
    total += w;
    out = total === w ? pal[token] : mix(out, pal[token], w / total);
  });
  return out;
}

const homes = new WeakMap<SVGPathElement, Node>();

/**
 * paths: the three <path data-stroke> elements, indexed by stroke.
 * They are re-ordered in the DOM when depth order changes, so 3D scenes overlap correctly.
 *
 * plain (optional): a group drawn *without* the liquid filter. The liquid
 * filter thresholds transparency, which would erase faint strokes, so any
 * stroke that is fading is moved there while it is see-through.
 */
export function renderDots(
  paths: SVGPathElement[],
  engine: DotsEngine,
  pal: LogoPalette,
  plain?: SVGGElement | null,
): void {
  for (let s = 0; s < STROKES; s++) {
    const el = paths[s];
    if (!el) continue;
    let d = '';
    for (let k = 0; k < N; k++) {
      const i = (s * N + k) * 2;
      d += `${k ? 'L' : 'M'}${(engine.pos[i] ?? 32).toFixed(2)} ${(engine.pos[i + 1] ?? 32).toFixed(2)}`;
    }
    const width = Math.max(0, engine.width[s] ?? 5);
    setAttr(el, 'd', d);
    setAttr(el, 'stroke-width', width < 0.05 ? '0' : width.toFixed(2));
    setAttr(el, 'stroke', toCss(strokeColor(engine.color[s], pal)));
    const o = Math.min(1, Math.max(0, engine.opacity[s] ?? 1));
    setAttr(el, 'opacity', o.toFixed(3));
  }

  // which group each stroke belongs in, then depth order within each group
  const order = [0, 1, 2].sort((a, b) => (engine.z[a] ?? 0) - (engine.z[b] ?? 0));
  const groups = new Map<Node, SVGPathElement[]>();
  for (const s of order) {
    const el = paths[s];
    if (!el) continue;
    let home = homes.get(el);
    if (!home && el.parentNode) {
      home = el.parentNode;
      homes.set(el, home);
    }
    if (!home) continue;
    const faint = plain && (engine.opacity[s] ?? 1) < 0.98;
    const target: Node = faint ? plain : home;
    const list = groups.get(target) ?? [];
    list.push(el);
    groups.set(target, list);
  }
  for (const [parent, wanted] of groups) {
    const current = Array.from((parent as Element).children).filter((c) =>
      wanted.includes(c as SVGPathElement),
    );
    const same =
      current.length === wanted.length &&
      wanted.every((el, i) => current[i] === el && el.parentNode === parent);
    if (!same) for (const el of wanted) parent.appendChild(el);
  }
}
