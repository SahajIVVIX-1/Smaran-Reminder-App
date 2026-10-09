import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chooseDataFolder, isWritable, PORTABLE_DATA_DIR } from '../../src/main/system/dataFolder';
import { isSuppressingState, NotificationState } from '../../src/main/system/focusAssist';
import { parseSystemUsesLightTheme } from '../../src/main/tray/taskbarTheme';
import { tooltipFor } from '../../src/main/tray/tooltip';
import {
  EDGE,
  SIDE,
  GAP,
  pickDisplay,
  stackLayout,
  stackWindows,
  menuPosition,
  CARD_GAP,
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

describe('right-click menu placement', () => {
  const wa = { x: 0, y: 0, width: 1920, height: 1040 };
  const size = { width: 240, height: 300 };
  it('puts the panel corner at the pointer', () => {
    expect(menuPosition({ x: 500, y: 400 }, size, wa, 10)).toEqual({ x: 490, y: 390 });
  });
  it('opens upwards and leftwards from the tray, staying on screen', () => {
    // The tray sits in the taskbar, below the work area.
    expect(menuPosition({ x: 1900, y: 1060 }, size, wa, 10)).toEqual({
      x: 1900 - 240 + 10,
      y: 1040 - 300 + 10,
    });
  });
});

describe('notification stack', () => {
  it('packs cards by their visible height, so small pills sit close together', () => {
    const win = { width: 420, height: 260 };
    const pos = stackWindows('bottom-right', primary.workArea, [
      { window: win, cardHeight: 40 },
      { window: win, cardHeight: 40 },
    ]);
    expect(pos[0]).toEqual({ x: 1920 - 420 - SIDE, y: 1040 - 260 });
    expect(pos[1]).toEqual({ x: 1920 - 420 - SIDE, y: 1040 - 40 - CARD_GAP - 260 });
    const top = stackWindows('top-left', primary.workArea, [
      { window: win, cardHeight: 40 },
      { window: win, cardHeight: 40 },
    ]);
    expect(top[1]).toEqual({ x: SIDE, y: 40 + CARD_GAP });
  });

  it('leaves out cards that would not fit on the screen', () => {
    const pos = stackWindows('top-right', { x: 0, y: 0, width: 800, height: 100 }, [
      { window: { width: 300, height: 200 }, cardHeight: 40 },
      { window: { width: 300, height: 200 }, cardHeight: 40 },
    ]);
    expect(pos[0]).not.toBeNull();
    expect(pos[1]).toBeNull();
  });

  const card = { width: 400, height: 120 };

  it('stacks from the bottom-right corner upwards, newest nearest the corner', () => {
    const pos = stackLayout('bottom-right', primary.workArea, [card, card]);
    expect(pos).toEqual([
      { x: 1920 - 400 - SIDE, y: 1040 - EDGE - 120 },
      { x: 1920 - 400 - SIDE, y: 1040 - EDGE - 120 - GAP - 120 },
    ]);
  });

  it('stacks from the top downwards, on the left or centred', () => {
    expect(stackLayout('top-left', primary.workArea, [card, card])).toEqual([
      { x: SIDE, y: EDGE },
      { x: SIDE, y: EDGE + 120 + GAP },
    ]);
    expect(stackLayout('top-center', second.workArea, [card])).toEqual([
      { x: 1920 + 440, y: EDGE },
    ]);
    expect(stackLayout('bottom-left', primary.workArea, [card])[0]?.x).toBe(SIDE);
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

describe('taskbar theme', () => {
  const out = (v: string) =>
    String.raw`HKEY_CURRENT_USER\Software\Personalize` +
    `\r\n    SystemUsesLightTheme    REG_DWORD    ${v}\r\n`;
  it('reads light and dark taskbars from the registry output', () => {
    expect(parseSystemUsesLightTheme(out('0x1'))).toBe(true);
    expect(parseSystemUsesLightTheme(out('0x0'))).toBe(false);
  });
  it('returns null when the value is missing', () => {
    expect(parseSystemUsesLightTheme('ERROR: The system was unable to find the value.')).toBeNull();
  });
});
