// Screen border illumination renderer
// Smooth, antialiased, hardware-accelerated Canvas 2D engine
// Zero corner cutting, zero shape warping, dynamic loading motion

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
let lastTimestamp = 0;
let elapsedTime = 0;
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

interface Point {
  x: number;
  y: number;
}

/**
 * Exact rectangular perimeter of the screen.
 * Traces the true outer edges of the monitor without cutting corners or curving inward.
 */
class PerimeterRect {
  width = 0;
  height = 0;
  inset = 1;
  w = 0;
  h = 0;
  totalLength = 0;

  // 4 corner vertices:
  // v0: Top-Left (inset, inset)
  // v1: Top-Right (inset + w, inset)
  // v2: Bottom-Right (inset + w, inset + h)
  // v3: Bottom-Left (inset, inset + h)
  v0: Point = { x: 0, y: 0 };
  v1: Point = { x: 0, y: 0 };
  v2: Point = { x: 0, y: 0 };
  v3: Point = { x: 0, y: 0 };

  // Cumulative distance along the perimeter to each corner
  k0 = 0;
  k1 = 0;
  k2 = 0;
  k3 = 0;
  k4 = 0;

  update(screenW: number, screenH: number, thickness: number) {
    this.width = screenW;
    this.height = screenH;
    // Inset by half-thickness so strokes sit flush inside the window bounds
    this.inset = Math.max(0.5, thickness / 2);

    this.w = Math.max(1, screenW - this.inset * 2);
    this.h = Math.max(1, screenH - this.inset * 2);

    this.v0 = { x: this.inset, y: this.inset };
    this.v1 = { x: this.inset + this.w, y: this.inset };
    this.v2 = { x: this.inset + this.w, y: this.inset + this.h };
    this.v3 = { x: this.inset, y: this.inset + this.h };

    this.k0 = 0;
    this.k1 = this.w; // TR corner
    this.k2 = this.w + this.h; // BR corner
    this.k3 = this.w * 2 + this.h; // BL corner
    this.k4 = this.w * 2 + this.h * 2; // TL corner (end of loop)
    this.totalLength = this.k4;
  }

  getPoint(dist: number): Point {
    if (this.totalLength <= 0) return { x: 0, y: 0 };
    const d = ((dist % this.totalLength) + this.totalLength) % this.totalLength;

    // Edge 0 (Top): from v0 to v1
    if (d < this.k1) {
      return { x: this.v0.x + d, y: this.v0.y };
    }
    // Edge 1 (Right): from v1 to v2
    if (d < this.k2) {
      return { x: this.v1.x, y: this.v1.y + (d - this.k1) };
    }
    // Edge 2 (Bottom): from v2 to v3
    if (d < this.k3) {
      return { x: this.v2.x - (d - this.k2), y: this.v2.y };
    }
    // Edge 3 (Left): from v3 to v0
    return { x: this.v3.x, y: this.v3.y - (d - this.k3) };
  }

  /**
   * If any corner vertex lies strictly between dA and dB, return it.
   * This guarantees that when a micro-segment turns a corner, it traces the exact
   * corner vertex instead of cutting across diagonally and glitching its shape.
   */
  getCornerBetween(dA: number, dB: number): Point | null {
    if (this.totalLength <= 0) return null;
    const L = this.totalLength;
    const a = ((dA % L) + L) % L;
    let b = ((dB % L) + L) % L;
    if (b <= a) b += L; // unroll forward

    const corners = [
      { k: this.k1, pt: this.v1 },
      { k: this.k2, pt: this.v2 },
      { k: this.k3, pt: this.v3 },
      { k: this.k4, pt: this.v0 },
      { k: this.k4 + this.k1, pt: this.v1 },
    ];

    for (const c of corners) {
      if (c.k > a && c.k < b) {
        return c.pt;
      }
    }
    return null;
  }
}

