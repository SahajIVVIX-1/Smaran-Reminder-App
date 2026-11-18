// Screen border illumination renderer
// Smooth, antialiased, hardware-accelerated Canvas 2D engine
// Zero pixelation, zero square blocks, true thin-to-thick scaling

declare global {
  interface Window {
    __borderSetOptions?: (options: { thickness?: number; brightness?: number }) => void;
    __borderFadeIn?: () => void;
    __borderFadeOut?: () => void;
  }
}

const container = document.querySelector<HTMLDivElement>('.border-container');
const canvas = document.querySelector<HTMLCanvasElement>('#border-canvas');
const ctx = canvas?.getContext('2d', { alpha: true });

let currentThickness = 3;
let currentBrightness = 150;
let animationFrameId: number | null = null;
let headDistance = 0;
let lastTimestamp = 0;
let isAnimating = false;

interface ColorStop {
  stop: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

const COLOR_STOPS: ColorStop[] = [
  { stop: 0.0, r: 0, g: 240, b: 255, a: 0.0 }, // Tail fades seamlessly to 0 opacity
  { stop: 0.12, r: 0, g: 240, b: 255, a: 0.85 }, // Electric Cyan
  { stop: 0.35, r: 0, g: 110, b: 255, a: 1.0 }, // Vivid Blue
  { stop: 0.6, r: 255, g: 23, b: 85, a: 1.0 }, // Neon Coral / Magenta
  { stop: 0.82, r: 255, g: 184, b: 0, a: 1.0 }, // Sunburst Amber
  { stop: 0.94, r: 0, g: 230, b: 118, a: 1.0 }, // Vivid Emerald
  { stop: 1.0, r: 255, g: 255, b: 255, a: 1.0 }, // White-hot Spark Core
];

const DEFAULT_STOP: ColorStop = { stop: 0.0, r: 0, g: 240, b: 255, a: 0.0 };

function sampleColor(u: number, brightnessFactor: number): string {
  const t = Math.max(0, Math.min(1, u));
  let i = 0;
  while (i < COLOR_STOPS.length - 1 && (COLOR_STOPS[i + 1]?.stop ?? 1) < t) {
    i++;
  }
  const s0 = COLOR_STOPS[i] ?? DEFAULT_STOP;
  const s1 = COLOR_STOPS[i + 1] ?? s0;
  const f = s1.stop === s0.stop ? 0 : (t - s0.stop) / (s1.stop - s0.stop);

  const boost = Math.min(1.35, brightnessFactor);
  const r = Math.min(255, Math.round((s0.r + (s1.r - s0.r) * f) * boost));
  const g = Math.min(255, Math.round((s0.g + (s1.g - s0.g) * f) * boost));
  const b = Math.min(255, Math.round((s0.b + (s1.b - s0.b) * f) * boost));
  const a = Math.min(
    1,
    (s0.a + (s1.a - s0.a) * f) * (brightnessFactor >= 1.5 ? 1 : Math.max(0.7, brightnessFactor)),
  );

  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

interface PerimeterPoint {
  x: number;
  y: number;
}

class PerimeterPath {
  private width = 0;
  private height = 0;
  private radius = 8;
  private inset = 2;
  totalLength = 0;

  private l1 = 0;
  private l2 = 0;
  private l3 = 0;
  private l4 = 0;
  private l5 = 0;
  private l6 = 0;
  private l7 = 0;
  private l8 = 0;

  update(w: number, h: number, thickness: number) {
    this.width = w;
    this.height = h;
    // Inset perimeter by half thickness so the stroke never clips outside screen bounds
    this.inset = Math.max(0.5, thickness / 2);
    // Smooth corner radius to avoid sharp square turns
    this.radius = Math.max(6, Math.min(14, thickness * 2));

    const effW = Math.max(1, w - this.inset * 2);
    const effH = Math.max(1, h - this.inset * 2);
    const r = Math.min(this.radius, effW / 2, effH / 2);
    this.radius = r;

    const arcLen = (Math.PI / 2) * r;
    this.l1 = effW - r * 2; // top
    this.l2 = arcLen; // TR
    this.l3 = effH - r * 2; // right
    this.l4 = arcLen; // BR
    this.l5 = effW - r * 2; // bottom
    this.l6 = arcLen; // BL
    this.l7 = effH - r * 2; // left
    this.l8 = arcLen; // TL

    this.totalLength = this.l1 + this.l2 + this.l3 + this.l4 + this.l5 + this.l6 + this.l7 + this.l8;
  }

  getPoint(dist: number): PerimeterPoint {
    if (this.totalLength <= 0) return { x: 0, y: 0 };
    const d = ((dist % this.totalLength) + this.totalLength) % this.totalLength;
    const r = this.radius;
    const ins = this.inset;
    const w = this.width - ins * 2;
    const h = this.height - ins * 2;

    // 1. Top edge: from (ins + r, ins) to (ins + w - r, ins)
    if (d <= this.l1) {
      return { x: ins + r + d, y: ins };
    }
    // 2. Top-Right Arc: center (ins + w - r, ins + r), angle from -PI/2 to 0
    let rem = d - this.l1;
    if (rem <= this.l2) {
      const angle = -Math.PI / 2 + rem / r;
      return { x: ins + w - r + r * Math.cos(angle), y: ins + r + r * Math.sin(angle) };
    }
    // 3. Right edge: from (ins + w, ins + r) to (ins + w, ins + h - r)
    rem -= this.l2;
    if (rem <= this.l3) {
      return { x: ins + w, y: ins + r + rem };
    }
    // 4. Bottom-Right Arc: center (ins + w - r, ins + h - r), angle from 0 to PI/2
    rem -= this.l3;
    if (rem <= this.l4) {
      const angle = rem / r;
      return { x: ins + w - r + r * Math.cos(angle), y: ins + h - r + r * Math.sin(angle) };
    }
    // 5. Bottom edge: from (ins + w - r, ins + h) to (ins + r, ins + h)
    rem -= this.l4;
    if (rem <= this.l5) {
      return { x: ins + w - r - rem, y: ins + h };
    }
    // 6. Bottom-Left Arc: center (ins + r, ins + h - r), angle from PI/2 to PI
    rem -= this.l5;
    if (rem <= this.l6) {
      const angle = Math.PI / 2 + rem / r;
      return { x: ins + r + r * Math.cos(angle), y: ins + h - r + r * Math.sin(angle) };
    }
    // 7. Left edge: from (ins, ins + h - r) to (ins, ins + r)
    rem -= this.l6;
    if (rem <= this.l7) {
      return { x: ins, y: ins + h - r - rem };
    }
    // 8. Top-Left Arc: center (ins + r, ins + r), angle from PI to 3*PI/2
    rem -= this.l7;
    const angle = Math.PI + rem / r;
    return { x: ins + r + r * Math.cos(angle), y: ins + r + r * Math.sin(angle) };
  }
}

const perimeter = new PerimeterPath();

function resizeCanvas() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  perimeter.update(w, h, currentThickness);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawFrame(timestamp: number) {
  if (!ctx || !canvas) return;

  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  // Move beam around perimeter smoothly (750 pixels per second)
  const speed = 750;
  if (perimeter.totalLength > 0) {
    headDistance = (headDistance + speed * dt) % perimeter.totalLength;
  }

  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const thickness = currentThickness;
  const brightness = currentBrightness / 100;

  // 1. Draw subtle hairline edge track (crisp, zero square pixels)
  ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.15, 0.06 * brightness)})`;
  ctx.lineWidth = Math.min(1, Math.max(0.5, thickness * 0.3));
  ctx.beginPath();
  const trackInset = Math.max(0.5, thickness / 2);
  const trackR = Math.max(4, Math.min(10, thickness * 1.5));
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(
      trackInset,
      trackInset,
      window.innerWidth - trackInset * 2,
      window.innerHeight - trackInset * 2,
      trackR,
    );
  } else {
    ctx.rect(
      trackInset,
      trackInset,
      window.innerWidth - trackInset * 2,
      window.innerHeight - trackInset * 2,
    );
  }
  ctx.stroke();

  // 2. Draw animated light beam
  const beamLength = Math.max(350, perimeter.totalLength * 0.22);
  const steps = 80; // 80 smooth micro-segments

  const points: PerimeterPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps; // 0 (tail) to 1 (head)
    const d = headDistance - beamLength * (1 - u);
    points.push(perimeter.getPoint(d));
  }

  // --- PASS 1: Ambient Glow ---
  // Glow width scales strictly with thickness
  // At 1px, glow is minimal (only 2px wide); at 14px+, glow is wide
  const glowWidth = thickness <= 2 ? thickness * 1.8 : thickness * 2.6;
  const glowBlur = thickness <= 2 ? thickness * 1.4 : thickness * 2.2;
  ctx.lineWidth = glowWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = glowBlur * brightness;

  for (let i = 0; i < steps; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (!p0 || !p1) continue;
    const u = i / steps;
    const color = sampleColor(u, brightness);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  // --- PASS 2: Crisp Core Laser Beam ---
  ctx.shadowBlur = Math.min(6, thickness * 1.2);
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < steps; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (!p0 || !p1) continue;
    const u = i / steps;
    const color = sampleColor(u, brightness);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  // --- PASS 3: Brilliant White-Hot Leading Spark ---
  const sparkStart = Math.floor(steps * 0.92);
  ctx.shadowBlur = Math.max(4, thickness * 1.5);
  ctx.shadowColor = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, thickness * 0.65);
  ctx.lineCap = 'round';

  for (let i = sparkStart; i < steps; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (!p0 || !p1) continue;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  ctx.restore();

  if (isAnimating) {
    animationFrameId = requestAnimationFrame(drawFrame);
  }
}

function startAnimation() {
  if (isAnimating) return;
  isAnimating = true;
  lastTimestamp = 0;
  animationFrameId = requestAnimationFrame(drawFrame);
}

function stopAnimation() {
  isAnimating = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

export function setBorderOptions(options: { thickness?: number; brightness?: number }): void {
  if (typeof options.thickness === 'number' && options.thickness > 0) {
    currentThickness = options.thickness;
    perimeter.update(window.innerWidth, window.innerHeight, currentThickness);
  }
  if (typeof options.brightness === 'number' && options.brightness > 0) {
    currentBrightness = options.brightness;
  }
}

export function borderFadeIn(): void {
  startAnimation();
  if (!container) return;
  container.classList.remove('is-fading-out');
  void container.offsetWidth; // Force reflow
  container.classList.add('is-visible');
}

export function borderFadeOut(): void {
  if (!container) return;
  container.classList.remove('is-visible');
  container.classList.add('is-fading-out');
  setTimeout(() => {
    if (container && !container.classList.contains('is-visible')) {
      stopAnimation();
    }
  }, 400);
}

window.__borderSetOptions = setBorderOptions;
window.__borderFadeIn = borderFadeIn;
window.__borderFadeOut = borderFadeOut;
