// Screen border illumination renderer
// Smooth, antialiased, hardware-accelerated Canvas 2D engine
// Continuous vector linear gradients, zero micro-segment boxes, dynamic loading motion

declare global {
  interface Window {
    __borderSetOptions?: (options: { thickness?: number; brightness?: number }) => void;
  }
}

const canvas = document.getElementById('border-canvas') as HTMLCanvasElement | null;
const container = document.getElementById('border-container');
const ctx = canvas?.getContext('2d', { alpha: true });

let currentThickness = 3;
let currentBrightness = 150;
let animationFrameId: number | null = null;
let lastTimestamp = 0;
let elapsedTime = 0;
let isAnimating = false;

interface ColorStop {
  pos: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

// Electric neon gradient palette with white-hot leading spark
const COLOR_STOPS: readonly ColorStop[] = [
  { pos: 0.0, r: 139, g: 141, b: 248, a: 0.0 }, // Transparent soft violet tail
  { pos: 0.15, r: 139, g: 141, b: 248, a: 0.45 }, // Electric violet
  { pos: 0.38, r: 66, g: 133, b: 244, a: 0.8 }, // Vivid neon cyan-blue
  { pos: 0.62, r: 52, g: 168, b: 83, a: 0.95 }, // Emerald glow
  { pos: 0.82, r: 251, g: 188, b: 5, a: 1.0 }, // Amber gold
  { pos: 0.94, r: 234, g: 67, b: 53, a: 1.0 }, // Coral crimson
  { pos: 1.0, r: 255, g: 255, b: 255, a: 1.0 }, // Pure white-hot laser head
];

const DEFAULT_STOP: ColorStop = { pos: 0, r: 139, g: 141, b: 248, a: 1.0 };

function sampleColor(u: number, brightnessFactor: number): string {
  const clamped = Math.max(0, Math.min(1, u));
  let s0: ColorStop = COLOR_STOPS[0] ?? DEFAULT_STOP;
  let s1: ColorStop = COLOR_STOPS[COLOR_STOPS.length - 1] ?? DEFAULT_STOP;

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const c0 = COLOR_STOPS[i];
    const c1 = COLOR_STOPS[i + 1];
    if (!c0 || !c1) continue;
    if (clamped >= c0.pos && clamped <= c1.pos) {
      s0 = c0;
      s1 = c1;
      break;
    }
  }

  const range = s1.pos - s0.pos;
  const t = range > 0 ? (clamped - s0.pos) / range : 0;

