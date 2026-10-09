/**
 * Reads the dot colours from CSS variables so the logo always matches the
 * app's theme (light / dark / system). Any CSS colour works: hex (incl.
 * #RRGGBBAA), rgb(), hsl(), named colours, or var(--your-token).
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface LogoPalette {
  primary: Rgba;
  accent: Rgba;
  accent2: Rgba;
  alert: Rgba;
  success: Rgba;
  error: Rgba;
}

export const PALETTE_VARS: Record<keyof LogoPalette, string> = {
  primary: '--smaran-logo-primary',
  accent: '--smaran-logo-accent',
  accent2: '--smaran-logo-accent-2',
  alert: '--smaran-logo-alert',
  success: '--smaran-logo-success',
  error: '--smaran-logo-error',
};

/** used only if a variable is missing or unreadable */
const FALLBACK: LogoPalette = {
  primary: { r: 31, g: 36, b: 48, a: 1 },
  accent: { r: 91, g: 91, b: 214, a: 1 },
  accent2: { r: 245, g: 159, b: 0, a: 1 },
  alert: { r: 232, g: 89, b: 12, a: 1 },
  success: { r: 47, g: 158, b: 68, a: 1 },
  error: { r: 224, g: 49, b: 49, a: 1 },
};

function parseComputedColor(value: string): Rgba | null {
  const v = value.trim();
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(
    v,
  );
  if (rgb) {
    const alphaRaw = rgb[4];
    let a = 1;
    if (alphaRaw) a = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a };
  }
  // newer engines may report wide-gamut colours as color(srgb r g b / a)
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i.exec(v);
  if (srgb) {
    return {
      r: Number(srgb[1]) * 255,
      g: Number(srgb[2]) * 255,
      b: Number(srgb[3]) * 255,
      a: srgb[4] ? Number(srgb[4]) : 1,
    };
  }
  return null;
}

let probe: HTMLSpanElement | null = null;

/** Resolve any CSS colour string to RGBA using the browser's own parser. */
function resolveColor(value: string, host: Element): Rgba | null {
  if (!value) return null;
  const direct = parseComputedColor(value);
  if (direct) return direct;
  if (!probe) {
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  }
  const parent = host.parentElement ?? document.body;
  parent.appendChild(probe);
  probe.style.color = '';
  probe.style.color = value;
  const ok = probe.style.color !== '';
  const computed = ok ? getComputedStyle(probe).color : '';
  probe.remove();
  return ok ? parseComputedColor(computed) : null;
}

export function readPalette(host: Element): LogoPalette {
  const cs = getComputedStyle(host);
  const out = { ...FALLBACK };
  for (const key of Object.keys(PALETTE_VARS) as Array<keyof LogoPalette>) {
    const raw = cs.getPropertyValue(PALETTE_VARS[key]).trim();
    const c = resolveColor(raw, host);
    if (c) out[key] = c;
  }
  return out;
}

export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
    a: a.a + (b.a - a.a) * k,
  };
}

export function toCss(c: Rgba): string {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${c.a.toFixed(3)})`;
}

/**
 * Calls back whenever the theme could have changed: OS light/dark switch, or
 * the app changing class / data-theme / style on <html> or <body>.
 */
export function watchTheme(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (): void => onChange();
  mq.addEventListener('change', handler);
  const mo = new MutationObserver(handler);
  const opts: MutationObserverInit = {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style'],
  };
  mo.observe(document.documentElement, opts);
  if (document.body) mo.observe(document.body, opts);
  return () => {
    mq.removeEventListener('change', handler);
    mo.disconnect();
  };
}
