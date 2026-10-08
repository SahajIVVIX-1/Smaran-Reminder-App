import { useEffect, useRef, useState } from 'react';
import { HexAlphaColorPicker } from 'react-colorful';
import { normaliseColor } from '../color';

/** Swatch + hex box; the swatch opens a picker with an alpha slider. */
export function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  // Follow outside changes to the value (undo, reset, picker) without an effect.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(value);
  }
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={box} className="relative flex items-center gap-2">
      <button
        type="button"
        aria-label={`Pick ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="checker h-8 w-10 overflow-hidden rounded-md border border-line"
      >
        <span className="block h-full w-full" style={{ background: value }} />
      </button>
      <input
        type="text"
        aria-label={label}
        className="h-8 w-28 rounded-md border border-line bg-panel px-2 font-mono text-xs text-ink focus:border-accent focus:outline-none"
        value={text}
        onChange={(e) => {
          setText(e.currentTarget.value);
          const color = normaliseColor(e.currentTarget.value);
          if (color) onChange(color);
        }}
        onBlur={() => setText(value)}
      />
      {open && (
        <div className="absolute top-10 left-0 z-40 rounded-lg border border-line bg-panel p-2 shadow-xl">
          <HexAlphaColorPicker
            color={value}
            onChange={(c) => onChange(normaliseColor(c) ?? value)}
          />
        </div>
      )}
    </div>
  );
}
