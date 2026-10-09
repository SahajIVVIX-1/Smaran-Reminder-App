import { create } from 'zustand';
import type { MenuEntry } from '@shared/menu';

export interface OpenMenu {
  x: number;
  y: number;
  items: MenuEntry[];
  onPick: (id: string) => void;
}

export const useMenu = create<{ open: OpenMenu | null }>(() => ({ open: null }));
export const closeMenu = () => useMenu.setState({ open: null });

/** Opens Smaran's right-click menu at the pointer. Call from an onContextMenu handler. */
export function openContextMenu(
  e: { clientX: number; clientY: number; preventDefault(): void },
  items: MenuEntry[],
  onPick: (id: string) => void,
): void {
  e.preventDefault();
  useMenu.setState({ open: { x: e.clientX, y: e.clientY, items, onPick } });
}
