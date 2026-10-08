import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE_FIELDS } from '@shared/defaults';
import {
  clearOverride,
  getField,
  getOverride,
  overriddenPaths,
  pathKey,
  setField,
  setOverride,
  type FieldPath,
} from '@shared/overrides';
import { durationSummary, ruleSummary, weekdaysSummary } from '@shared/ruleSummary';
import type { Rule } from '@shared/schema';
import { chooseDataFolder, isWritable, PORTABLE_DATA_DIR } from '../../src/main/system/dataFolder';
import { isSuppressingState, NotificationState } from '../../src/main/system/focusAssist';
import { tooltipFor } from '../../src/main/tray/tooltip';

describe('overrides', () => {
  const size: FieldPath = ['font', 'sizePx'];
  const padding: FieldPath = ['paddingPx'];

  it('reads and writes style fields by path', () => {
    expect(getField(DEFAULT_STYLE_FIELDS, size)).toBe(22);
    expect(getField(DEFAULT_STYLE_FIELDS, padding)).toBe(18);
    expect(setField(DEFAULT_STYLE_FIELDS, size, 30).font).toEqual({
      ...DEFAULT_STYLE_FIELDS.font,
      sizePx: 30,
    });
    expect(setField(DEFAULT_STYLE_FIELDS, padding, 2).paddingPx).toBe(2);
    expect(pathKey(size)).toBe('font.sizePx');
  });

  it('sets, lists and clears overrides, removing empty groups', () => {
    let o = setOverride({}, size, 30);
    o = setOverride(o, ['font', 'italic'], true);
    o = setOverride(o, padding, 4);
    expect(getOverride(o, size)).toBe(30);
    expect(getOverride(o, ['colors', 'text'])).toBeUndefined();
    expect(overriddenPaths(o, [padding, size, ['colors', 'text']])).toEqual([padding, size]);
    o = clearOverride(o, size);
    expect(o).toEqual({ font: { italic: true }, paddingPx: 4 });
    o = clearOverride(o, ['font', 'italic']);
    o = clearOverride(o, padding);
    expect(o).toEqual({});
    expect(clearOverride({}, ['colors', 'text'])).toEqual({});
  });
});

describe('ruleSummary', () => {
  it.each<[Rule, string]>([
    [{ kind: 'interval', everyMs: 45 * 60_000 }, 'Every 45 min'],
    [
      {
        kind: 'interval',
        everyMs: 90 * 60_000,
        activeHours: { from: '09:00', to: '17:00' },
        weekdays: [1, 2, 3, 4, 5],
      },
      'Every 1 h 30 min, 09:00–17:00, Mon–Fri',
    ],
    [{ kind: 'interval', everyMs: 2 * 3_600_000, weekdays: [0, 6] }, 'Every 2 h, weekends'],
    [{ kind: 'once', at: '2026-10-08T09:00:00' }, 'Once on 8 Oct 2026, 09:00'],
    [{ kind: 'daily', times: ['18:00', '09:00'] }, 'Daily at 09:00, 18:00'],
    [
      { kind: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], time: '07:00' },
      'Weekly on every day at 07:00',
    ],
    [{ kind: 'weekly', weekdays: [3, 1], time: '07:00' }, 'Weekly on Mon, Wed at 07:00'],
    [{ kind: 'monthly', day: 31, time: '09:00' }, 'Monthly on day 31 at 09:00'],
    [{ kind: 'monthly', day: 'last', time: '09:00' }, 'Monthly on the last day at 09:00'],
    [{ kind: 'yearly', month: 2, day: 29, time: '08:00' }, 'Yearly on 29 Feb at 08:00'],
  ])('%j → %s', (rule, text) => {
    expect(ruleSummary(rule)).toBe(text);
  });

  it('shows ? for out-of-range values instead of crashing', () => {
    expect(weekdaysSummary([9])).toBe('?');
    expect(ruleSummary({ kind: 'yearly', month: 13, day: 1, time: '08:00' })).toBe(
      'Yearly on 1 ? at 08:00',
    );
    expect(durationSummary(60 * 60_000)).toBe('1 h');
  });
});

describe('Windows busy states', () => {
  it('suppresses for full-screen, presentation, quiet time and lock; not when accepting', () => {
    expect(isSuppressingState(NotificationState.Busy)).toBe(true);
    expect(isSuppressingState(NotificationState.PresentationMode)).toBe(true);
    expect(isSuppressingState(NotificationState.QuietTime)).toBe(true);
    expect(isSuppressingState(NotificationState.AcceptsNotifications)).toBe(false);
    expect(isSuppressingState(null)).toBe(false);
  });
});

describe('portable data folder', () => {
  it('uses SmaranData beside the exe when writable, else the normal folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'smaran-portable-'));
    try {
      expect(chooseDataFolder(dir, 'C:/appdata')).toEqual({
        dir: join(dir, PORTABLE_DATA_DIR),
        portable: true,
      });
      expect(chooseDataFolder(undefined, 'C:/appdata')).toEqual({
        dir: 'C:/appdata',
        portable: false,
      });
      // A file where the folder should be makes it unwritable.
      const blocked = mkdtempSync(join(tmpdir(), 'smaran-blocked-'));
      writeFileSync(join(blocked, PORTABLE_DATA_DIR), 'not a folder');
      expect(isWritable(join(blocked, PORTABLE_DATA_DIR))).toBe(false);
      expect(chooseDataFolder(blocked, 'C:/appdata').portable).toBe(false);
      rmSync(blocked, { recursive: true, force: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('tray tooltip', () => {
  const now = new Date(2026, 9, 8, 8, 0);
  it('says when the next reminder is', () => {
    expect(
      tooltipFor(
        { pausedUntil: null, next: { name: 'Water', at: new Date(2026, 9, 8, 9, 30) } },
        now,
      ),
    ).toBe('Smaran: next "Water" at 09:30');
    expect(
      tooltipFor(
        { pausedUntil: null, next: { name: 'Water', at: new Date(2026, 9, 9, 9, 30) } },
        now,
      ),
    ).toBe('Smaran: next "Water" at Fri 9 Oct, 09:30');
    expect(tooltipFor({ pausedUntil: null, next: null }, now)).toBe(
      'Smaran: no reminders scheduled',
    );
  });

  it('says when it is paused', () => {
    expect(
      tooltipFor({ pausedUntil: new Date(2026, 9, 8, 8, 30).toISOString(), next: null }, now),
    ).toBe('Smaran is paused until 08:30');
    expect(tooltipFor({ pausedUntil: '9999-12-31T00:00:00.000Z', next: null }, now)).toBe(
      'Smaran is paused until you resume it',
    );
    expect(
      tooltipFor({ pausedUntil: new Date(2026, 9, 8, 7).toISOString(), next: null }, now),
    ).toBe('Smaran: no reminders scheduled');
  });
});
