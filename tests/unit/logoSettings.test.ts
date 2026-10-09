import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/defaults';
import { AutoDirector } from '@shared/dots/dotsEngine';
import { DANCES, DEFAULT_SEQUENCE, getScene, SHAPES } from '@shared/dots/dotsScenes';
import { shapesIn } from '@shared/logoSettings';
import { SettingsSchema } from '@shared/schema';

describe('logo settings', () => {
  it('defaults to auto mode, with the tray touring Science & symbols', () => {
    expect(SettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(DEFAULT_SETTINGS.logo.mode).toBe('auto');
    expect(DEFAULT_SETTINGS.logo.tray.families).toEqual(['Science & symbols']);
  });

  it('lists the shapes in the chosen families, or the everyday set', () => {
    const sci = shapesIn(['Science & symbols']);
    expect(sci.length).toBeGreaterThan(5);
    expect(sci.every((k) => getScene(k).category === 'Science & symbols')).toBe(true);
    expect(shapesIn([])).toEqual([...DEFAULT_SEQUENCE]);
    expect(shapesIn(['Not a family'])).toEqual([...DEFAULT_SEQUENCE]);
    expect(SHAPES.length).toBeGreaterThan(100);
  });

  it('goes shape to shape without dances when asked', () => {
    const shapes = shapesIn(['Science & symbols']);
    const d = new AutoDirector(shapes, { dances: false });
    const seen: string[] = [d.current];
    for (let i = 0; i < 400 && seen.length < 4; i++) {
      const next = d.step(0.1);
      if (next) seen.push(next);
    }
    expect(seen.every((k) => shapes.includes(k as (typeof shapes)[number]))).toBe(true);
    const dancing = new AutoDirector(shapes);
    let next: string | null = null;
    for (let i = 0; i < 400 && !next; i++) next = dancing.step(0.1);
    expect(DANCES.some((s) => s.key === next)).toBe(true);
  });
});
