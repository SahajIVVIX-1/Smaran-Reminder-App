# Desktop Notification Architecture

## 1. Multi-Window Notification Model

Instead of generic OS web popups, Smaran renders rich, customizable desktop notification cards inside dedicated transparent, frameless Electron `BrowserWindow` instances:

```
+-------------------------------------------------------------+
| [Vector Dots]  Normal / Important Title                     |
|                                                             |
| Notification Headline                                       |
| Affirmative text line or description note...                |
|                                                             |
| [==================== auto-hide progress bar =============] |
|                                                             |
| [ Done ]                 [ Snooze (15m) v ]             [X] |
+-------------------------------------------------------------+
```

---

## 2. Dynamic Height & Screen Stacking

1. **Initial Hidden Render:** When due, the window is created off-screen or transparently (`show: false`).
2. **Measurement (`IPC.notifMeasured`):** The React renderer renders the card content and measures actual bounding client dimensions (`getBoundingClientRect()`), sending `{ height, width }` back to the main process via IPC.
3. **Target Coordinate Calculation:** The main process positions the window at the configured corner (`settings.notification.corner`) on the target monitor (`settings.notification.screen`).
4. **Vertical Stacking:** Up to 4 active notifications stack vertically:
   - If a new card arrives, older cards smoothly shift position (`translateY`) to accommodate the new card.
   - If an existing card is closed, remaining cards shift down/up to close the gap.
5. **Smooth Entrance Animation:** Window is shown, and the card animates in using a directional slide and fade-in curve.

---

## 3. Mouse Hover & Unhover Safety Logic

- **Auto-Hide Progress Bar:** A thin animated indicator along the card edge tracks remaining time before dismissal.
- **Hover Pause:** Moving the mouse cursor over any part of the card pauses the auto-hide timer.
- **Heartbeat & Cursor Bounds Verification (`notifUnhover`):** In rapid mouse exits or OS focus switches, native browser DOM `mouseleave` events can fail to fire. Smaran solves this by polling Windows cursor coordinates (`screen.getCursorScreenPoint()`) from the main process. When the cursor exits the window's physical bounds, the main process broadcasts `IPC.notifUnhover`, immediately resuming the timer.

---

## 4. Expanded Cards for Automations & File Server

Smaran 3.4.1+ introduces expanded notification presentations for system operations:
- **Automation Cards:** Features countdown timer digits (5... 4... 3... 2... 1...), upcoming executable path, scheduled time, and `[Cancel]` / `[Run Now]` interactive buttons.
- **File Server & Security Cards:** Features access badges (LAN vs External), client IP, username, reason for failure, attempt counter (`repeatCount`), and buttons to `[Open File Server]` or `[View History]`.
