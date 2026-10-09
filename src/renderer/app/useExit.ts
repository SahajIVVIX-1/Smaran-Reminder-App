import { useEffect, useState } from 'react';

/**
 * Keeps something mounted for `ms` after `show` turns false, so it can play a closing animation.
 * `closing` is true during that time.
 */
export function useExit(show: boolean, ms = 200): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  // Opening is immediate: no effect needed, the state catches up during render.
  if (show && (!mounted || closing)) {
    setMounted(true);
    setClosing(false);
  }
  if (!show && mounted && !closing) setClosing(true);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, ms);
    return () => window.clearTimeout(t);
  }, [closing, ms]);

  return { mounted, closing };
}
