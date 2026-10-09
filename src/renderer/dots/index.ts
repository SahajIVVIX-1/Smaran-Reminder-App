export { SmaranDots, default } from './SmaranDots';
export type { SmaranDotsProps } from './SmaranDots';
export {
  SCENES,
  DANCES,
  SHAPES,
  DANCE_CATEGORIES,
  SHAPE_CATEGORIES,
  DEFAULT_SEQUENCE,
  getScene,
} from '@shared/dots/dotsScenes';
export type { SceneKey, DanceKey, ShapeKey, DotsScene, ColorToken } from '@shared/dots/dotsScenes';
export { useDotsState, DEFAULT_STATE_SCENES } from './useDotsState';
export type { DotsState, StateScene } from './useDotsState';
export { DotsEngine, AutoDirector } from '@shared/dots/dotsEngine';
