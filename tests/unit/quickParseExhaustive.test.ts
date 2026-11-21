import { describe, expect, it } from 'vitest';
import { quickParse } from '../../src/shared/quickParse';

describe('quickParse - Natural Language Scheduling & Title Extraction', () => {
  const fixedNow = new Date(2026, 4, 1, 10, 0, 0); // Friday, May 1, 2026, 10:00:00

  describe('Interval Recognition', () => {
    it('parses "every 30 minutes"', () => {
      const res = quickParse('Take a stretch every 30 minutes', fixedNow);
      expect(res.title).toBe('Take a stretch');
      expect(res.rule).toEqual({
        kind: 'interval',
        everyMs: 30 * 60_000,
      });
    });

    it('parses "every 2 hours"', () => {
      const res = quickParse('Hydrate every 2 hours', fixedNow);
      expect(res.title).toBe('Hydrate');
      expect(res.rule).toEqual({
        kind: 'interval',
        everyMs: 2 * 3600_000,
      });
    });

    it('parses "every 90 minutes"', () => {
      const res = quickParse('Check logs every 90 minutes', fixedNow);
      expect(res.title).toBe('Check logs');
      expect(res.rule).toEqual({
        kind: 'interval',
        everyMs: 90 * 60_000,
      });
    });
  });

  describe('Relative Future Offsets ("in X")', () => {
    it('parses "in 15 minutes"', () => {
      const res = quickParse('Check the oven in 15 minutes', fixedNow);
      expect(res.title).toBe('Check the oven');
      expect(res.rule?.kind).toBe('once');
      if (res.rule?.kind === 'once') {
        const at = new Date(res.rule.at);
        expect(at.getTime() - fixedNow.getTime()).toBe(15 * 60_000);
      }
    });

    it('parses "in 2 hours"', () => {
      const res = quickParse('Follow up on email in 2 hours', fixedNow);
      expect(res.title).toBe('Follow up on email');
      expect(res.rule?.kind).toBe('once');
      if (res.rule?.kind === 'once') {
        const at = new Date(res.rule.at);
        expect(at.getTime() - fixedNow.getTime()).toBe(2 * 3600_000);
      }
    });
  });

  describe('Daily and Clock Schedules', () => {
    it('parses "every day at 9am"', () => {
      const res = quickParse('Team standup every day at 9am', fixedNow);
      expect(res.title).toBe('Team standup');
      expect(res.rule).toEqual({
        kind: 'daily',
        times: ['09:00'],
      });
    });

    it('parses "daily at 17:30"', () => {
      const res = quickParse('End of day review daily at 17:30', fixedNow);
      expect(res.title).toBe('End of day review');
      expect(res.rule).toEqual({
        kind: 'daily',
        times: ['17:30'],
      });
    });

    it('parses "at 4pm" (later today if time is in future)', () => {
      const res = quickParse('Call accountant at 4pm', fixedNow);
      expect(res.title).toBe('Call accountant');
      expect(res.rule?.kind).toBe('once');
      if (res.rule?.kind === 'once') {
        const at = new Date(res.rule.at);
        expect(at.getHours()).toBe(16);
        expect(at.getMinutes()).toBe(0);
        expect(at.getDate()).toBe(1); // May 1
      }
    });
  });

  describe('Tomorrow & Named Day Schedules', () => {
    it('parses "tomorrow morning"', () => {
      const res = quickParse('Review pull requests tomorrow morning', fixedNow);
      expect(res.title).toBe('Review pull requests');
      expect(res.rule?.kind).toBe('once');
      if (res.rule?.kind === 'once') {
        const at = new Date(res.rule.at);
        expect(at.getDate()).toBe(2); // May 2
        expect(at.getHours()).toBe(9);
        expect(at.getMinutes()).toBe(0);
      }
    });

    it('parses "tomorrow at 5pm"', () => {
      const res = quickParse('Gym session tomorrow at 5pm', fixedNow);
      expect(res.title).toBe('Gym session');
      expect(res.rule?.kind).toBe('once');
      if (res.rule?.kind === 'once') {
        const at = new Date(res.rule.at);
        expect(at.getDate()).toBe(2);
        expect(at.getHours()).toBe(17);
      }
    });

    it('parses "on monday at 11am"', () => {
      const res = quickParse('Weekly sync on monday at 11am', fixedNow);
      expect(res.title).toBe('Weekly sync');
      expect(res.rule?.kind).toBe('once');
      if (res.rule?.kind === 'once') {
        const at = new Date(res.rule.at);
        expect(at.getDay()).toBe(1); // Monday May 4
        expect(at.getHours()).toBe(11);
      }
    });
  });

  describe('Title Normalization and Noise Stripping', () => {
    it('removes "Please remind me to..." prefix', () => {
      const res = quickParse('Please remind me to call Mom at 6pm', fixedNow);
      expect(res.title).toBe('Call Mom');
    });

    it('removes "Reminder: ..." prefix and trailing punctuation', () => {
      const res = quickParse('Reminder: submit tax form - at 3pm', fixedNow);
      expect(res.title).toBe('Submit tax form');
    });

    it('capitalizes the resulting title properly', () => {
      const res = quickParse('water the plants in 30 minutes', fixedNow);
      expect(res.title).toBe('Water the plants');
    });

    it('defaults to "Reminder" when the entire string is just a schedule', () => {
      const res = quickParse('tomorrow at 10am', fixedNow);
      expect(res.title).toBe('Reminder');
      expect(res.rule?.kind).toBe('once');
    });

    it('returns rule = null when no recognizable temporal phrase exists', () => {
      const res = quickParse('Buy groceries and milk', fixedNow);
      expect(res.title).toBe('Buy groceries and milk');
      expect(res.rule).toBeNull();
    });
  });
});
