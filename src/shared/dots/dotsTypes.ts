/**
 * Shared types for Smaran dots scenes.
 */
import type { Pt } from './dotsGeometry';

export type ColorToken = 'primary' | 'accent' | 'accent2' | 'alert' | 'success' | 'error';
export const COLOR_TOKENS: readonly ColorToken[] = [
  'primary',
  'accent',
  'accent2',
  'alert',
  'success',
  'error',
];
/** colour each dot keeps while dancing */
export const DOT_IDENTITY: readonly [ColorToken, ColorToken, ColorToken] = [
  'primary',
  'accent',
  'accent2',
];

export const DOT_W = 10;
export const LINE_W = 5;

export interface StrokeTarget {
  /** exactly N points */
  pts: Pt[];
  /** stroke width in the 64×64 box (a dot's diameter when all points coincide); 0 = invisible */
  width: number;
  color: ColorToken;
  /** 0..1, default 1 */
  opacity?: number;
  /** depth for 3D scenes: higher draws in front. default 0 */
  z?: number;
  /**
   * When this stroke is invisible (width ≈ 0) it may jump straight to its
   * target instead of travelling there — used for respawns and portals.
   */
  teleport?: boolean;
}

export type Frame = readonly [StrokeTarget, StrokeTarget, StrokeTarget];

export type SceneKind = 'dance' | 'shape';

export interface DotsScene {
  readonly key: string;
  readonly name: string;
  readonly kind: SceneKind;
  /** family shown in the explorer, e.g. "Orbits & space" */
  readonly category: string;
  /** how long auto mode stays on this scene, seconds */
  readonly hold: number;
  /**
   * "identity": each stroke keeps its own dot colour (default for dances).
   * "slot": colours come from the frame (default for shapes; also used by colour illusions).
   */
  readonly colorBy: 'identity' | 'slot';
  /** t = seconds since the scene started (speed-scaled). Must be continuous in t. */
  readonly frame: (t: number) => Frame;
}
