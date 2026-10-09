// Hidden page that animates the Smaran dots for the tray and the taskbar button. It runs the same
// spring engine as the title-bar logo, draws each frame to small canvases and hands the PNGs to
// main, which swaps them into the notification-area icon (Shell_NotifyIcon).
import { AutoDirector, DotsEngine } from '@shared/dots/dotsEngine';
import { N } from '@shared/dots/dotsGeometry';
import { COLOR_TOKENS, DEFAULT_SEQUENCE, getScene } from '@shared/dots/dotsScenes';
import { TASKBAR_PALETTES, type LogoPlay } from '@shared/logoArt';

const FLOURISH_MS = 9000;
/** A still picture is sent once nothing has moved much for this long. */
const SETTLE_MS = 500;
const SETTLE_SPEED = 2;
const MAX_STILL_MS = 4000;

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;

const engine = new DotsEngine(getScene('s-mark'));
let play: LogoPlay | null = null;
let timer = 0;
let last = 0;
let startedAt = 0;
let calmSince = 0;
let director: AutoDirector | null = null;
let flourishUntil = 0;

function strokeColor(weights: Float64Array | undefined, palette: Record<string, string>): string {
  const out: Rgb = [0, 0, 0];
  let total = 0;
  COLOR_TOKENS.forEach((token, i) => {
    const w = weights?.[i] ?? 0;
    if (w <= 0.001) return;
    const c = hex(palette[token] ?? '#808080');
    total += w;
    for (let k = 0; k < 3; k++) out[k] = (out[k] ?? 0) + (c[k] ?? 0) * w;
  });
  if (total === 0) return palette['primary'] ?? '#808080';
  return `rgb(${out.map((v) => Math.round(v / total)).join(',')})`;
}

/** Draws the three strokes. Small icons zoom in a little and thicken lines so they stay legible. */
async function draw(size: number, shownAt = size): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx || !play) return new Uint8Array();
  const palette = play.lightTaskbar ? TASKBAR_PALETTES.light : TASKBAR_PALETTES.dark;
  const zoom = 1.12;
  const k = (size / 64) * zoom;
  // Line weight follows the size the icon is shown at, not the size it is drawn at.
  const boost = shownAt <= 20 ? 1.6 : shownAt <= 32 ? 1.35 : 1.15;
  ctx.setTransform(k, 0, 0, k, size / 2 - 32 * k, size / 2 - 32 * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.imageSmoothingQuality = 'high';
  // Back to front, so 3D scenes overlap correctly; invisible strokes are skipped.
  const order = [0, 1, 2].sort((a, b) => (engine.z[a] ?? 0) - (engine.z[b] ?? 0));
  for (const s of order) {
    const width = engine.width[s] ?? 5;
    const alpha = Math.min(1, Math.max(0, engine.opacity[s] ?? 1));
    if (width < 0.05 || alpha < 0.01) continue;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let p = 0; p < N; p++) {
      const i = (s * N + p) * 2;
      const x = engine.pos[i] ?? 32;
      const y = engine.pos[i + 1] ?? 32;
      if (p === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = width * boost;
    ctx.strokeStyle = strokeColor(engine.color[s], palette);
    ctx.stroke();
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

function maxSpeed(): number {
  let m = 0;
  for (let i = 0; i < engine.vel.length; i += 2)
    m = Math.max(m, Math.hypot(engine.vel[i] ?? 0, engine.vel[i + 1] ?? 0));
  return m;
}

function stop(): void {
  if (timer) window.clearInterval(timer);
  timer = 0;
}

async function tick(): Promise<void> {
  const current = play;
  if (!current) return;
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;

  if (director) {
    if (now < flourishUntil) {
      const next = director.step(Math.min(dt, 0.1));
      if (next) engine.setScene(getScene(next));
    } else {
      director = null;
      engine.setScene(getScene(current.scene));
      startedAt = now;
      calmSince = 0;
    }
  }
  engine.step(dt);

  let done = false;
  if (!current.loop && !director) {
    const calm = maxSpeed() < SETTLE_SPEED && now - startedAt > 800;
    calmSince = calm ? calmSince || now : 0;
    done = (calmSince > 0 && now - calmSince > SETTLE_MS) || now - startedAt > MAX_STILL_MS;
  }
  if (done) stop();
  const tray = await draw(current.traySize);
  // A newer play may have started while this frame was drawing.
  if (play === current) window.smaranLogo.frame({ tray, last: done });
}

window.smaranLogo.onPlay((next) => {
  stop();
  play = next;
  last = performance.now();
  startedAt = last;
  calmSince = 0;
  if (next.flourish) {
    director = new AutoDirector(DEFAULT_SEQUENCE.filter((k) => k !== 's-mark'));
    flourishUntil = last + FLOURISH_MS;
    engine.setScene(getScene(director.current));
  } else {
    director = null;
    engine.setScene(getScene(next.scene));
  }
  timer = window.setInterval(() => void tick(), Math.round(1000 / Math.max(1, next.fps)));
  void tick();
});
