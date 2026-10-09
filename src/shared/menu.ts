import { z } from 'zod';
import type { CustomFont } from './fonts';

/** One row of a Smaran right-click menu. The same menu design is used everywhere. */
export type MenuEntry =
  | {
      kind: 'item';
      id: string;
      label: string;
      /** Shortcut shown on the right, e.g. "Ctrl+C". */
      hint?: string;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
    }
  | { kind: 'separator' }
  | { kind: 'heading'; label: string };

export const MenuEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('item'),
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(120),
    hint: z.string().max(24).optional(),
    danger: z.boolean().optional(),
    disabled: z.boolean().optional(),
    checked: z.boolean().optional(),
  }),
  z.object({ kind: z.literal('separator') }),
  z.object({ kind: z.literal('heading'), label: z.string().min(1).max(120) }),
]);
export const MenuEntriesSchema = z.array(MenuEntrySchema).min(1).max(40);
export const MenuPickSchema = z.string().max(64).nullable();

/** What the menu window needs to draw a menu. */
export interface MenuInit {
  items: MenuEntry[];
  theme: 'dark' | 'light';
  font: string;
  faces: CustomFont[];
}

export const separator: MenuEntry = { kind: 'separator' };
