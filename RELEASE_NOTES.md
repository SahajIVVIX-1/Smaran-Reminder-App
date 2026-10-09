# Smaran 2.9.1

- **Smoother moving logo.** The title-bar dots were drawn through a "liquid" filter that has no
  anti-aliasing, which made their edges look jagged at small sizes. Below 48 px the dots are now
  drawn as clean, anti-aliased lines (the liquid merge stays on for bigger logos).
- The taskbar button frames are drawn at 64 px and scaled down by Windows, so their edges are
  smoother too.

---

# Smaran 2.9.0

- **Your dots logo.** Three dots that dance, flow into shapes and settle into an S with a reminder
  dot. They live top left in the title bar and follow what Smaran is doing; the app, installer and
  .exe icons are the still S.
- **Animated tray and taskbar icon.** The notification-area icon (Shell_NotifyIcon) and the taskbar
  button are animated frame by frame: the dots form the S at start-up, ring a bell while a reminder
  is on screen, show a check when you press Done, an hourglass when you snooze, a moon while paused
  or in quiet hours, and a clock when a reminder is under a minute away. When nothing is happening
  the S stays still (no CPU use) and now and then, or when you rest the pointer on it, does a short
  dance.
- The S is drawn dark on a light taskbar and light on a dark one, and switches when you change
  Windows' mode.

---

# Smaran 2.8.0

- **Anthropic type, mixed.** Titles, section headings and reminder titles use Anthropic Serif;
  text and buttons use Anthropic Sans; times, time fields and menu shortcuts use Anthropic Mono.
  Dates, notes, hints and empty states are set in Serif italic. (Each falls back to its bundled
  open stand-in until the real font is installed.)
- **Title Case labels.** Buttons, titles, tabs and menus now read "New Reminder", "Show Now",
  "Clear History", "Pause Reminders" and so on. Descriptions stay in sentence case.
- The font setting is now **Text Font** and defaults to Anthropic Sans. If you were on the old
  default (Anthropic Serif), you're moved to Anthropic Sans; a font you picked yourself is kept.

---

# Smaran 2.7.0

- **New colourful logo.** The S mark is replaced by the bloom: six rounded petals in six colours,
  turning around a shared centre, with no square tile behind it. The app icon, installer, taskbar,
  window, About box and tray all use it. The wordmark is set in Source Serif 4.
- The tray icon still matches the taskbar: a light-taskbar version, and a dark-taskbar version with
  brighter petals.

---

# Smaran 2.6.0

- **New logo and icons.** The placeholder icon is replaced by Smaran's own mark: a single-stroke S
  with a reminder dot. The installer, the .exe, the taskbar, the window and the About box use the
  new app icon (a white mark on an accent tile).
- **Tray icon follows the taskbar.** It uses a dark glyph on a light taskbar and a white glyph on a
  dark one. Windows lets the taskbar's mode differ from apps' mode, so Smaran reads the taskbar's
  own setting and updates within moments when you change it.
- The full brand kit (SVG sources, PNGs, .ico files, colours and rules) is in `branding/`.

---

# Smaran 2.5.0

- **Themed right-click menus everywhere.** The tray icon, notifications, reminders in the list and
  every text field now open Smaran's own rounded menu (in your theme and font) instead of the plain
  Windows one, with separators, shortcut hints and Delete in red.
  - Notification: Done, Snooze (5 min, 15 min, 1 hour, Tomorrow), Open Smaran, Dismiss.
  - Reminder row: Edit, Show now, Duplicate, Turn on/off, Delete. A focused row also deletes with Del.
  - Text fields: Undo, Redo, Cut, Copy, Paste, Select all.
- **Softer border light.** Google's colours now blend into one another along a light with faded,
  rounded ends. It travels a little slower and, like a real loading indicator, speeds up and eases
  off within each lap while it stretches and shrinks.
- **Tighter stack.** Several reminders on screen now sit 8 px apart, spaced by the size they show
  (a small pill or the opened card) instead of the room their window keeps for opening.

---

# Smaran 2.4.0

- **Border light instead of a countdown.** A short light in Google's colours now travels round the
  notification's border at a steady pace, like a loading indicator, with a soft glow.
