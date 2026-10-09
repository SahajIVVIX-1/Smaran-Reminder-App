import { useLayoutEffect, useRef, useState } from 'react';
import type { MenuInit } from '@shared/menu';
import { MenuPanel } from './MenuPanel';

/** Room around the panel for its shadow; main lines the panel's corner up with the pointer. */
const PAD = 10;

export function MenuRoot({ init, serial }: { init: MenuInit; serial: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState(false);

  // Measure once fonts are ready, then main sizes, places and shows the window.
  useLayoutEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => {
      const r = box.current?.getBoundingClientRect();
      if (live && r) window.smaranMenu.measured(r.width, r.height);
    });
    return () => {
      live = false;
    };
  }, [serial]);

  return (
    <div ref={box} className="absolute top-0 left-0 w-max" style={{ padding: PAD }}>
      <MenuPanel
        key={serial}
        items={init.items}
        className="animate-pop [transform-origin:top_left]"
        onPick={(id) => {
          if (picked) return;
          setPicked(true);
          window.smaranMenu.pick(id);
        }}
      />
    </div>
  );
}
