import { useState, type ReactNode } from 'react';
import {} from './ui';
import { cx } from '../cx';

export interface ListItem {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  muted?: boolean;
}

/**
 * Left-hand list with keyboard selection and optional drag-to-reorder.
 * `onMove(fromId, toId)` is called when an item is dropped onto another.
 */
export function ListPane({
  items,
  selectedId,
  onSelect,
  onMove,
  header,
  emptyText,
  label,
}: {
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove?: (fromId: string, toId: string) => void;
  header?: ReactNode;
  emptyText: string;
  label: string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-line bg-panel">
      {header && <div className="border-b border-line p-3">{header}</div>}
      <ul
        className="flex-1 overflow-y-auto p-1.5"
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          const index = items.findIndex((i) => i.id === selectedId);
          const next =
            items[
              Math.min(items.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))
            ];
          if (next) onSelect(next.id);
        }}
      >
        {items.length === 0 && <li className="p-4 text-center text-sm text-muted">{emptyText}</li>}
        {items.map((item) => (
          <li
            key={item.id}
            role="option"
            aria-selected={item.id === selectedId}
            draggable={Boolean(onMove)}
            onDragStart={() => setDragId(item.id)}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(item.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== item.id) onMove?.(dragId, item.id);
              setDragId(null);
              setOverId(null);
            }}
            onClick={() => onSelect(item.id)}
            className={cx(
              'mb-0.5 flex cursor-default items-center gap-2 rounded-md px-2.5 py-2',
              item.id === selectedId ? 'bg-accent/15' : 'hover:bg-raised',
              overId === item.id && dragId !== item.id && 'outline-2 outline-accent',
              item.muted && 'opacity-55',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{item.title}</div>
              {item.subtitle && (
                <div className="mt-0.5 truncate text-xs text-muted">{item.subtitle}</div>
              )}
            </div>
            {item.trailing}
          </li>
        ))}
      </ul>
    </div>
  );
}
