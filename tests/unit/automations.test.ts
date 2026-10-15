import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionSummary,
  baseName,
  seconds,
  stepsSummary,
  triggerSummary,
} from '@shared/automationSummary';
import { createAutomation, createDefaultConfig, defaultAction } from '@shared/defaults';
import type { NotificationRequest } from '@shared/ipc';
import {
  AutomationSchema,
  ConfigSchema,
  isDisruptive,
  type Action,
  type Automation,
  type Config,
  type HistoryEntry,
  type Trigger,
} from '@shared/schema';
import { AutomationEngine, CARD_PREFIX } from '../../src/main/automations/AutomationEngine';
import { exeFromCommand, parseRegistry } from '../../src/main/automations/browsers';
import { mergeReminders } from '../../src/main/store/backup';

const START = new Date(2026, 9, 15, 8, 59, 0); // 15 Oct 2026, 08:59 local

/** Moves the fake clock, then lets the steps' promise chains settle. */
async function tick(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function automation(trigger: Trigger, actions: Action[], patch: Partial<Automation> = {}) {
  let n = 0;
  return {
    ...createAutomation({ name: 'Test', trigger, actions }, () => `a${++n}`, START),
    ...patch,
  };
}

describe('automation summaries', () => {
  it('describes triggers', () => {
    expect(triggerSummary({ kind: 'schedule', rule: { kind: 'daily', times: ['23:00'] } })).toBe(
      'Daily at 23:00',
    );
    expect(triggerSummary({ kind: 'start', when: 'signIn', delaySec: 0 })).toBe('When I sign in');
    expect(triggerSummary({ kind: 'start', when: 'boot', delaySec: 90 })).toBe(
      'When the computer starts, after 1 min 30 s',
    );
    expect(triggerSummary({ kind: 'event', event: 'lock', idleMin: 5 })).toBe('When I lock the PC');
    expect(triggerSummary({ kind: 'event', event: 'idle', idleMin: 10 })).toBe(
      'When I’ve been away 10 min',
    );
    expect(triggerSummary({ kind: 'event', event: 'active', idleMin: 10 })).toBe(
      'When I’m back after 10 min away',
    );
  });

  it('describes actions and steps', () => {
    expect(actionSummary({ kind: 'power', power: 'shutdown' })).toBe('Shut down');
    expect(
      actionSummary({
        kind: 'open',
        what: 'app',
        path: 'C:\\Apps\\Spotify.exe',
        args: '',
        hidden: false,
      }),
    ).toBe('Open Spotify.exe');
    expect(actionSummary({ ...defaultAction('script'), path: 'D:/s/backup.bat' } as Action)).toBe(
      'Run backup.bat',
    );
    expect(actionSummary(defaultAction('file'))).toBe('Open …');
    expect(
      actionSummary({
        kind: 'link',
        url: 'https://www.youtube.com/x',
        browser: '',
        private: false,
      }),
    ).toBe('Open youtube.com');
    expect(actionSummary({ kind: 'link', url: 'not a url', browser: '', private: false })).toBe(
      'Open not a url',
    );
    const a = automation({ kind: 'event', event: 'lock', idleMin: 5 }, [
      { kind: 'power', power: 'lock' },
      { kind: 'power', power: 'sleep' },
    ]);
    expect(stepsSummary(a)).toBe('Lock the PC, then Sleep');
  });

  it('formats seconds and file names', () => {
    expect(seconds(30)).toBe('30 s');
    expect(seconds(120)).toBe('2 min');
    expect(seconds(75)).toBe('1 min 15 s');
    expect(baseName('C:\\a\\b\\c.pdf')).toBe('c.pdf');
    expect(baseName('c.pdf')).toBe('c.pdf');
  });
});

describe('automation schema', () => {
  it('accepts a complete automation and rejects bad links and empty paths', () => {
    const ok = automation({ kind: 'event', event: 'unlock', idleMin: 5 }, [
      { kind: 'link', url: 'https://example.com', browser: '', private: false },
    ]);
    expect(AutomationSchema.safeParse(ok).success).toBe(true);
    const badLink = { ...ok, steps: [{ action: defaultAction('link'), waitSec: 0 }] };
    expect(AutomationSchema.safeParse(badLink).success).toBe(false);
    const js = {
      ...ok,
      steps: [
        {
          action: { kind: 'link', url: 'javascript:alert(1)', browser: '', private: false },
          waitSec: 0,
        },
      ],
    };
    expect(AutomationSchema.safeParse(js).success).toBe(false);
    const noPath = { ...ok, steps: [{ action: defaultAction('app'), waitSec: 0 }] };
    expect(AutomationSchema.safeParse(noPath).success).toBe(false);
  });

  it('only sign out, sleep, hibernate, shut down and restart are disruptive', () => {
    expect(isDisruptive({ kind: 'power', power: 'lock' })).toBe(false);
    expect(isDisruptive({ kind: 'power', power: 'restart' })).toBe(true);
    expect(isDisruptive(defaultAction('app'))).toBe(false);
  });

  it('rejects an automation id that a reminder already uses', () => {
    const config = createDefaultConfig();
    const id = config.reminders[0]!.id;
    const a = automation({ kind: 'event', event: 'lock', idleMin: 5 }, [defaultAction('power')], {
      id,
    });
    expect(ConfigSchema.safeParse({ ...config, automations: [a] }).success).toBe(false);
  });

  it('merges imported automations with fresh ids on collision', () => {
    const current = createDefaultConfig();
    const a = automation({ kind: 'event', event: 'lock', idleMin: 5 }, [defaultAction('power')]);
    const merged = mergeReminders(
      { ...current, automations: [a] },
      { ...createDefaultConfig(), reminders: [], state: {}, automations: [a] },
      () => 'fresh',
    );
    expect(merged.automations.map((x) => x.id)).toEqual([a.id, 'fresh']);
  });
});

describe('browser detection', () => {
  const root = 'HKLM\\SOFTWARE\\Clients\\StartMenuInternet';
  const output = [
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome',
    '    (Default)    REG_SZ    Google Chrome',
    '',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome\\shell\\open\\command',
    '    (Default)    REG_SZ    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
    '',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\FIREFOX.EXE\\shell\\open\\command',
    '    (Standard)    REG_SZ    C:\\Program Files\\Mozilla Firefox\\firefox.exe -osint',
  ].join('\r\n');

  it('reads names and exes from the registry listing', () => {
    expect(parseRegistry(output, root)).toEqual([
      { name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
      { name: 'firefox.exe', path: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe' },
    ]);
    expect(parseRegistry('', root)).toEqual([]);
  });

  it('finds the exe in a command line', () => {
    expect(exeFromCommand('"C:\\x y\\b.exe" --flag "%1"')).toBe('C:\\x y\\b.exe');
    expect(exeFromCommand('C:\\b\\c.exe -osint')).toBe('C:\\b\\c.exe');
    expect(exeFromCommand('nothing here')).toBeNull();
  });
});

describe('AutomationEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  function setup(automations: Automation[], change: (c: Config) => void = () => undefined) {
    const config: Config = { ...createDefaultConfig(), automations };
    change(config);
    const history: HistoryEntry[] = [];
    const shown: NotificationRequest[] = [];
    const ran: Action[] = [];
    let idle = 0;
    let fail = false;
    const engine = new AutomationEngine({
      store: { get: () => config },
      history: { add: (e) => history.unshift(e), flush: () => undefined },
      notifier: {
        show: (r) => shown.push(r),
        close: () => undefined,
        closeAll: () => undefined,
      },
      run: (action) => {
        if (fail) return Promise.reject(new Error('nope'));
        ran.push(action);
        return Promise.resolve();
      },
      idleSeconds: () => idle,
      now: () => new Date(Date.now()),
      newId: () => `h${history.length}`,
    });
    return {
      engine,
      history,
      shown,
      ran,
      setIdle: (s: number) => (idle = s),
      failNext: () => (fail = true),
    };
  }

  const daily9: Trigger = { kind: 'schedule', rule: { kind: 'daily', times: ['09:00'] } };

  it('runs a scheduled automation at its time and records it', async () => {
    const t = setup([automation(daily9, [{ kind: 'power', power: 'lock' }])]);
    t.engine.start({ signIn: false, boot: false });
    expect(t.engine.nextTimes()[0]?.at).toBe(new Date(2026, 9, 15, 9, 0).toISOString());
    await tick(60_000);
    expect(t.ran).toEqual([{ kind: 'power', power: 'lock' }]);
    expect(t.history[0]).toMatchObject({ outcome: 'ran', detail: 'At 09:00: Lock the PC' });
    t.engine.stop();
  });

  it('shows a Cancel card before shutting down, and Cancel stops it', async () => {
    const t = setup([automation(daily9, [{ kind: 'power', power: 'shutdown' }])]);
    t.engine.start({ signIn: false, boot: false });
    await tick(60_000);
    const card = t.shown[0];
    expect(card).toMatchObject({ countdown: true, hideAfterSec: 30 });
    expect(card?.key.startsWith(CARD_PREFIX)).toBe(true);
    expect(t.engine.running()[0]).toMatchObject({ state: 'countdown' });
    t.engine.handleCard(card!.key, { kind: 'dismiss' });
    await tick(60_000);
    expect(t.ran).toEqual([]);
    expect(t.history[0]).toMatchObject({ outcome: 'cancelled' });
    expect(t.engine.running()).toEqual([]);
  });

  it('goes ahead when the countdown runs out', async () => {
    const t = setup([automation(daily9, [{ kind: 'power', power: 'restart' }])]);
    t.engine.start({ signIn: false, boot: false });
    await tick(60_000);
    await tick(30_000);
    expect(t.ran).toEqual([{ kind: 'power', power: 'restart' }]);
    expect(t.history[0]).toMatchObject({ outcome: 'ran' });
  });

  it('runs on Windows events and waits between steps', async () => {
    const a = automation({ kind: 'event', event: 'unlock', idleMin: 5 }, [
      { kind: 'power', power: 'lock' },
    ]);
    a.steps.push({ action: { kind: 'power', power: 'lock' }, waitSec: 10 });
    const t = setup([a]);
    t.engine.start({ signIn: false, boot: false });
    t.engine.onEvent('lock');
    await tick(0);
    expect(t.ran).toHaveLength(0);
    t.engine.onEvent('unlock');
    await tick(0);
    expect(t.ran).toHaveLength(1);
    expect(t.engine.running()[0]).toMatchObject({ state: 'waiting' });
    await tick(10_000);
    expect(t.ran).toHaveLength(2);
  });

  it('runs at sign-in only when Smaran was started at sign-in', async () => {
    const a = automation({ kind: 'start', when: 'signIn', delaySec: 5 }, [
      { kind: 'power', power: 'lock' },
    ]);
    const off = setup([a]);
    off.engine.start({ signIn: false, boot: false });
    await tick(10_000);
    expect(off.ran).toHaveLength(0);
    const on = setup([a]);
    on.engine.start({ signIn: true, boot: false });
    await tick(4_000);
    expect(on.ran).toHaveLength(0);
    await tick(1_000);
    expect(on.ran).toHaveLength(1);
  });

  it('runs once per stretch away, and when you come back', async () => {
    const idle = automation({ kind: 'event', event: 'idle', idleMin: 1 }, [
      { kind: 'power', power: 'lock' },
    ]);
    const back = {
      ...automation({ kind: 'event', event: 'active', idleMin: 1 }, [
        { kind: 'power', power: 'lock' },
      ]),
      id: 'back',
    };
    const t = setup([idle, back]);
    t.engine.start({ signIn: false, boot: false });
    t.setIdle(90);
    await tick(30_000);
    expect(t.ran).toHaveLength(1);
    t.setIdle(5);
    await tick(15_000);
    expect(t.ran).toHaveLength(2);
    t.engine.stop();
  });

  it('skips while paused when asked to, and records failures', async () => {
    const t = setup(
      [automation(daily9, [{ kind: 'power', power: 'lock' }], { respectPause: true })],
      (c) => {
        c.settings.pausedUntil = '9999-12-31T00:00:00.000Z';
      },
    );
    t.engine.start({ signIn: false, boot: false });
    await tick(60_000);
    expect(t.history[0]).toMatchObject({ outcome: 'skipped', detail: 'Paused' });

    const f = setup([automation(daily9, [{ kind: 'power', power: 'lock' }])]);
    f.failNext();
    expect(f.engine.runNow('missing')).toBe(false);
    expect(f.engine.runNow(f.engine.nextTimes()[0]!.automationId)).toBe(true);
    await tick(0);
    expect(f.history[0]).toMatchObject({ outcome: 'failed', detail: 'Lock the PC: nope' });
  });

  it('skips a time missed while the PC slept', async () => {
    const t = setup([automation(daily9, [{ kind: 'power', power: 'lock' }])]);
    t.engine.start({ signIn: false, boot: false });
    // Asleep: the clock jumps past 09:00 without timers firing, then the PC wakes.
    vi.setSystemTime(new Date(2026, 9, 15, 11, 0));
    t.engine.onEvent('wake');
    expect(t.ran).toHaveLength(0);
    expect(t.history[0]).toMatchObject({ outcome: 'skipped' });
    t.engine.stop();
  });
});
