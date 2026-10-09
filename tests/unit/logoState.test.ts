import { describe, expect, it } from 'vitest';
import { logoStateFor, nextChangeAt, SOON_MS, type LogoInputs } from '@shared/logoState';

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0);
const base: LogoInputs = {
  showing: 0,
  paused: false,
  quiet: false,
  nextAt: null,
  flash: null,
  startupUntil: 0,
};

describe('logo state', () => {
  it('is idle when nothing is going on', () => {
    expect(logoStateFor(base, NOW)).toBe('idle');
  });

  it('rings while a reminder is on screen, above everything else', () => {
    expect(
      logoStateFor(
        { ...base, showing: 2, paused: true, flash: { kind: 'done', until: NOW + 1000 } },
        NOW,
      ),
    ).toBe('alert');
  });

  it('shows a short done or snoozed flourish, then moves on', () => {
    const i = { ...base, flash: { kind: 'snoozed' as const, until: NOW + 1000 } };
    expect(logoStateFor(i, NOW)).toBe('snoozed');
    expect(logoStateFor(i, NOW + 1000)).toBe('idle');
  });

  it('orders startup, paused, quiet and soon', () => {
    expect(logoStateFor({ ...base, startupUntil: NOW + 1, paused: true }, NOW)).toBe('startup');
    expect(logoStateFor({ ...base, paused: true, quiet: true }, NOW)).toBe('paused');
    expect(logoStateFor({ ...base, quiet: true }, NOW)).toBe('quiet');
    expect(logoStateFor({ ...base, nextAt: new Date(NOW + SOON_MS) }, NOW)).toBe('soon');
    expect(logoStateFor({ ...base, nextAt: new Date(NOW + SOON_MS + 1) }, NOW)).toBe('idle');
    expect(logoStateFor({ ...base, nextAt: new Date(NOW - 1) }, NOW)).toBe('idle');
  });

  it('knows when it will change next', () => {
    expect(nextChangeAt(base, NOW)).toBeNull();
    const at = new Date(NOW + 5 * 60_000);
    expect(nextChangeAt({ ...base, nextAt: at }, NOW)).toBe(at.getTime() - SOON_MS);
    expect(nextChangeAt({ ...base, nextAt: new Date(NOW + 30_000) }, NOW)).toBe(NOW + 30_001);
    expect(
      nextChangeAt(
        { ...base, flash: { kind: 'done', until: NOW + 500 }, startupUntil: NOW + 900 },
        NOW,
      ),
    ).toBe(NOW + 500);
  });
});
