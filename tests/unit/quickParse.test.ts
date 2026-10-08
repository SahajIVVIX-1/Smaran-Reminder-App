import { describe, expect, it } from 'vitest';
import { parseClock, quickParse } from '@shared/quickParse';

const NOW = new Date(2026, 9, 8, 14, 30); // Thu 8 Oct 2026 14:30

describe('parseClock', () => {
  it.each([
    ['6pm', '18:00'],
    ['6:15 pm', '18:15'],
    ['12am', '00:00'],
    ['12pm', '12:00'],
    ['9', '09:00'],
    ['6', '18:00'],
    ['18:30', '18:30'],
    ['7:05', '07:05'],
    ['noon', '12:00'],
    ['midnight', '00:00'],
    ['9 a.m.', '09:00'],
  ])('%s → %s', (input, out) => {
    expect(parseClock(input)).toBe(out);
  });

  it.each(['25', '13pm', '9:75', 'soon'])('rejects %s', (input) => {
    expect(parseClock(input)).toBeNull();
  });
});

describe('quickParse', () => {
  it.each([
    ['stretch every 45 min', 'Stretch', { kind: 'interval', everyMs: 45 * 60_000 }],
    [
      'Drink water every hour from 9 to 6',
      'Drink water',
      { kind: 'interval', everyMs: 3_600_000, activeHours: { from: '09:00', to: '18:00' } },
    ],
    [
      'remind me to look away every 20 minutes between 9am and 5pm on weekdays',
      'Look away',
      {
        kind: 'interval',
        everyMs: 20 * 60_000,
        activeHours: { from: '09:00', to: '17:00' },
        weekdays: [1, 2, 3, 4, 5],
      },
    ],
    [
      'standup every weekday at 9:30',
      'Standup',
      { kind: 'weekly', weekdays: [1, 2, 3, 4, 5], time: '09:30' },
    ],
    [
      'clean the flat every weekend',
      'Clean the flat',
      { kind: 'weekly', weekdays: [0, 6], time: '09:00' },
    ],
    [
      'gym every monday and thursday at 7am',
      'Gym',
      { kind: 'weekly', weekdays: [1, 4], time: '07:00' },
    ],
    ['take vitamins every day at 8', 'Take vitamins', { kind: 'daily', times: ['08:00'] }],
    ['journal every evening', 'Journal', { kind: 'daily', times: ['18:00'] }],
    ['plan the day daily', 'Plan the day', { kind: 'daily', times: ['09:00'] }],
    [
      'pay rent on the 1st of every month at 9am',
      'Pay rent',
      { kind: 'monthly', day: 1, time: '09:00' },
    ],
    [
      'invoices every month on the last day',
      'Invoices',
      { kind: 'monthly', day: 'last', time: '09:00' },
    ],
    ['backup monthly on the 15th', 'Backup', { kind: 'monthly', day: 15, time: '09:00' }],
    [
      'anniversary every year on 3 march',
      'Anniversary',
      { kind: 'yearly', month: 3, day: 3, time: '09:00' },
    ],
    [
      'birthday on june 21 every year at 8am',
      'Birthday',
      { kind: 'yearly', month: 6, day: 21, time: '08:00' },
    ],
  ])('%s', (input, title, rule) => {
    expect(quickParse(input, NOW)).toEqual({ title, rule });
  });

  it.each([
    ['drink water in 20 min', 'Drink water', '2026-10-08T14:50:00'],
    ['check the oven in an hour', 'Check the oven', '2026-10-08T15:30:00'],
    ['call mom at 6pm', 'Call mom', '2026-10-08T18:00:00'],
    ['call mom at 9', 'Call mom', '2026-10-09T09:00:00'],
    ['dentist tomorrow at 10am', 'Dentist', '2026-10-09T10:00:00'],
    ['water plants tomorrow morning', 'Water plants', '2026-10-09T09:00:00'],
    ['read tonight', 'Read', '2026-10-08T21:00:00'],
    ['submit report today at 5pm', 'Submit report', '2026-10-08T17:00:00'],
    ['call the bank on monday at 11', 'Call the bank', '2026-10-12T11:00:00'],
    ['renew passport on 3 march', 'Renew passport', '2027-03-03T09:00:00'],
    ['book tickets on dec 20 at 6pm', 'Book tickets', '2026-12-20T18:00:00'],
  ])('%s', (input, title, at) => {
    expect(quickParse(input, NOW)).toEqual({ title, rule: { kind: 'once', at } });
  });

  it('returns no rule when no time is given', () => {
    expect(quickParse('  remind me to buy milk.', NOW)).toEqual({ title: 'Buy milk', rule: null });
  });

  it('falls back to a generic title when only a time is given', () => {
    expect(quickParse('at 5pm', NOW).title).toBe('Reminder');
  });

  it('ignores phrases that are not real times', () => {
    expect(quickParse('meeting today at 1pm', NOW).rule).toBeNull(); // already past today
    expect(quickParse('pay on the 40th of every month', NOW).rule).toBeNull();
    expect(quickParse('trip on 31 feb', NOW).rule).toBeNull();
    expect(quickParse('every 0 min', NOW).rule).toBeNull();
  });
});
