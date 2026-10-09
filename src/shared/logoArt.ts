import type { LogoAnimation } from './logoState';

/** What main asks the hidden logo renderer to draw for the tray and the taskbar button. */
export interface LogoPlay extends LogoAnimation {
  /** Light taskbar: dark S. Dark taskbar: light S. */
  lightTaskbar: boolean;
  /** Pixel sizes to draw (already multiplied by the display scale). */
  traySize: number;
  windowSize: number;
  /** Dance and form a few shapes for a moment before settling (a little hello). */
  flourish?: boolean;
}

export interface LogoFrame {
  tray: Uint8Array;
  window: Uint8Array;
  /** The animation has settled; no more frames until the next play. */
  last: boolean;
}

/** Dot colours for each taskbar. The S line follows the taskbar; the dots keep their colours. */
export const TASKBAR_PALETTES = {
  light: {
    primary: '#1f1e1d',
    accent: '#5b5bd6',
    accent2: '#f59f00',
    alert: '#e8590c',
    success: '#2f9e44',
    error: '#e03131',
  },
  dark: {
    primary: '#f5f4ef',
    accent: '#8b8df8',
    accent2: '#fcc419',
    alert: '#ff922b',
    success: '#51cf66',
    error: '#ff6b6b',
  },
} as const;
