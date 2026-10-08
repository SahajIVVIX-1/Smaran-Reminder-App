# Smaran 2.1: how reminders work

Smaran 2.0 followed the original plan: separate Messages, Styles and Schedules, wired together by
pickers and "bursts" that showed the same popup several times in a row. It worked, but it is not how
people think about reminders. 2.1 is redesigned around one idea: **a reminder is a thing you want to be
told, at a time you choose, that you can act on.**

## The model

**Reminder** is the only thing users create:

| Field | Meaning |
| --- | --- |
| Title | What to remember: "Drink water", "Call mom". |
| Note | Optional detail shown under the title. |
| Rotating lines | Optional list of lines shown one at a time (in order or shuffled), for affirmations or stretch ideas. |
| Repeat | Once, every N minutes/hours (with active hours and days), daily at times, weekly, monthly (incl. last day), yearly. |
| Priority | **Normal**: hides itself after a few seconds, respects quiet hours and full-screen apps. **Important**: stays until you act, comes through quiet hours, plays a sound. |
| Follow-up | If you don't act on it, remind again every N minutes, up to M times. Replaces 2.0's "burst". |
| Colour | A label colour, shown on the notification and in lists. |

There are no per-reminder fonts and borders any more: notifications share one clean look (light/dark,
three sizes), like every professional notification system. Position is one setting (corner + screen).

## What happens when a reminder is due

1. **Paused?** Nothing is shown; recorded as *skipped*.
2. **Quiet hours** (normal priority): repeating-interval reminders are *skipped*; time-of-day reminders
   (once, daily, weekly…) are **held** and shown when quiet hours end, marked "Delayed".
3. **Full-screen app, game or presentation** (normal priority, if enabled): the notification is held and
   shown when you're back, marked "Delayed". A newer occurrence of the same reminder replaces a held one.
4. Otherwise a notification card slides in. Several due at once **stack** in the corner (up to 4 visible).

On the card: **Done**, **Snooze** (5 min / 15 min / 1 hour / tomorrow morning), and **×** to dismiss.
Hovering pauses the auto-hide timer (a thin bar shows the time left).

| You… | Recorded as | Then |
| --- | --- | --- |
| press Done | done | Follow-ups cancelled. A one-time reminder is marked completed. |
| snooze | snoozed | Shown again at the snooze time. Its normal schedule continues. |
| press × | dismissed | Follow-ups cancelled. |
| ignore it until it hides | missed | If follow-up is on, it comes back after N minutes (up to M times). |

## Time

- No polling. Each reminder's next time is computed (DST-safe, month-end and 29 Feb clamped), one timer
  is set for the earliest, and everything is recomputed after each change, wake from sleep and unlock.
- **Missed while asleep or closed:** a time-of-day reminder that was due shows **once** as "Missed at
  09:00" (after a restart, at most 3 individually; more are summarised). An overdue interval reminder
  shows once on wake, then continues from now; it never fires the moment Smaran starts. One-time
  reminders more than 12 hours late are recorded as missed without a popup.

## The app

- **Today**: greeting, what's next, today's timeline, snoozed items and what already happened today.
- **Reminders**: all reminders with search; click one to edit it in a side panel. Changes save
  automatically; deleting can be undone.
- **History**: the last 1,000 events by day (done, snoozed, missed, skipped…).
- **Settings**: start at login, theme, notification position/size/sound, default auto-hide time,
  quiet hours, full-screen behaviour, backup and restore.
- **Quick add** understands plain phrases: "stretch every 45 min", "call mom at 6pm",
  "pay rent on the 1st at 9am", "standup every weekday at 9:30", "drink water in 20 min".

## Upgrading

2.0 configs and v1 (Python) settings files are migrated: each 2.0 schedule becomes a reminder, its
messages become rotating lines, and its burst becomes a follow-up.