  const boost = Math.max(1, brightnessFactor);
  const r = Math.min(255, Math.round((s0.r + (s1.r - s0.r) * t) * (1 + (boost - 1) * 0.2)));
  const g = Math.min(255, Math.round((s0.g + (s1.g - s0.g) * t) * (1 + (boost - 1) * 0.2)));
  const b = Math.min(255, Math.round((s0.b + (s1.b - s0.b) * t) * (1 + (boost - 1) * 0.2)));
  const a = Math.min(1.0, (s0.a + (s1.a - s0.a) * t) * Math.min(1.8, boost));

  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

interface Point {
  x: number;
  y: number;
}

interface BeamSegment {
  pStart: Point;
  pEnd: Point;
  uStart: number;
  uEnd: number;
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
   * Decomposes any sub-range [dStart, dEnd] into contiguous straight edge segments.
   * Eliminates all micro-segments and boxes by utilizing native continuous line segments.
   */
  getSegments(dStart: number, dEnd: number): BeamSegment[] {
    const L = this.totalLength;
    if (L <= 0 || dEnd <= dStart) return [];

    let H = ((dEnd % L) + L) % L;
    const len = dEnd - dStart;
    let T = H - len;

    while (T < 0) {
      T += L;
      H += L;
    }

    const baseCorners = [
      { k: this.k1, pt: this.v1 },
      { k: this.k2, pt: this.v2 },
      { k: this.k3, pt: this.v3 },
      { k: this.k4, pt: this.v0 },
    ];

    const splits: { d: number; pt: Point }[] = [];
    for (let lap = 0; lap <= 2; lap++) {
      const offset = lap * L;
      for (const c of baseCorners) {
        const pos = c.k + offset;
        if (pos > T && pos < H) {
          splits.push({ d: pos, pt: c.pt });
        }
      }
    }
    splits.sort((a, b) => a.d - b.d);

    const keyPoints: { d: number; pt: Point }[] = [
      { d: T, pt: this.getPoint(T) },
      ...splits,
      { d: H, pt: this.getPoint(H) },
    ];

    const segments: BeamSegment[] = [];
    const totalDist = H - T;
    if (totalDist <= 0) return [];

    for (let i = 0; i < keyPoints.length - 1; i++) {
      const pA = keyPoints[i];
      const pB = keyPoints[i + 1];
      if (!pA || !pB) continue;

      segments.push({
        pStart: pA.pt,
        pEnd: pB.pt,
        uStart: (pA.d - T) / totalDist,
        uEnd: (pB.d - T) / totalDist,
      });
    }

    return segments;
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

/**
 * Draws a continuous, vector-smooth gradient line segment along a single straight edge.
 * Uses native hardware-accelerated linear gradients to ensure zero box/square artifacts.
 */
function drawEdgeSegment(
  renderCtx: CanvasRenderingContext2D,
  seg: BeamSegment,
  width: number,
  brightness: number,
  shadowBlur: number,
  overrideColor?: string,
) {
  const dx = seg.pEnd.x - seg.pStart.x;
  const dy = seg.pEnd.y - seg.pStart.y;
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return;

  renderCtx.lineWidth = width;
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'miter';
  renderCtx.miterLimit = 3;

  if (overrideColor) {
    renderCtx.strokeStyle = overrideColor;
    if (shadowBlur > 0) {
      renderCtx.shadowBlur = shadowBlur;
      renderCtx.shadowColor = overrideColor;
    } else {
      renderCtx.shadowBlur = 0;
    }
  } else {
    const du = seg.uEnd - seg.uStart;
    if (du <= 0) return;

    const grad = renderCtx.createLinearGradient(
      seg.pStart.x,
      seg.pStart.y,
      seg.pEnd.x,
      seg.pEnd.y,
    );

    grad.addColorStop(0, sampleColor(seg.uStart, brightness));

    for (const stop of COLOR_STOPS) {
      if (stop.pos > seg.uStart && stop.pos < seg.uEnd) {
        const t = (stop.pos - seg.uStart) / du;
        if (t > 0 && t < 1) {
          grad.addColorStop(t, sampleColor(stop.pos, brightness));
        }
      }
    }

    grad.addColorStop(1, sampleColor(seg.uEnd, brightness));
    renderCtx.strokeStyle = grad;

    if (shadowBlur > 0) {
      renderCtx.shadowBlur = shadowBlur;
      renderCtx.shadowColor = sampleColor((seg.uStart + seg.uEnd) / 2, brightness);
    } else {
      renderCtx.shadowBlur = 0;
    }
  }

  renderCtx.beginPath();
  renderCtx.moveTo(seg.pStart.x, seg.pStart.y);
  renderCtx.lineTo(seg.pEnd.x, seg.pEnd.y);
  renderCtx.stroke();
}

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

  // Steady forward drift (circles the entire screen perimeter in ~5.2 seconds)
  const baseSpeed = L / 5.2;
  const baseTravel = baseSpeed * elapsedTime;

  // Eased surge offset: head surges forward during the acceleration half of the cycle
  const surgeOffset = (L * 0.065) * Math.sin(cyclePhase * Math.PI * 2 - Math.PI / 2);
  const headDistance = (baseTravel + surgeOffset) % L;

  // Dynamic breathing beam length: stretches long during acceleration, compresses during catch-up
  // Scales smoothly from ~9% of perimeter (compact) up to ~24% of perimeter (surge)
  const minBeamLen = Math.max(160, L * 0.09);
  const maxBeamLen = Math.max(340, L * 0.24);
  const lengthFactor = (1 - Math.cos(cyclePhase * Math.PI * 2)) / 2;
  const beamLength = minBeamLen + (maxBeamLen - minBeamLen) * lengthFactor;

  // Luminescence surge factor: brightness gently breathes with the loading rhythm
  const surgeLuminance = 1 + 0.20 * Math.sin(cyclePhase * Math.PI * 2);

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

  // 2. Decompose the loading beam into continuous straight edge segments
  const tailDistance = headDistance - beamLength;
  const segments = perimeter.getSegments(tailDistance, headDistance);

  // --- PASS 1: Ambient Neon Glow ---
  // Drawn as continuous straight vectors with hardware shadow blur
  const glowWidth = thickness <= 2 ? thickness * 1.8 : thickness * 2.6;
  const glowBlur = thickness <= 2 ? thickness * 1.4 : thickness * 2.2;
  for (const seg of segments) {
    drawEdgeSegment(ctx, seg, glowWidth, brightness, glowBlur * brightness);
  }

  // --- PASS 2: Crisp Core Laser Beam ---
  // Zero internal micro-segment cuts, perfectly smooth gradient
  for (const seg of segments) {
    drawEdgeSegment(ctx, seg, thickness, brightness, Math.min(6, thickness * 1.2));
  }

  // --- PASS 3: Brilliant White-Hot Leading Spark ---
  // Smoothly highlights the front 9% tip of the beam with white radiance
  const sparkStartDist = headDistance - beamLength * 0.09;
  const sparkSegments = perimeter.getSegments(sparkStartDist, headDistance);
  const sparkWidth = Math.max(1, thickness * 0.7);
  const sparkBlur = Math.max(4, thickness * 1.5);
  for (const seg of sparkSegments) {
    drawEdgeSegment(ctx, seg, sparkWidth, brightness, sparkBlur, '#ffffff');
  }

  // Seamless Corner Fill: if segments meet at a 90-degree corner, seal the vertex cleanly
  if (segments.length > 1) {
    for (let i = 0; i < segments.length - 1; i++) {
      const sA = segments[i];
      if (!sA) continue;
      const cornerColor = sampleColor(sA.uEnd, brightness);
      ctx.fillStyle = cornerColor;
      ctx.shadowColor = cornerColor;
      ctx.shadowBlur = Math.min(4, thickness);
      ctx.beginPath();
      ctx.arc(sA.pEnd.x, sA.pEnd.y, thickness / 2, 0, Math.PI * 2);
      ctx.fill();
    }
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
