# Smaran 3.1.0

- **Smaran HFS (Self-Hosted HTTP File Server Engine):** Built a complete, native HTTP file server engine inside Smaran Reminder, inspired by Rejetto HFS. Operates independently with zero external installations or services required.
- **LAN Web File Manager:** A responsive, dark-mode web file manager served directly over Wi-Fi and LAN (`http://<LAN-IP>:5900`). Any phone, tablet, or PC on the same network can browse shared files, upload, download, and manage folders without installing Smaran.
- **In-App Server Control Dashboard:** Added a dedicated "File Server" navigation section in Smaran Reminder featuring Overview (live status, LAN URLs, QR code scanner for mobile, bandwidth gauges), in-app File Manager, Active Transfers monitor, Shared Links manager, Users & Permissions matrix, Server Settings, and live Audit Logs.
- **HTTP Range Requests & Resumable Downloads:** Full support for RFC 7233 byte-range requests (`206 Partial Content`), enabling large file streaming (video/audio playback) and resumable multi-gigabyte downloads.
- **Secure Link Sharing:** Generate tokenized share links with custom permissions (download, stream, upload), expiration deadlines, maximum download counts, and optional password protection.
- **Multi-User Authentication & Role Permissions:** Configurable guest access, user accounts (Admin, User, Guest), and granular per-user permissions (read, upload, delete, rename, folder creation).
- **Reminder Attachment Integration:** Users can now attach documents, spreadsheets, media, and scripts from their internal File Server directly to any reminder.

---

# Smaran 3.0.2

- **Fixed Screen Border Light Visibility:** Resolved an issue where the screen border light overlay remained invisible. Restored the IPC fade-in / fade-out bindings (`window.__borderFadeIn` and `window.__borderFadeOut`), added resilient multi-selector element lookup for the border container, and ensured the animation loop starts immediately on display.
- **Architectural Vector Decoupling:** Relocated `PerimeterRect` and vector beam slicing math to `@shared/perimeter`, providing shared TypeScript typing, zero runtime overhead, and comprehensive unit test coverage.

---

# Smaran 3.0.1

- **Uninstaller Window 5-Second Auto-Close:** Fixed an issue where the always-on-top uninstaller card could remain stuck on screen after completing. The final "Goodbye for now / Smaran was removed" screen now cleanly closes and exits after exactly 5 seconds, and provides a direct "Close now" button along with `Escape` / `Enter` keyboard dismissal for immediate exit.

---

# Smaran 3.0.0

- **Zero-Box Vector Screen Border Light:** Completely eliminated the square boxes and discrete micro-segment artifacts while the beam is moving. Re-engineered the perimeter renderer using continuous, native hardware-accelerated linear gradients along each screen edge, cutting draw calls from 167 down to 3 per frame for a silky-smooth, fluid laser beam with zero stairsteps.
- **Professional 10-Second License Verification:** When activating a license in portable mode, Smaran now performs a realistic 10-second cryptographic verification sequence with a smooth progress bar, dynamic step status messages, and Material spinner animation.
- **Animated Error State on Invalid License:** If an invalid or unauthenticated file is provided, Smaran displays an animated error cross with a responsive shake animation and clear diagnostic message, contrasting cleanly with the success checkmark.
- **Permanent Lifetime License Card:** Added dedicated support and generator for 100-year permanent licenses featuring a high-resolution dark obsidian card with multi-color neon perimeter border, gold VIP lifetime badge, and offline Ed25519 cryptographic seal.

---

# Smaran 2.16.12

- **Crisp Rectangular Corner Tracking:** Completely eliminated the corner shape warping ("freaking out"). The border light now tracks the true rectangular edges of your screen all the way into the corners with exact 90-degree miter turns, removing artificial inward rounding, diagonal chord-cutting, and corner jitter.
- **Dynamic "Loading" Rhythm & Kinetics:** Instead of moving like a rigid flat bar, the border light now behaves like an authentic modern loading indicator. Features dynamic breathing beam length (elastic expansion from 9% up to 30% of perimeter during surges), accelerated forward surges, rapid tail catch-up, and pulsating luminescence.

---

# Smaran 2.16.11

- **Fixed Screen Border Settings Layout:** Resolved UI text overlapping and layout collision in Settings › Notifications. Each setting (Screen border light toggle + preview, Border thickness presets + slider, Border brightness) is now cleanly organized into its own structured, perfectly aligned row matching the application's design system.

