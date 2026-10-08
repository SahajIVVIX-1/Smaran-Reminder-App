/** A soft two-note chime made with Web Audio, so no sound file is needed. */
export function playChime(important: boolean): void {
  try {
    const ctx = new AudioContext();
    const notes = important ? [659.25, 880, 659.25] : [880, 1174.66];
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // No audio device: stay silent.
  }
}
