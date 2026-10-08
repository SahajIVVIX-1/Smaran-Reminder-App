import { addDays, addMinutes, format, startOfDay } from 'date-fns';
import { atTime } from './time';
import type { Rule } from './schema';

export interface QuickParse {
  title: string;
  /** Null when no time was recognised; the caller picks a default. */
  rule: Rule | null;
}

const DAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};
const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const DAY =
  '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\\b';
const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const TIME = '(noon|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?)';
const UNIT = '(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)';
const ORD = '(\\d{1,2})(?:st|nd|rd|th)?';

/**
 * Reads a time phrase: "6pm", "18:30", "9", "noon". A bare hour from 1 to 7 means the evening
 * (people rarely set reminders for 3 a.m.), otherwise it is read as 24-hour.
 */
export function parseClock(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\./g, '');
  if (t === 'noon') return '12:00';
  if (t === 'midnight') return '00:00';
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  const ampm = m[3];
  if (min > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
  } else {
    if (h > 23) return null;
    if (!m[2] && h >= 1 && h <= 7) h += 12;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const minutesOf = (n: number, unit: string) => (unit.startsWith('h') ? n * 60 : n);

interface Matcher {
  re: RegExp;
  build(m: RegExpExecArray, now: Date): Rule | null;
}

const at = (time: string | undefined, fallback: string) => (time ? parseClock(time) : fallback);

function onceAt(date: Date): Rule {
  return { kind: 'once', at: format(date, "yyyy-MM-dd'T'HH:mm:ss") };
}

/** Next time `time` comes round, today or tomorrow. */
function nextClock(now: Date, time: string): Date {
  const today = atTime(now, time);
  return today > now ? today : atTime(addDays(startOfDay(now), 1), time);
}

function window(from: string | undefined, to: string | undefined) {
  const f = from ? parseClock(from) : null;
  const t = to ? parseClock(to) : null;
  return f && t && f !== t ? { from: f, to: t } : undefined;
}

const MATCHERS: Matcher[] = [
  // every 45 min [from 9 to 6 | between 9am and 6pm] [on weekdays]
  {
    re: new RegExp(
      `\\bevery\\s+(\\d+)?\\s*${UNIT}\\b(?:\\s+(?:from|between)\\s+${TIME}\\s+(?:to|and|-|until)\\s+${TIME})?(\\s+on\\s+weekdays)?`,
      'i',
    ),
    build(m) {
      const minutes = minutesOf(Number(m[1] ?? '1'), (m[2] ?? '').toLowerCase());
      if (minutes < 1) return null;
      const rule: Rule = { kind: 'interval', everyMs: minutes * 60_000 };
      const hours = window(m[3], m[4]);
      if (hours) rule.activeHours = hours;
      if (m[5]) rule.weekdays = [1, 2, 3, 4, 5];
      return rule;
    },
  },
  // every weekday / weekend [at 9:30]
  {
    re: new RegExp(`\\b(?:every|on)\\s+(weekday|weekend)s?(?:\\s+at\\s+${TIME})?`, 'i'),
    build(m) {
      const time = at(m[2], '09:00');
      if (!time) return null;
      const weekend = (m[1] ?? '').toLowerCase() === 'weekend';
      return { kind: 'weekly', weekdays: weekend ? [0, 6] : [1, 2, 3, 4, 5], time };
    },
  },
  // every monday [and thursday] [at 10]
  {
    re: new RegExp(`\\bevery\\s+${DAY}((?:\\s*(?:,|and)\\s*${DAY})*)(?:\\s+at\\s+${TIME})?`, 'i'),
    build(m) {
      const names = [m[1] ?? '', ...(m[2] ?? '').split(/,|and/)]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const weekdays = [
        ...new Set(names.map((n) => DAYS[n]).filter((d): d is number => d !== undefined)),
      ].sort();
      const time = at(m[4], '09:00');
      return time && weekdays.length > 0 ? { kind: 'weekly', weekdays, time } : null;
    },
  },
  // every day / daily / every morning|evening|night [at 8]
  {
    re: new RegExp(`\\b(?:every\\s+(day|morning|evening|night)|daily)(?:\\s+at\\s+${TIME})?`, 'i'),
    build(m) {
      const part = (m[1] ?? 'day').toLowerCase();
      const fallback = part === 'evening' ? '18:00' : part === 'night' ? '21:00' : '09:00';
      const time = at(m[2], fallback);
      return time ? { kind: 'daily', times: [time] } : null;
    },
  },
  // every month on the 1st | on the last day of every month | monthly on the 15th [at 9]
  {
    re: new RegExp(
      `\\b(?:(?:every\\s+month|monthly)\\s+on\\s+the\\s+(?:${ORD}|(last)(?:\\s+day)?)|on\\s+the\\s+(?:${ORD}|(last)(?:\\s+day)?)\\s+of\\s+(?:every|each)\\s+month)(?:\\s+at\\s+${TIME})?`,
      'i',
    ),
    build(m) {
      const n = m[1] ?? m[3];
      const last = m[2] ?? m[4];
      const time = at(m[5], '09:00');
      if (!time) return null;
      if (last) return { kind: 'monthly', day: 'last', time };
      const day = Number(n);
      return day >= 1 && day <= 31 ? { kind: 'monthly', day, time } : null;
    },
  },
  // every year on 29 feb | on march 3 every year | yearly on 3 march [at 8]
  {
    re: new RegExp(
      `\\b(?:(?:every\\s+year|yearly|annually)\\s+on\\s+(?:${ORD}\\s+${MONTH}|${MONTH}\\s+${ORD})|on\\s+(?:${ORD}\\s+${MONTH}|${MONTH}\\s+${ORD})\\s+every\\s+year)(?:\\s+at\\s+${TIME})?`,
      'i',
    ),
    build(m) {
      const day = Number(m[1] ?? m[4] ?? m[5] ?? m[8]);
      const month = MONTHS[(m[2] ?? m[3] ?? m[6] ?? m[7] ?? '').toLowerCase()];
      const time = at(m[9], '09:00');
      return time && month && day >= 1 && day <= 31 ? { kind: 'yearly', month, day, time } : null;
    },
  },
  // in 20 min / in 2 hours / in an hour
  {
    re: new RegExp(`\\bin\\s+(\\d+|an?)\\s*${UNIT}\\b`, 'i'),
    build(m, now) {
      const n = /^an?$/i.test(m[1] ?? '') ? 1 : Number(m[1]);
      const minutes = minutesOf(n, (m[2] ?? '').toLowerCase());
      return minutes > 0 ? onceAt(addMinutes(now, minutes)) : null;
    },
  },
  // on 3 march / on march 3 [at 5pm]
  {
    re: new RegExp(`\\bon\\s+(?:${ORD}\\s+${MONTH}|${MONTH}\\s+${ORD})(?:\\s+at\\s+${TIME})?`, 'i'),
    build(m, now) {
      const day = Number(m[1] ?? m[4]);
      const month = MONTHS[(m[2] ?? m[3] ?? '').toLowerCase()];
      const time = at(m[5], '09:00');
      if (!time || !month) return null;
      let date = atTime(new Date(now.getFullYear(), month - 1, day), time);
      if (date.getMonth() !== month - 1) return null;
      if (date <= now) date = atTime(new Date(now.getFullYear() + 1, month - 1, day), time);
      return onceAt(date);
    },
  },
  // [on] monday [at 3pm]  (the next one)
  {
    re: new RegExp(`\\b(?:on\\s+|next\\s+)?${DAY}(?:\\s+at\\s+${TIME})\\b`, 'i'),
    build(m, now) {
      const target = DAYS[(m[1] ?? '').toLowerCase()];
      const time = at(m[2], '09:00');
      if (target === undefined || !time) return null;
      for (let k = 0; k <= 7; k++) {
        const d = atTime(addDays(startOfDay(now), k), time);
        if (d.getDay() === target && d > now) return onceAt(d);
      }
      return null;
    },
  },
  // tomorrow [morning|evening] [at 9] / today at 5 / tonight [at 9] / at 6pm
  {
    re: new RegExp(
      `\\b(?:(tomorrow|today|tonight)(?:\\s+(morning|afternoon|evening|night))?(?:\\s+at\\s+${TIME})?|at\\s+${TIME})`,
      'i',
    ),
    build(m, now) {
      const word = (m[1] ?? '').toLowerCase();
      const part = (m[2] ?? '').toLowerCase();
      const partTime: Record<string, string> = {
        morning: '09:00',
        afternoon: '14:00',
        evening: '18:00',
        night: '21:00',
      };
      const fallback = word === 'tonight' ? '21:00' : (partTime[part] ?? '09:00');
      const time = at(m[3] ?? m[4], fallback);
      if (!time) return null;
      if (word === 'tomorrow') return onceAt(atTime(addDays(startOfDay(now), 1), time));
      if (word === 'today' || word === 'tonight') {
        const d = atTime(now, time);
        return d > now ? onceAt(d) : null;
      }
      return onceAt(nextClock(now, time));
    },
  },
];

/** Turns "Call mom at 6pm" into a title and a schedule. */
export function quickParse(input: string, now: Date = new Date()): QuickParse {
  const text = input.trim().replace(/\s+/g, ' ');
  for (const matcher of MATCHERS) {
    const m = matcher.re.exec(text);
    if (!m) continue;
    const rule = matcher.build(m, now);
    if (!rule) continue;
    const title = cleanTitle(text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length));
    return { title: title || 'Reminder', rule };
  }
  return { title: cleanTitle(text), rule: null };
}

function cleanTitle(text: string): string {
  const t = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:please\s+)?(?:remind\s+me\s+(?:to\s+)?|reminder\s*:?\s*|to\s+)/i, '')
    .replace(/[\s,.;:–-]+$/u, '')
    .replace(/^[\s,.;:–-]+/u, '')
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
