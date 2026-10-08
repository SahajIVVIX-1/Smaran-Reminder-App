import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chooseDataFolder, isWritable, PORTABLE_DATA_DIR } from '../../src/main/system/dataFolder';
import { isSuppressingState, NotificationState } from '../../src/main/system/focusAssist';
import { tooltipFor } from '../../src/main/tray/tooltip';
import {
  EDGE,
  GAP,
  pickDisplay,
  stackLayout,
  type DisplayInfo,
} from '../../src/main/windows/placement';

const primary: DisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
};
const second: DisplayInfo = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 1280, height: 1024 },
  workArea: { x: 1920, y: 0, width: 1280, height: 1024 },
};

describe('notification stack', () => {
  const card = { width: 400, height: 120 };

  it('stacks from the bottom-right corner upwards, newest nearest the corner', () => {
    const pos = stackLayout('bottom-right', primary.workArea, [card, card]);
    expect(pos).toEqual([
      { x: 1920 - 400 - EDGE, y: 1040 - EDGE - 120 },
      { x: 1920 - 400 - EDGE, y: 1040 - EDGE - 120 - GAP - 120 },
    ]);
  });

  it('stacks from the top downwards, on the left or centred', () => {
    expect(stackLayout('top-left', primary.workArea, [card, card])).toEqual([
      { x: EDGE, y: EDGE },
      { x: EDGE, y: EDGE + 120 + GAP },
    ]);
    expect(stackLayout('top-center', second.workArea, [card])).toEqual([
      { x: 1920 + 440, y: EDGE },
    ]);
    expect(stackLayout('bottom-left', primary.workArea, [card])[0]?.x).toBe(EDGE);
  });

  it('leaves out cards that do not fit on screen', () => {
    const tall = { width: 400, height: 600 };
    expect(stackLayout('top-right', primary.workArea, [tall, tall])[1]).toBeNull();
  });

  it('picks the primary screen or the one under the pointer', () => {
    expect(pickDisplay('primary', [primary, second], 1, { x: 0, y: 0 }).id).toBe(1);
    expect(pickDisplay('cursor', [primary, second], 1, { x: 2500, y: 10 }).id).toBe(2);
    expect(pickDisplay('cursor', [primary, second], 1, { x: -50, y: 0 }).id).toBe(1);
    expect(pickDisplay('primary', [primary, second], 99, { x: 0, y: 0 }).id).toBe(1);
    expect(() => pickDisplay('primary', [], 1, { x: 0, y: 0 })).toThrow();
  });
});

describe('Windows busy states', () => {
  it('holds for full-screen, presentation, quiet time and lock; not when accepting', () => {
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
    const blocked = mkdtempSync(join(tmpdir(), 'smaran-blocked-'));
    try {
      expect(chooseDataFolder(dir, 'C:/appdata')).toEqual({
        dir: join(dir, PORTABLE_DATA_DIR),
        portable: true,
      });
      expect(chooseDataFolder(undefined, 'C:/appdata')).toEqual({
        dir: 'C:/appdata',
        portable: false,
      });
      writeFileSync(join(blocked, PORTABLE_DATA_DIR), 'not a folder');
      expect(isWritable(join(blocked, PORTABLE_DATA_DIR))).toBe(false);
      expect(chooseDataFolder(blocked, 'C:/appdata').portable).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(blocked, { recursive: true, force: true });
    }
  });
});

describe('tray tooltip', () => {
  const now = new Date(2026, 9, 8, 8, 0);
  it('says when the next reminder is, or that Smaran is paused', () => {
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
    expect(
      tooltipFor({ pausedUntil: new Date(2026, 9, 8, 8, 30).toISOString(), next: null }, now),
    ).toBe('Smaran is paused until 08:30');
    expect(tooltipFor({ pausedUntil: '9999-12-31T00:00:00.000Z', next: null }, now)).toBe(
      'Smaran is paused until you resume it',
    );
  });
});
