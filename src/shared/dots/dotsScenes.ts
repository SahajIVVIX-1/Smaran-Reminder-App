/**
 * Registry of every Smaran dots scene.
 *
 *  - Dances: three dots (sometimes with a line or two) moving around each other.
 *  - Shapes: the dots flow into a three-stroke drawing that keeps moving.
 *
 * Scenes live in ./scenes/, grouped by family. Every scene is a pure,
 * continuous function of time; the engine makes switching between any two
 * of them smooth.
 */
import { CHOREO_DANCES } from './scenes/dances-dance';
import { ILLUSION_DANCES } from './scenes/dances-illusion';
import { LOADER_DANCES } from './scenes/dances-loaders';
import { MECH_DANCES } from './scenes/dances-mech';
import { NATURE_DANCES } from './scenes/dances-nature';
import { PHYSICS_DANCES } from './scenes/dances-physics';
import { SPACE_DANCES } from './scenes/dances-space';
import { SPORT_DANCES } from './scenes/dances-sport';
import { SHAPES_A } from './scenes/shapes-a';
import { SHAPES_B } from './scenes/shapes-b';
import { SHAPES_C } from './scenes/shapes-c';
import { SHAPES_D } from './scenes/shapes-d';
import type { DotsScene } from './dotsTypes';

export { COLOR_TOKENS, DOT_IDENTITY, DOT_W, LINE_W } from './dotsTypes';
export type { ColorToken, DotsScene, Frame, SceneKind, StrokeTarget } from './dotsTypes';

const DANCE_LIST = [
  ...LOADER_DANCES,
  ...CHOREO_DANCES,
  ...ILLUSION_DANCES,
  ...SPACE_DANCES,
  ...PHYSICS_DANCES,
  ...NATURE_DANCES,
  ...SPORT_DANCES,
  ...MECH_DANCES,
] as const;

const SHAPE_LIST = [...SHAPES_D, ...SHAPES_A, ...SHAPES_B, ...SHAPES_C] as const;

export type DanceKey = (typeof DANCE_LIST)[number]['key'];
export type ShapeKey = (typeof SHAPE_LIST)[number]['key'];
export type SceneKey = DanceKey | ShapeKey;

export const DANCES: readonly DotsScene[] = DANCE_LIST;
export const SHAPES: readonly DotsScene[] = SHAPE_LIST;
export const SCENES: readonly DotsScene[] = [...DANCES, ...SHAPES];

/** families in display order */
export const DANCE_CATEGORIES: readonly string[] = [...new Set(DANCES.map((s) => s.category))];
export const SHAPE_CATEGORIES: readonly string[] = [...new Set(SHAPES.map((s) => s.category))];

const BY_KEY = new Map(SCENES.map((s) => [s.key, s]));

export function getScene(key: SceneKey | string): DotsScene {
  const s = BY_KEY.get(key) ?? BY_KEY.get('s-mark');
  if (!s) throw new Error('Smaran dots: missing default scene');
  return s;
}

/** everyday shapes auto mode cycles through (state shapes like bell-ring/cross are left out) */
export const DEFAULT_SEQUENCE: readonly SceneKey[] = [
  's-mark',
  'pen',
  'bell',
  'clock',
  'check',
  'heart',
  'envelope',
  'calendar',
  'bulb',
  'sparkle',
  'hourglass',
  'moon',
  'paper-plane',
  'coffee',
  'rocket',
  'music-note',
  'sun',
  'flower',
  'infinity',
  'globe',
  'gift',
  'eye',
  'wifi',
  'chat-typing',
];