- **Choose your font.** Settings → General → Font lists every font installed on this PC, three fonts
  bundled with Smaran (Source Serif 4, Inter, JetBrains Mono), and Anthropic Serif, Sans and Mono.
  The default is Anthropic Serif. "Add font files…" copies .ttf/.otf/.woff files into Smaran so a
  font works even if it isn't installed in Windows. The font applies to the app and to reminders.
- Anthropic's typefaces can't be shipped inside the app; until you install or add them, Smaran shows
  the bundled open stand-ins (Source Serif 4, Inter, JetBrains Mono) in their place.

---

# Smaran 2.3.1

- The notification pill shows the title in a larger font, in the same size box, without the colour dot.
- The countdown bar is gone: the time left now runs around the card's border as a glowing ring in
  Google-style colours (blue, red, yellow, green) that drift around it. Important reminders, which
  don't hide themselves, show the full ring.

---

# Smaran 2.3.0

- **Notifications start as a small pill** showing just the title. Hover to expand it into the full
  card (app name, time, close, Done/Snooze); move away and it folds back. The empty space around a
  card no longer blocks clicks on the apps beneath it.
- **Themed pickers everywhere:** dropdowns, the time picker and the calendar now match the app in
  light and dark instead of using Windows' system pop-ups. Number fields have − / + steppers.
- **Everything closes smoothly:** the editor, dialogs, dropdowns and toasts animate out as well as in.
- **A living app mark:** the spark in the top-left gently turns and breathes while Smaran is saving,
  loading, backing up or showing a reminder, and settles when it's done.

---

# Smaran 2.2.1

- The reminder editor is now a centred popup instead of a side panel, so it no longer collides with
  the window's minimise/maximise/close buttons.
- The schedule picker's highlight slides between choices and the fields below change height smoothly.
  "Every…" is now "Repeat every"; the "All day" and "Every day" buttons sit on the same line.
- In dark mode the glass sidebar stays dark and readable even with a white window behind it.

---

# Smaran 2.2.0

- **Phone-style notifications.** Reminders slide down from the top of the screen, then reveal Done
  and Snooze once they land. Swipe a card back up to dismiss it. Cards are smaller and stack neatly.
- **Sound per reminder.** Each reminder can follow the app setting, always chime, or stay silent.
- **Compact, glassy look.** Tighter spacing throughout; on Windows 11 the window uses the system's
  acrylic backdrop. Dark is now the default.
- Existing settings that were still at the old defaults (system theme, bottom-right corner) move to
  the new ones; anything you changed is kept.

---

# Smaran 2.1.0

A redesign of how reminders work and how the app looks. See `docs/DESIGN.md` for the reasoning.

## One idea: the reminder

- **Messages, Styles and Schedules are gone.** You now create a *reminder*: a title, an optional note,
  when it repeats, and how insistent it is. Settings carry over automatically from 2.0 and v1.
- **Quick add:** type it the way you'd say it: "stretch every 45 min", "call mom at 6pm",
  "standup every weekday at 9:30", "pay rent on the 1st of every month".
- **Priority:** *Normal* reminders hide themselves after a few seconds and wait during quiet hours and
  full-screen apps. *Important* ones stay until you act and always come through.
- **Follow-up** replaces bursts: if you ignore a reminder, Smaran asks again every few minutes, a set
  number of times.
- **Rotating lines:** one reminder can cycle through stretches, affirmations or tips, in order or shuffled.

## Notifications

- Cards slide in from the corner you choose, stack neatly (up to four), and never take focus.
- **Done**, **Snooze** (5 min, 15 min, 1 hour, tomorrow morning) and dismiss, right on the card. A thin
  bar shows how long the card stays; hovering pauses it.
- Optional soft chime. Three sizes. Light or dark to match the app.

## Calm by default

- **Quiet hours**: repeating reminders are skipped; timed ones wait until quiet hours end.
- **Full-screen apps, games and presentations**: reminders wait until you're back.
- **Missed reminders** (PC asleep or off) show once, marked "Missed at 09:00", instead of piling up.

## A new app

- Rebuilt interface in the spirit of the Claude desktop app: warm neutral colours, serif headings,
  a clean sidebar, smooth transitions, light and dark themes.
- **Today** shows what's next and today's timeline. **History** records what happened to every
  reminder: done, snoozed, missed or skipped.
- Changes save as you make them; deleting can be undone.

---

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
