# Smaran 2.0.0

Smaran 2 is a rewrite of the Python reminder app. Same idea (styled popups on a schedule), rebuilt so it is predictable.

## New

- **Messages, Styles and Schedules are separate.** Each message uses a named style and can change any single field (an "override") without affecting others.
- **Many schedules.** Every few minutes or hours (with active hours and days), once, daily, weekly, monthly (including "last day") and yearly. Each schedule picks messages in order, at random, shuffled without repeats, or always the same one, from all messages or by tag.
- **Bursts with a clear rule** for when a schedule fires during a running burst: wait, skip or replace. Only one burst ever runs at a time.
- **Popups never take focus.** Drag one to move it; the spot is remembered for that message, also on a second monitor. Hover to keep it on screen. Right-click to snooze (5 / 15 / 60 min), dismiss the burst, or edit the message.
- **Tray menu:** show now, pause for 30 min / 1 h / until resumed, settings, about, quit. The tooltip shows the next reminder.
- **Quiet when busy:** reminders are skipped during full-screen apps, games, presentations and Windows quiet time.
- **Settings window** with live preview, test popup, explicit Save, undo for deletes, and keyboard shortcuts (Ctrl+S, Ctrl+N, Delete).
- **Backup:** full JSON backup and restore, CSV import/export of messages, and import of v1 `smaran_settings.json`.
- **Start at login** is a setting you control; the uninstaller removes it and asks whether to keep your data.
- **Portable edition** keeps its data in a `SmaranData` folder next to the exe.

## Fixed from v1

- Messages with the same text no longer share settings; renaming a message keeps its look.
- "Show now" during a burst no longer starts a second chain of popups.
- Dragging an old popup no longer moves a different message.
- Monthly reminders on the 29th–31st and yearly reminders on 29 February fire in short months and years.
- One-time reminders turn themselves off after firing.
- Reminders missed while the PC was asleep fire once after it wakes.
- Settings are saved in `%APPDATA%\Smaran`, so installing under Program Files works.

## Known limits

- Builds are not code-signed yet, so Windows SmartScreen shows a warning on first run.
- Windows does not tell apps about Focus Assist's "priority only" mode, so that mode is only respected when Windows reports quiet time.
