# Reminder Settings & Scheduling Rules

The **Reminder Settings** tab configures default reminder behaviors, timing windows, snooze options, quiet hours, and busy app suppression.

---

## 1. Timing & Auto-Dismissal Behavior

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Default Auto-Hide Duration** | `settings.notification.hideAfterSec` | `number \| null` | `10` sec | `3` to `600` sec, or `0` | Seconds a normal notification card remains on screen before automatically hiding. Setting to `0` or `null` makes notifications **permanent** on screen until the user explicitly clicks `Done`, `Snooze`, or `Dismiss`. |
| **Hover Pause** | Hardcoded behavior | Logic | Always Active | On/Off | Moving the mouse cursor over a notification card immediately pauses the auto-hide timer. A thin progress bar indicates remaining time. |
| **Cursor Screen Bounds Tracking** | OS-level tracking | Logic | Always Active | Polled | Smaran polls OS screen coordinates (`screen.getCursorScreenPoint()`) to verify cursor position, ensuring cards unfreeze and smoothly dismiss even if the mouse rapidly leaves the window without firing standard DOM mouseleave events. |

---

## 2. Priority Modes

Each individual reminder belongs to one of two priority tiers:

### A. Normal Priority (`priority: 'normal'`)
- Slides in smoothly according to the configured corner and position.
- Auto-hides after the configured seconds (or remains permanent if set to `0`).
- **Quiet Hours:** Repeating interval reminders are automatically *skipped*. Time-of-day reminders (once, daily, weekly) are *held* and presented when quiet hours conclude, marked with a "Delayed" badge.
- **Full-Screen / Presentation Apps:** If `holdWhenBusy` is enabled, the notification is held while gaming, watching full-screen video, or presenting, and appears once the user exits full screen.

### B. Important Priority (`priority: 'important'`)
- **Always Stays:** Remains on screen permanently until the user actively interacts with it (`Done`, `Snooze`, or `Dismiss`).
- **Bypasses Quiet Hours:** Fires immediately regardless of quiet hours or "Do Not Disturb" settings.
- **Bypasses Busy State:** Presents even if full-screen mode is detected.
- **Audible Chime:** Plays a distinctive sound notification.

---

## 3. Snooze & Follow-Up System

### Snooze Presets
Clicking the `Snooze` button on any notification presents quick presets:
- `5 minutes`
- `15 minutes`
- `30 minutes`
- `1 hour`
- `Tomorrow morning` (09:00 AM)
- Custom snooze picker

When snoozed, the reminder status updates to `snoozed`, and the engine registers an interrupt timer for the exact resumption timestamp without disrupting the reminder's recurring base schedule.

### Follow-Up Bursts (`followUp`)
For critical tasks, reminders can be configured with an automated follow-up policy:
```typescript
followUp: {
  enabled: boolean;   // true = automatically re-trigger if missed
  everyMin: number;  // 1 to 240 minutes between follow-up attempts
  times: number;     // 1 to 20 maximum follow-up repetitions
}
```
If a notification auto-hides without user interaction, it is recorded in History as `missed`. If `followUp.enabled` is `true`, the engine schedules another notification in `everyMin` minutes, repeating up to `times` cycles until the user clicks `Done` or `Dismiss`.

---

## 4. Quiet Hours & Busy Hold

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Quiet Hours Toggle** | `settings.quietHours.enabled` | `boolean` | `false` | `true`, `false` | When enabled, silences and defers normal notifications during a configured daily time window. |
| **Quiet Hours Window** | `settings.quietHours.from`, `to` | `Time` | `22:00` → `07:00` | `'HH:mm'` 24hr | Supports overnight windows where `from > to` (e.g. 10:00 PM to 7:00 AM). Validated to ensure start and end times differ. |
| **Hold When Busy** | `settings.holdWhenBusy` | `boolean` | `true` | `true`, `false` | Detects foreground full-screen windows (games, PowerPoint presentations, movies) via Windows user32 APIs and holds normal notifications until the user exits full-screen mode. |

---

## 5. Missed Reminder Handling (Sleep, Wake & Restart)

Smaran features sophisticated recovery logic when the computer was asleep or turned off:
1. **Time-of-Day Reminders (Daily, Weekly, Monthly, Once):**
   - If scheduled during sleep, they fire once upon waking as `"Missed at HH:mm"`.
   - After a system restart, at most 3 missed reminders are presented individually; if more than 3 are overdue, they are consolidated into a single summary alert to prevent notification flooding.
   - One-time reminders more than 12 hours overdue are recorded as `missed` in History without displaying a disruptive popup.
2. **Interval Reminders (Every N Minutes):**
   - Overdue interval reminders show once upon waking, and their schedule is re-aligned starting from the current wake time. They never fire in a rapid burst of accumulated triggers.
