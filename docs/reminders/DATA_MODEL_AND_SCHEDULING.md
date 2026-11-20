# Reminder Data Model & Scheduling Engine

## 1. Reminder Data Model

The complete reminder entity is validated by `ReminderSchema` in `src/shared/schema.ts`:

```typescript
export interface Reminder {
  id: string;                               // crypto.randomUUID()
  title: string;                            // 1-200 characters
  note: string;                             // Up to 2000 characters
  lines: string[];                          // Rotating messages (up to 200 entries)
  lineOrder: 'inOrder' | 'shuffle';         // Sequential or random rotation
  enabled: boolean;                         // Active scheduling switch
  rule: Rule;                               // Schedule rule definition
  priority: 'normal' | 'important';         // Normal (auto-hide) vs Important (permanent)
  hideAfterSec: number | null;              // Per-reminder auto-hide override (0 = permanent)
  followUp: {
    enabled: boolean;
    everyMin: number;                       // 1 to 240 minutes
    times: number;                          // 1 to 20 repetitions
  };
  color: 'clay' | 'amber' | 'olive' | 'sage' | 'sky' | 'iris' | 'rose' | 'slate';
  sound: 'default' | 'on' | 'off';          // Audio chime policy
  animation: string;                        // Vector dots choreography key or 'auto'
  card?: CardShape;                         // Optional custom card geometry
  motion?: NotificationMotion;              // Optional custom Attention Motion
  createdAt: string;                        // ISO 8601 with offset
  updatedAt: string;                        // ISO 8601 with offset
}
```

---

## 2. Schedule Rules (`RuleSchema`)

A reminder's firing time is governed by one of six discriminated union kinds:

```typescript
export type Rule =
  | {
      kind: 'interval';
      everyMs: number;                      // Minimum 60,000 ms (1 minute)
      activeHours?: { from: string; to: string }; // e.g. 09:00 -> 17:00
      weekdays?: number[];                  // 0 (Sun) to 6 (Sat)
    }
  | {
      kind: 'once';
      at: string;                           // ISO datetime without offset
    }
  | {
      kind: 'daily';
      times: string[];                      // Array of 'HH:mm' times (min 1)
    }
  | {
      kind: 'weekly';
      weekdays: number[];                   // Array of weekdays (min 1)
      time: string;                         // 'HH:mm'
    }
  | {
      kind: 'monthly';
      day: number | 'last';                 // 1-31 or 'last' (handles 28/29/30/31 days)
      time: string;                         // 'HH:mm'
    }
  | {
      kind: 'yearly';
      month: number;                        // 1 to 12
      day: number;                          // 1 to 31
      time: string;                         // 'HH:mm'
    };
```

---

## 3. Next Fire Time Calculation (`src/shared/nextFireAt.ts`)

The scheduling engine computes exact upcoming trigger timestamps using `computeNextFireAt()`:
- **No Periodic Polling:** Smaran does not poll the clock every second. Instead, it computes the exact millisecond delta to the earliest scheduled event across all reminders and sets a single precision timer via `setTimeout`.
- **Clamping & Month-End Protection:**
  - In `monthly` rules with `day: 'last'`, the engine inspects `new Date(year, month + 1, 0).getDate()` to guarantee correct firing across leap years and months with 28, 30, or 31 days.
  - In `yearly` rules scheduled for February 29th, non-leap years automatically clamp to February 28th.
- **DST (Daylight Saving Time) Drift Protection:** All time-of-day computations convert local wall-clock hours and minutes explicitly rather than adding raw `86,400,000` ms increments, preventing 1-hour time shifts across DST transitions.

---

## 4. Natural Language Quick Add Syntax (`src/shared/quickParse.ts`)

Smaran allows instantaneous creation of reminders through human natural language phrases:

| Input Phrase | Interpreted Rule | Firing Behavior |
|---|---|---|
| `"drink water every 45 min"` | `interval`, `everyMs: 2700000` | Fires every 45 minutes continuously |
| `"standup every weekday at 9:30"` | `weekly`, `weekdays: [1,2,3,4,5]`, `time: '09:30'` | Fires Monday through Friday at 9:30 AM |
| `"call mom at 6pm"` | `daily`, `times: ['18:00']` | Fires daily at 6:00 PM |
| `"pay rent on the 1st at 9am"` | `monthly`, `day: 1`, `time: '09:00'` | Fires on the 1st of every month |
| `"billing on the last day at 5pm"` | `monthly`, `day: 'last'`, `time: '17:00'` | Fires on the final day of each month |
| `"doctor appointment on Oct 15 at 2pm"` | `once`, `at: '2026-10-15T14:00:00'` | Fires once at specified date and time |
