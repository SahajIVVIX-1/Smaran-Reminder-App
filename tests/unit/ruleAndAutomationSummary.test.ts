import { describe, expect, it } from 'vitest';
import {
  actionSummary,
  baseName,
  seconds,
  stepsSummary,
  triggerSummary,
} from '../../src/shared/automationSummary';
import { durationSummary, ruleSummary, weekdaysSummary } from '../../src/shared/ruleSummary';
import type { Action, Automation, Rule, Trigger } from '../../src/shared/schema';

describe('ruleSummary & automationSummary - Human-Readable String Generation', () => {
  describe('weekdaysSummary', () => {
    it('summarizes all 7 days as "every day"', () => {
      expect(weekdaysSummary([0, 1, 2, 3, 4, 5, 6])).toBe('every day');
      // Unordered array
      expect(weekdaysSummary([6, 5, 4, 3, 2, 1, 0])).toBe('every day');
    });

    it('summarizes weekdays (Mon-Fri) as "Mon–Fri"', () => {
      expect(weekdaysSummary([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    });

    it('summarizes weekend days (Sat, Sun) as "weekends"', () => {
      expect(weekdaysSummary([0, 6])).toBe('weekends');
      expect(weekdaysSummary([6, 0])).toBe('weekends');
    });

    it('summarizes arbitrary weekday subsets in sorted order with abbreviations', () => {
      expect(weekdaysSummary([1, 3, 5])).toBe('Mon, Wed, Fri');
      expect(weekdaysSummary([2])).toBe('Tue');
    });
  });

  describe('durationSummary', () => {
    it('formats single minute and multiple minutes', () => {
      expect(durationSummary(60_000)).toBe('minute');
      expect(durationSummary(120_000)).toBe('2 minutes');
      expect(durationSummary(45 * 60_000)).toBe('45 minutes');
    });

    it('formats single hour and multiple hours', () => {
      expect(durationSummary(3600_000)).toBe('hour');
      expect(durationSummary(2 * 3600_000)).toBe('2 hours');
    });

    it('formats mixed hours and minutes', () => {
      expect(durationSummary(90 * 60_000)).toBe('1 h 30 min');
      expect(durationSummary(135 * 60_000)).toBe('2 h 15 min');
    });
  });

  describe('ruleSummary', () => {
    it('summarizes interval rule with hours and weekdays', () => {
      const rule: Rule = {
        kind: 'interval',
        everyMs: 45 * 60_000,
        activeHours: { from: '09:00', to: '17:00' },
        weekdays: [1, 2, 3, 4, 5],
      };
      expect(ruleSummary(rule)).toBe('Every 45 minutes, 09:00–17:00, Mon–Fri');
    });

    it('summarizes once rule', () => {
      const rule: Rule = { kind: 'once', at: '2026-10-15T14:30:00' };
      expect(ruleSummary(rule)).toContain('Once, ');
      expect(ruleSummary(rule)).toContain('15 Oct 2026, 14:30');
    });

    it('summarizes daily rule with multiple sorted times', () => {
      const rule: Rule = { kind: 'daily', times: ['18:00', '08:00', '13:00'] };
      expect(ruleSummary(rule)).toBe('Daily at 08:00, 13:00, 18:00');
    });

    it('summarizes weekly rule', () => {
      const rule: Rule = { kind: 'weekly', weekdays: [1, 3], time: '10:15' };
      expect(ruleSummary(rule)).toBe('Weekly on Mon, Wed at 10:15');
    });

    it('summarizes monthly rule on fixed day and last day', () => {
      const fixedDay: Rule = { kind: 'monthly', day: 15, time: '09:00' };
      expect(ruleSummary(fixedDay)).toBe('Monthly on day 15 at 09:00');

      const lastDay: Rule = { kind: 'monthly', day: 'last', time: '18:00' };
      expect(ruleSummary(lastDay)).toBe('Monthly on the last day at 18:00');
    });

    it('summarizes yearly rule', () => {
      const yearly: Rule = { kind: 'yearly', month: 12, day: 25, time: '08:00' };
      expect(ruleSummary(yearly)).toBe('Yearly on 25 Dec at 08:00');
    });
  });

  describe('automationSummary', () => {
    it('extracts path basename accurately for Windows and POSIX', () => {
      expect(baseName('C:\\Program Files\\App\\app.exe')).toBe('app.exe');
      expect(baseName('/usr/local/bin/script.sh')).toBe('script.sh');
    });

    it('formats seconds into readable strings', () => {
      expect(seconds(45)).toBe('45 s');
      expect(seconds(60)).toBe('1 min');
      expect(seconds(120)).toBe('2 min');
      expect(seconds(90)).toBe('1 min 30 s');
    });

    it('summarizes power actions', () => {
      expect(actionSummary({ kind: 'power', power: 'lock' })).toBe('Lock the PC');
      expect(actionSummary({ kind: 'power', power: 'shutdown' })).toBe('Shut down');
      expect(actionSummary({ kind: 'power', power: 'restart' })).toBe('Restart');
    });

    it('summarizes file and script open actions', () => {
      const appAction: Action = {
        kind: 'open',
        what: 'app',
        path: 'C:\\Tools\\Editor.exe',
        args: '',
        hidden: false,
      };
      expect(actionSummary(appAction)).toBe('Open Editor.exe');

      const scriptAction: Action = {
        kind: 'open',
        what: 'script',
        path: 'C:\\Scripts\\backup.ps1',
        args: '',
        hidden: false,
      };
      expect(actionSummary(scriptAction)).toBe('Run backup.ps1');
    });

    it('summarizes link actions with host cleanup', () => {
      const linkAction: Action = {
        kind: 'link',
        url: 'https://www.youtube.com/watch?v=123',
        browser: 'default',
        private: false,
      };
      expect(actionSummary(linkAction)).toBe('Open youtube.com');
    });

    it('summarizes multi-step sequences', () => {
      const automation: Pick<Automation, 'steps'> = {
        steps: [
          {
            action: {
              kind: 'open',
              what: 'app',
              path: 'C:\\App\\Music.exe',
              args: '',
              hidden: false,
            },
            waitSec: 0,
          },
          {
            action: { kind: 'power', power: 'lock' },
            waitSec: 0,
          },
        ],
      };
      expect(stepsSummary(automation)).toBe('Open Music.exe, then Lock the PC');
    });

    it('summarizes various triggers (start, event, schedule)', () => {
      const startTrigger: Trigger = { kind: 'start', when: 'smaran', delaySec: 30 };
      expect(triggerSummary(startTrigger)).toBe('When Smaran opens, after 30 s');

      const idleTrigger: Trigger = { kind: 'event', event: 'idle', idleMin: 15 };
      expect(triggerSummary(idleTrigger)).toBe('When I’ve been away 15 min');

      const activeTrigger: Trigger = { kind: 'event', event: 'active', idleMin: 10 };
      expect(triggerSummary(activeTrigger)).toBe('When I’m back after 10 min away');

      const batteryTrigger: Trigger = { kind: 'event', event: 'onBattery', idleMin: 0 };
      expect(triggerSummary(batteryTrigger)).toBe('When the charger is unplugged');
    });
  });
});
