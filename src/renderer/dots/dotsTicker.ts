/**
 * One shared requestAnimationFrame loop for every logo on screen.
 * It stops by itself when nothing is subscribed, and the browser pauses it
 * when the window is hidden, so it costs nothing in the tray.
 */

type Tick = (dtSeconds: number) => void;

const subscribers = new Set<Tick>();
let frame = 0;
let last = 0;

function run(now: number): void {
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  for (const tick of subscribers) tick(dt);
  if (subscribers.size > 0) {
    frame = requestAnimationFrame(run);
  } else {
    frame = 0;
    last = 0;
  }
}

export function subscribeTick(tick: Tick): () => void {
  subscribers.add(tick);
  if (!frame) {
    last = 0;
    frame = requestAnimationFrame(run);
  }
  return () => {
    subscribers.delete(tick);
  };
}
