import { useLayoutEffect, useRef, useState } from 'react';
import type { StyleFields } from '@shared/schema';
import { PopupCard } from '../../ui/PopupCard';

/** Live preview using the real popup card, scaled down to fit when it is too big. */
export function Preview({ text, style }: { text: string; style: StyleFields }) {
  const frame = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const update = () => {
      if (!frame.current || !card.current) return;
      const pad = 32;
      const fw = frame.current.clientWidth - pad;
      const fh = frame.current.clientHeight - pad;
      const cw = card.current.offsetWidth;
      const ch = card.current.offsetHeight;
      setScale(Math.min(1, fw / Math.max(cw, 1), fh / Math.max(ch, 1)));
    };
    update();
    const observer = new ResizeObserver(update);
    if (frame.current) observer.observe(frame.current);
    if (card.current) observer.observe(card.current);
    return () => observer.disconnect();
  }, [text, style]);

  return (
    <div
      ref={frame}
      className="checker relative flex h-48 items-center justify-center overflow-hidden rounded-lg border border-line"
      aria-label="Preview"
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
        <PopupCard ref={card} text={text || ' '} style={style} />
      </div>
      {scale < 1 && (
        <span className="absolute right-2 bottom-1.5 rounded bg-black/50 px-1.5 text-[11px] text-white">
          {Math.round(scale * 100)}%
        </span>
      )}
    </div>
  );
}
