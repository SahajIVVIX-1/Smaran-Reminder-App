// Screen border illumination renderer
// Running inside transparent, click-through overlay window

declare global {
  interface Window {
    __borderSetOptions?: (options: { thickness?: number; brightness?: number }) => void;
    __borderFadeIn?: () => void;
    __borderFadeOut?: () => void;
  }
}

const container = document.querySelector<HTMLDivElement>('.border-container');
const root = document.documentElement;

export function setBorderOptions(options: { thickness?: number; brightness?: number }): void {
  if (typeof options.thickness === 'number') {
    root.style.setProperty('--border-thickness', `${options.thickness}px`);
  }
  if (typeof options.brightness === 'number') {
    const factor = options.brightness / 100;
    root.style.setProperty('--border-brightness', factor.toFixed(2));
  }
}

export function borderFadeIn(): void {
  if (!container) return;
  container.classList.remove('is-fading-out');
  void container.offsetWidth; // Force reflow so transition runs
  container.classList.add('is-visible');
}

export function borderFadeOut(): void {
  if (!container) return;
  container.classList.remove('is-visible');
  container.classList.add('is-fading-out');
}

window.__borderSetOptions = setBorderOptions;
window.__borderFadeIn = borderFadeIn;
window.__borderFadeOut = borderFadeOut;