---

# Smaran 2.16.10

- **Native Windows System Tray Menu:** Right-clicking the system tray icon now opens a seamless native Windows context menu powered directly by Windows shell integration. The system tray overflow area (`^`) stays open properly without collapsing prematurely.
- **Zero Floating Window Glitches:** Completely eliminates the issue where custom popup windows got stuck floating on screen after the system tray closed.
- **Instant Click-Away Dismissal:** Clicking anywhere outside immediately and smoothly dismisses the context menu without any lag or delay.
- **Full Native Accessibility:** Supports native keyboard navigation (`Up`, `Down`, `Enter`, `Escape`) and Windows high-contrast / dark mode themes.

---

# Smaran 2.16.9

- **True Hairline-to-Thick Precision:** Screen border light now scales with genuine visual fidelity from an ultra-thin 1px laser hairline up to 24px thick. Glow dispersion scales proportionally with thickness so thin lines stay truly thin without spreading across the screen.
- **Zero Pixelation & Zero Square Blocks:** Re-engineered with an antialiased, hardware-accelerated Canvas 2D perimeter engine. Uses sub-pixel interpolation, smooth circular caps, rounded corner turns, and continuous linear color gradients—completely eliminating angular stepping, pixelated aliasing, and square block artifacts.
- **Hairline Preset in Settings:** Added a dedicated 1px Hairline preset alongside Thin (2px), Medium (4px), Thick (8px), and Very Thick (14px/20px).

---

# Smaran 2.16.8

- **Screen Border Thickness Control:** Control the screen border light thickness continuously from hairline very thin (1px) up to thick (24px), complete with quick presets (Very Thin, Thin, Medium, Thick, Very Thick) and a fine-tuning slider in Settings.
- **High-Intensity Brightness & Radiance:** Dramatically boosted luminance with an electric neon palette, multi-layer ambient bloom, intense glow, and white-hot core accents, plus customizable brightness levels (Standard, High, Ultra Vivid).
- **Smooth Fade-In & Fade-Out Transitions:** Screen border illumination enters exclusively with a silky-smooth fade-in and exits with a graceful fade-out when notifications are dismissed, without any abrupt disappearance or flickering.
- **Instant Live Screen Preview:** Test and preview your border light thickness and brightness directly on your screen with one click from Settings before reminders arrive.

---

# Smaran 2.16.7

- **Screen Border Light:** An animated, moving multi-color beam circles the perimeter of your entire screen while notifications or tasks are active, matching the notification card's border light with ambient edge illumination until dismissed.
- **Fluid UI Animation System:** Comprehensive, unified motion design across every screen powered by Motion (Framer Motion) and spring-damped CSS transitions.
- **Buttery-smooth Page & Tab Transitions:** Every navigation between pages and tabs now cross-fades and glides naturally without sudden jumps or layout shifts.
- **Tactile Button & Card Feedback:** All buttons and cards now provide subtle hover elevation, active press scaling, and fluid focus feedback.
- **Smooth Dropdowns & Modals:** Modals, dialogs, and popovers now enter and exit with smooth spring deceleration.
- **Shimmering Skeleton States:** Loading states now feature smooth shimmering placeholders.
- **Reduced Motion Respect:** Full accessibility support respecting the user's system reduced-motion preferences.

---

# Smaran 2.16.6

- **Permanent & custom duration for notifications:** Notifications can now be set to stay on screen permanently until you dismiss or snooze them, or for any custom number of seconds you choose.
- **Global and per-reminder control:** Configure notification stay-duration and attention motion/fade styles globally in Settings or override them per reminder.
- **Custom fade settings:** Fine-tune the fade visible duration and transition speeds with presets or exact custom seconds.
- **Tabbed navigation in reminder settings:** The reminder editor is now organized into four focused tabs (Details, Timing, Notification, Lines) with live card previews, eliminating endless vertical scrolling.

---

# Smaran 2.16.5

- **Attention-grabbing notification motions.** Choose how notifications announce themselves:
  Fade Cycle, Bounce & Spring, Breathing Pulse, Attention Shake, or Classic Slide.
- **Fade Cycle.** Notifications can fade in, stay visible for a few seconds, fade out, and repeat
  rhythmically during the message duration so you never miss an alert.
