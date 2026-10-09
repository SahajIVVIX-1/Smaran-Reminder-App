import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EditCommand } from '@shared/ipc';
import { separator, type MenuEntry } from '@shared/menu';
import { MenuPanel } from '../../menu/MenuPanel';
import { closeMenu, openContextMenu, useMenu, type OpenMenu } from '../contextMenu';
import { useExit } from '../useExit';

type Field = HTMLInputElement | HTMLTextAreaElement;
const TEXT_INPUTS = new Set(['text', 'search', 'url', 'email', 'tel', 'password', 'number', '']);

function editableField(target: EventTarget | null): Field | HTMLElement | null {
  if (target instanceof HTMLTextAreaElement) return target;
  if (target instanceof HTMLInputElement && TEXT_INPUTS.has(target.type)) return target;
  if (target instanceof HTMLElement && target.isContentEditable) return target;
  return null;
}

function editItems(field: Field | HTMLElement): MenuEntry[] {
  const hasSelection =
    field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? (field.selectionStart ?? 0) !== (field.selectionEnd ?? 0)
      : !(window.getSelection()?.isCollapsed ?? true);
  const readOnly =
    (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) &&
    (field.readOnly || field.disabled);
  return [
    { kind: 'item', id: 'undo', label: 'Undo', hint: 'Ctrl+Z', disabled: readOnly },
    { kind: 'item', id: 'redo', label: 'Redo', hint: 'Ctrl+Y', disabled: readOnly },
    separator,
    { kind: 'item', id: 'cut', label: 'Cut', hint: 'Ctrl+X', disabled: readOnly || !hasSelection },
    { kind: 'item', id: 'copy', label: 'Copy', hint: 'Ctrl+C', disabled: !hasSelection },
    { kind: 'item', id: 'paste', label: 'Paste', hint: 'Ctrl+V', disabled: readOnly },
    separator,
    { kind: 'item', id: 'selectAll', label: 'Select all', hint: 'Ctrl+A' },
  ];
}

/**
 * Draws the open right-click menu (one at a time) and gives every text field a themed
 * Cut/Copy/Paste menu. Closes on outside click, Escape, scrolling, resizing and window blur.
 */
export function ContextMenuHost() {
  const open = useMenu((s) => s.open);
  const [shown, setShown] = useState<OpenMenu | null>(open);
  // Keep the last menu on screen while it fades out.
  if (open && open !== shown) setShown(open);
  const { mounted, closing } = useExit(open !== null, 120);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);

  // Text fields get Undo/Cut/Copy/Paste; anything else without its own menu gets none.
  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      const field = editableField(e.target);
      if (!field) return;
      openContextMenu(e, editItems(field), (id) => window.smaran.app.edit(id as EditCommand));
    };
    document.addEventListener('contextmenu', onMenu);
    return () => document.removeEventListener('contextmenu', onMenu);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const p = panel.current;
    if (!p) return;
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const flipX = open.x + w > window.innerWidth - 6;
    const flipY = open.y + h > window.innerHeight - 6;
    setPos({
      left: Math.max(6, flipX ? open.x - w : open.x),
      top: Math.max(6, flipY ? open.y - h : open.y),
      origin: `${flipY ? 'bottom' : 'top'} ${flipX ? 'right' : 'left'}`,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) closeMenu();
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [open]);

  if (!mounted || !shown) return null;
  return createPortal(
    <div
      ref={panel}
      className="fixed z-[80]"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <MenuPanel
        items={shown.items}
        className={closing ? 'pointer-events-none animate-pop-out' : 'animate-pop'}
        style={{ transformOrigin: pos?.origin }}
        onPick={(id) => {
          if (closing) return;
          closeMenu();
          if (id) shown.onPick(id);
        }}
      />
    </div>,
    document.body,
  );
}
