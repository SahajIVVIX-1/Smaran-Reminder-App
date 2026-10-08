import type { Placement } from '@shared/schema';

export type Anchor = Extract<Placement, { kind: 'anchor' }>;

export const DEFAULT_ANCHOR: Anchor = {
  kind: 'anchor',
  anchor: 'top-center',
  offsetX: 0,
  offsetY: 24,
  display: 'primary',
};