- **Custom settings per motion type.** Fine-tune visible duration, fade speeds, bounce springiness,
  glow effects, and shake intervals tailored to each motion style.
- **Smart hover & live preview.** Hovering immediately pauses all motion and restores 100% steady
  visibility for easy reading, mirrored in the real-time Settings preview.

---

# Smaran 2.16.4

- **Tabbed navigation in Settings.** Settings are now organized into five focused sub-tabs:
  General, Notifications, Focus, Animations, and Your Data.
- **No more endless scrolling.** Find the setting you need instantly without scrolling through
  one long page.
- **Smooth transitions & full keyboard navigation.** Switch tabs with arrow keys or a click,
  complete with fluid entrance animations and accessible tab panel semantics.

---

# Smaran 2.16.3

- **Shape your unhovered notifications.** Notification Shape now controls the initial card
  that appears before hover, letting you decide its width, height, corner roundness and inner
  space when it arrives.
- **Auto modes.** Each shape property has an Auto option: width and height fit content,
  roundness forms a smooth capsule, and spacing uses defaults, or you can dial in custom values.
- **Interactive preview.** The shape preview shows your initial notification at real size and
  expands on hover, matching how notifications behave on screen.

---

# Smaran 2.16.2

- **Uninstalling always works.** If Smaran was still running (even when it had been started as
  administrator), the uninstaller couldn't remove it. Setup and the uninstaller now close any
  running Smaran themselves, asking Windows' permission only when they have to, and wait for its
  files before removing them.
- **Setup opens Smaran with your normal rights**, never as administrator.
- **A shape for each reminder.** In a reminder's editor, Notification Shape lets that reminder's
  card have its own width, height and corner roundness, with a live preview. Leave "Use the shape
  from Settings" on to follow Settings.

---

# Smaran 2.16.1

- **Shape your notifications.** Settings › Notifications has sliders for the card's width,
  height and corner roundness, with a live preview and Reset to Default. They apply to every
  card: reminders, snoozed ones, automation countdowns and test notifications. Height fits the
  text unless you choose your own (longer text is then cut off).
- **Licenses** have a new product identity, and their messages are simpler. Licenses you already
  have keep working.

---

# Smaran 2.16.0

- **Setup installs again.** In 2.15.0, on a PC without a license, Setup could keep spinning
  "Installing…" without asking for the license. It now asks as intended.
- **A Smaran-styled uninstaller.** Uninstalling (Settings › Apps) now shows the same floating
  card as Setup: confirm, an option to delete your reminders, automations and settings too, and
  a progress bar. Your license is kept, so reinstalling later doesn't ask for it again.
- **Setup and the uninstaller stay put.** Their cards can't be dragged around, and right-clicking
  them does nothing.
- **Licenses show the IP address they were issued from**, on the License page. Licenses from
  2.15.0 need to be issued again.

---

# Smaran 2.15.0

- **Licenses.** Smaran now needs a license to install and to open.
  - **Activate:** Setup asks for your license image before installing (unless this PC already
    has one), and Smaran asks for it when it opens until a valid one is imported.
  - **License page:** a new page above Settings shows the status, name, ID, duration, issue and
    expiry dates, and lets you import or replace the license.

---

# Smaran 2.14.0

- **Automations.** A new page in the sidebar runs tasks for you, like a friendly Task Scheduler.
  - **When:** at a date and time or on a repeat (the same choices as reminders: once, every N
    minutes, daily, weekly, monthly, yearly); when the computer starts, when you sign in or when
    Smaran opens (with an optional wait); or on a Windows event: lock, unlock, sleep, wake, charger
    plugged in or unplugged, away for N minutes, or back after being away.
  - **Do:** lock, sign out, sleep, hibernate, shut down or restart; open an app (with arguments);
    open any file (PDF, document, folder…); run a script (.bat, .cmd, .ps1, optionally without a
    window); open a link in your default browser or one you pick (Chrome, Edge, Firefox… found
    automatically, with a private-window option). Chain up to 20 steps, with a wait before each.
  - **Safe by default:** before signing out, sleeping, hibernating, shutting down or restarting, a
    Smaran card counts down 30 seconds (you can change or turn this off) with **Cancel** and
    **Run Now**. Times missed while the PC was asleep or off are skipped, never run late.
  - Each run shows in History as Ran, Failed (with the reason), Cancelled or Skipped, under a new
    **Automations** filter. **Run Now** tries one at once; ideas on the page get you started.
  - Automations run while Smaran is running, so keep “Start When I Sign In” on. They are included
    in backups.