const perimeter = new PerimeterRect();

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
  elapsedTime += dt;

  const L = perimeter.totalLength;
  if (L <= 0) return;

  // ---------- Dynamic "Loading" Rhythm & Kinetics ----------
  // Cycle period: 2.4s per stretch-and-contract surge cycle
  const cyclePeriod = 2.4;
  const cyclePhase = (elapsedTime % cyclePeriod) / cyclePeriod; // 0 to 1

  // Base steady forward drift (circles the entire perimeter in ~5.5 seconds)
  const baseSpeed = L / 5.5;
  const baseTravel = baseSpeed * elapsedTime;

  // Eased surge offset: the head surges forward during the first half of the cycle
  const surgeOffset = (L * 0.07) * Math.sin(cyclePhase * Math.PI * 2 - Math.PI / 2);
  const headDistance = (baseTravel + surgeOffset) % L;

  // Dynamic breathing beam length: stretches long during acceleration, compresses during catch-up
  // Scales smoothly from ~9% of perimeter (compact) up to ~30% of perimeter (surge)
  const minBeamLen = Math.max(160, L * 0.09);
  const maxBeamLen = Math.max(380, L * 0.30);
  const lengthFactor = (1 - Math.cos(cyclePhase * Math.PI * 2)) / 2;
  const beamLength = minBeamLen + (maxBeamLen - minBeamLen) * lengthFactor;

  // Luminescence surge factor: brightness gently breathes with the loading rhythm
  const surgeLuminance = 1 + 0.22 * Math.sin(cyclePhase * Math.PI * 2);

  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const thickness = currentThickness;
  const brightness = (currentBrightness / 100) * surgeLuminance;

  // 1. Draw subtle rectangular perimeter track (crisp, zero square pixels)
  ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.12, 0.05 * brightness)})`;
  ctx.lineWidth = Math.min(1, Math.max(0.5, thickness * 0.3));
  ctx.strokeRect(
    perimeter.v0.x,
    perimeter.v0.y,
    perimeter.w,
    perimeter.h,
  );

  // 2. Sample points along the loading beam
  const steps = 80;
  const samplePoints: { pt: Point; dist: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps; // 0 (tail) to 1 (head)
    const d = headDistance - beamLength * (1 - u);
    samplePoints.push({ pt: perimeter.getPoint(d), dist: d });
  }

  // --- PASS 1: Ambient Glow ---
  // Glow width scales strictly with thickness (at 1px, glow is minimal; at 14px+, glow is wide)
  const glowWidth = thickness <= 2 ? thickness * 1.8 : thickness * 2.6;
  const glowBlur = thickness <= 2 ? thickness * 1.4 : thickness * 2.2;
  ctx.lineWidth = glowWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 3;
  ctx.shadowBlur = glowBlur * brightness;

  for (let i = 0; i < steps; i++) {
    const sA = samplePoints[i];
    const sB = samplePoints[i + 1];
    if (!sA || !sB) continue;

    const u = i / steps;
    const color = sampleColor(u, brightness);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;

    const corner = perimeter.getCornerBetween(sA.dist, sB.dist);
    ctx.beginPath();
    ctx.moveTo(sA.pt.x, sA.pt.y);
    if (corner) {
      ctx.lineTo(corner.x, corner.y); // Turn the exact 90-degree corner
    }
    ctx.lineTo(sB.pt.x, sB.pt.y);
    ctx.stroke();
  }

  // --- PASS 2: Crisp Core Laser Beam ---
  ctx.shadowBlur = Math.min(6, thickness * 1.2);
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 3;

  for (let i = 0; i < steps; i++) {
    const sA = samplePoints[i];
    const sB = samplePoints[i + 1];
    if (!sA || !sB) continue;

    const u = i / steps;
    const color = sampleColor(u, brightness);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;

    const corner = perimeter.getCornerBetween(sA.dist, sB.dist);
    ctx.beginPath();
    ctx.moveTo(sA.pt.x, sA.pt.y);
    if (corner) {
      ctx.lineTo(corner.x, corner.y);
    }
    ctx.lineTo(sB.pt.x, sB.pt.y);
    ctx.stroke();
  }

  // --- PASS 3: Brilliant White-Hot Leading Spark ---
  const sparkStart = Math.floor(steps * 0.92);
  ctx.shadowBlur = Math.max(4, thickness * 1.5);
  ctx.shadowColor = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, thickness * 0.65);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 3;

  for (let i = sparkStart; i < steps; i++) {
    const sA = samplePoints[i];
    const sB = samplePoints[i + 1];
    if (!sA || !sB) continue;

    const corner = perimeter.getCornerBetween(sA.dist, sB.dist);
    ctx.beginPath();
    ctx.moveTo(sA.pt.x, sA.pt.y);
    if (corner) {
      ctx.lineTo(corner.x, corner.y);
    }
    ctx.lineTo(sB.pt.x, sB.pt.y);
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