---

# Smaran 2.13.0

- **Anthropic Serif everywhere.** The whole app now uses Anthropic Serif as its default text font.
  If you were on the old default, you move over automatically; a font you picked yourself is kept.
- **A softer label on notifications.** The card now says *Smaran* in italic Anthropic Serif
  instead of "SMARAN".
- **Bold, italic, underline and strikethrough in titles.** Select words in a reminder's title and
  click B, I, U or S (or press Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+X), just like the note. Styled
  titles show on the notification, Today, Reminders and History.

---

# Smaran 2.12.0

- **A new installer.** Smaran Setup is now a floating Smaran card that stays on top, with the
  colour light running round its border, liquid dots, a progress bar and a twinkling spinner with
  rotating words. It starts installing as soon as you open it (no wizard pages) and opens Smaran
  when it is done. Updating over an earlier version keeps your reminders and settings.
- **Uninstall** from Settings › Apps as before: it removes the shortcuts and start-at-login entry
  and asks whether to delete your messages and settings.
- **Bold, italic, underline and strikethrough in notes.** Select words in a reminder's note and
  click B, I, U or S (or press Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+X). The note shows the style on
  the notification card. Rotating lines accept the same marks: `**bold**`, `*italic*`,
  `__underline__`, `~~strike~~`.

---

# Smaran 2.11.3

- **Liquid merge, smooth for real.** With Liquid Merge on, the dots are drawn at twice the size on
  their own layer and scaled down, so the edges stay smooth while they move instead of showing
  pixels. (Turning it on or off also no longer stops the animation until a restart.)

---

# Smaran 2.11.2

- **Smooth liquid merge.** With Liquid Merge on, the dots no longer look pixelated or flicker: the
  merge now uses a soft edge, so they stay anti-aliased at every size.

---

# Smaran 2.11.1

- **The app icon stays put on the taskbar.** The taskbar button always shows Smaran's icon; only the
  tray icon animates.
- **The icon on the installer.** The installer and uninstaller use the app icon, and their welcome,
  finish and other pages show it too (a side panel with the icon and name, and a header).

---

# Smaran 2.11.0

- **Thinner colour bar.** The light that runs round a notification is now 1 px with a softer glow.
- **The dots on every notification.** The bell icon beside the title is replaced by the Smaran
  dots. By default they run in Auto (dancing and forming shapes); each reminder can pick one
  animation instead under **Animation** in its editor (Choose… opens the full browser).

---

# Smaran 2.10.0

- **259 logo animations.** The dots now know 126 dances in 8 families (loaders, choreography,
  illusions, orbits and space, physics, nature, juggling and sport, mechanics) and 133 shapes in 10
  families (time, communication, writing and work, status, tech, media, nature and weather,
  objects, science and symbols, letters and digits), with 3D depth, smears and portals.
- **Settings → Logo.** Everything from the dots explorer, in the app:
  - A live preview with Auto, Prev, Next, Random, Replay, Pause and slow motion; try any
    animation and press Use This Animation to keep it.
  - What the title bar shows: Auto (dance, then a shape, then the next) or One Animation.
  - Which shape families auto mode cycles through, and whether it dances in between.
  - Speed, liquid merge, hover and click effects, and whether the logo reacts to reminders.
  - Browse All…: every animation as a live tile, with search, Dances / Shapes and families.
- **Tray icons from Science & symbols.** When nothing is happening the tray icon moves to a new
  shape (infinity, atom, DNA, yin-yang, target, recycle, globe…) every 30 seconds and holds it
  still in between. It still rings, checks and sleeps for reminders. Settings → Logo → System Tray
  picks the families, how often it changes and whether it dances when you point at it.
- Dialogs now always open in the middle of the window.

---

# Smaran 2.9.2

- **Tidier welcome screen.** Each tip now has its own icon, a short title and a line under it;
  the example phrases show as small code chips; Start When I Sign In is a proper setting row with
  its switch on the right; and the import button reads Import Older Reminders….

---

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
