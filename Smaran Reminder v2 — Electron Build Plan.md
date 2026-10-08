# Smaran Reminder v2 — Electron Build Plan

Oct 8, 2026 · @SahajS.

## Purpose

Smaran v2 is a rewrite of the Python/PyQt6 reminder app as a Windows desktop app in Electron + React + TypeScript, shipped as an NSIS installer and a portable .exe. It keeps the core idea — styled, draggable, always-on-top popups shown in bursts on a schedule — and fixes the data model, scheduler and settings UX that made v1 confusing.

How to use this doc: paste it into a Claude Project as project knowledge. Each build phase (section "Build phases") is one working session; ask Claude to implement one phase at a time and check its acceptance criteria before moving on.

## Audit of v1 (Smaran.py)

The concepts are good; the confusion comes from five structural problems: messages keyed by their text, styles and schedule mixed in one flat settings blob, one global schedule, a self-re-arming burst chain, and settings written from two places at once.

### Concepts to keep

- Tray app that runs in the background and starts at login
- Message pool, cycled in order
- Per-message look: font, colours, border, radius, size or auto-size, opacity
- Popup: frameless, always on top, never steals focus, fades in, stays, fades out
- Drag a popup to move it; the position is remembered
- Burst: show the same message N times with a gap between
- Schedules: interval, one-time, daily, weekly, monthly, yearly
- Live preview, test popup, CSV import/export, pause/resume, "show now"

### Flaws and bugs found

| Area | Problem in v1 | Effect | Fix in v2 |
| --- | --- | --- | --- |
| Identity | `message_settings` is keyed by the message text | Two identical messages share one style; renaming must move keys by hand; import with duplicates silently merges | Every message gets a UUID `id` |
| Burst | `trigger_next_step` re-arms itself via `QTimer.singleShot`; "Show Now" or a schedule tick during a burst resets `remaining_bursts` | Two popup chains run at once (the "recursive" feel) | One burst runner with a queue and a cancel token |
| Position save | `lambda p: self.save_position(p, self.current_burst_text)` reads the text at drag time, not at popup creation | Dragging an old popup saves its position to the wrong message | Popup carries its own message id |
| Two writers | Dragging a popup calls `save_settings(self.settings)` while the settings dialog holds its own copy | Saving the dialog overwrites the dragged position, or vice versa | Single store in the main process; UI only sends patches |
| Schedule | Non-interval modes poll every 60 s with a `QTimer` | Timer drift or sleep can skip the target minute; nothing fires after resume | Compute the next fire time; re-arm on wake |
| Schedule | Monthly day 31, yearly Feb 29 | Never fires in short months/years | Clamp to the last day of the month |
| Schedule | "Specific Time" has no done state | Fires once, then sits armed forever | One-time schedules disable themselves after firing |
| Schedule | One global schedule for all messages | Cannot have a morning message and an hourly message | Many schedules, each picking its messages |
| CSV | Export writes `GLOBAL` rows; import reads them back as a message named "GLOBAL" | Round-trip corrupts the pool and drops global settings | JSON for full backup; CSV only for message text |
| CSV | Messages import adds text without style entries | Imported messages fall back silently | Imported messages get the default style |
| Settings file | Saved next to the .exe | Fails under Program Files (the error dialog says so) | `%APPDATA%\Smaran` via `app.getPath('userData')` |
| Merge | `load_settings` does a shallow `dict.update` | A partial old file wipes nested defaults | Schema validation (zod) + versioned migrations |
| Auto-start | `set_auto_start()` writes the Run key on every launch, no opt-out | User cannot turn it off; uninstall leaves the key | A toggle; the uninstaller removes it |
| Screens | Clamp and sliders use the primary screen only | Popups on a second monitor jump back | Store display id + position; validate on show |
| Font | Default font "Calluna Sans" is not a Windows font | Silent fallback, preview and popup can differ | Bundle a font or default to Segoe UI |
| Settings UI | Appearance tab edits whichever message is selected; position sliders and drag fight each other | Unclear what you are editing | Styles as named presets; per-message overrides shown explicitly |
| Settings UI | `exec()` makes the dialog modal and blocks the tray | Cannot pause while settings are open | Normal window; single instance |
| Startup | A burst fires immediately on every launch | Popups at every login | Option: "show on startup" off by default |

## Go vs Electron

Yes, this is fully possible in Go — the best Go route is Wails (Go backend + React/TypeScript frontend in the system WebView2). This plan uses Electron because that is the requested stack and it has the most mature tray, multi-window and installer tooling.

| Factor | Electron + React + TS | Wails (Go) + React + TS |
| --- | --- | --- |
| Installer size (approx.) | 80–100 MB | 8–15 MB |
| Idle RAM (approx.) | 100–200 MB | 30–60 MB |
| Transparent, always-on-top, non-focus popups | Mature, well documented | Possible; multi-window support is newer |
| Tray, login item, NSIS installer | Built in (electron-builder) | Built in (NSIS via wails build) |
| Language for logic | TypeScript everywhere | Go backend, TS frontend |
| Ecosystem and examples | Very large | Smaller |

Sizes are rough estimates, not measured. Because the UI is React in both, the renderer code in this plan ports to Wails later; only the main-process services (scheduler, store, windows) would be rewritten in Go.

## Product spec

v2 is organised around three nouns the user manages separately: **Messages** (what to say), **Styles** (how it looks), **Schedules** (when, how often, which messages). Everything else is app settings.

### Must have (v2.0)

1. **Messages**: add, edit (multi-line), duplicate, delete, enable/disable, reorder by drag, tags, search.
2. **Styles**: named presets (font, size, weight, italic, text/background/border colours with alpha, border width, radius, padding, opacity, size mode auto/fixed, width, height, fade in, stay, fade out). A message uses a style and may override any single field.
3. **Position**: per message — "use style default", an anchor (top-centre, corners, centre) with offset, or a remembered exact spot on a specific monitor. Dragging a popup updates it.
4. **Schedules**: many schedules, each with a rule, a burst config, a message picker and an enabled flag. Rules: every N minutes/hours (optional active hours and weekdays), once at date-time, daily at times, weekly on days at time, monthly on day N (or last day), yearly on date.
5. **Message picker per schedule**: sequential, random, random without repeat, or one fixed message; from all messages or by tag.
6. **Burst**: count, gap between popups; overlap policy when a schedule fires during a burst: queue, skip, or replace.
7. **Popup behaviour**: always on top, no focus steal, click-through optional, drag to move, right-click menu (snooze 5/15/60 min, dismiss burst, open settings), Esc-free (it never takes focus).
8. **Tray**: show now, pause for 30 min / 1 h / until resumed, next reminder time in tooltip, settings, quit.
9. **Settings window**: live preview using the real popup renderer, test popup, undo-safe autosave or explicit save (pick one; plan assumes explicit Save with dirty indicator).
10. **App settings**: start at login (toggle), show burst on startup (off by default), theme (dark/light/system), respect Windows Focus Assist / full-screen apps (skip or delay).
11. **Backup**: export/import full config as JSON (versioned); import/export messages as CSV (text, tags, enabled).
12. **Install**: NSIS installer with shortcuts and clean uninstaller; portable .exe variant.

### Later (v2.x)

- Auto-update via GitHub Releases
- Global hotkey for "show now" / "pause"
- Sound per style
- Statistics (how many shown per day)
- Quiet hours across all schedules

## Tech stack and architecture

The main process owns all state and timers; renderers are thin React views that read config and send patches through a typed preload bridge.

&#91;embedded content: Smaran v2 architecture · 3 zones, 6 main services\]

The scheduler hands jobs to the burst runner, which asks the popup manager for one popup at a time; ConfigStore is the only writer of `config.json` and broadcasts every change to open windows.

| Layer | Choice | Why |
| --- | --- | --- |
| Shell | Electron (latest stable) | Tray, transparent always-on-top windows, login items |
| Build | electron-vite + Vite | Fast dev, separate main/preload/renderer bundles |
| Language | TypeScript, `strict` | One language, shared types across processes |
| UI | React 18 + Tailwind CSS + Radix UI primitives | Accessible controls, quick dark/light theming |
| UI state | Zustand | Small store for settings window drafts |
| Forms | react-hook-form + zod resolver | Same schema validates UI and disk |
| Validation | zod | Runtime-checked config and IPC payloads |
| Dates | date-fns | DST-safe rule math |
| Colour picker | react-colorful | Alpha support, tiny |
| Fonts | font-list | Lists installed Windows fonts |
| Tests | Vitest (unit), Playwright for Electron (e2e) | Fake timers for the scheduler |
| Packaging | electron-builder (NSIS + portable) | Installer, uninstaller, shortcuts |
| Updates (later) | electron-updater + GitHub Releases | Background updates |

## Data model

One JSON file, `%APPDATA%\Smaran\config.json`, validated by zod on every load and write. Everything has a stable `id`; nothing is keyed by display text. Write atomically (temp file + rename) and keep the last 5 backups in `backups/`.

```ts
// src/shared/schema.ts  (zod schemas; these are the inferred types)
export const SCHEMA_VERSION = 1;

type Id = string; // crypto.randomUUID()

interface Config {
  version: number;            // for migrations
  app: AppSettings;
  styles: Style[];            // at least one; one has isDefault
  messages: Message[];
  schedules: Schedule[];
  runtime: RuntimeState;      // written by the scheduler, not the UI
}

interface AppSettings {
  startAtLogin: boolean;      // default true
  showOnStartup: boolean;     // default false
  theme: 'system' | 'dark' | 'light';
  respectFocusAssist: boolean;// default true
  pausedUntil: string | null; // ISO; 'forever' encoded as far future
}

interface Style {
  id: Id; name: string; isDefault: boolean;
  font: { family: string; sizePx: number; weight: 400 | 600 | 700; italic: boolean };
  colors: { text: string; background: string; border: string }; // #RRGGBBAA
  border: { widthPx: number; radiusPx: number };
  paddingPx: number;
  opacity: number;            // 0.1–1
  size: { mode: 'auto' | 'fixed'; widthPx: number; heightPx: number; maxWidthPx: number };
  timing: { fadeInMs: number; stayMs: number; fadeOutMs: number };
  position: Placement;
}

type Placement =
  | { kind: 'anchor'; anchor: 'top-center' | 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right' | 'bottom-center'; offsetX: number; offsetY: number; display: 'primary' | 'cursor' }
  | { kind: 'exact'; displayId: number; x: number; y: number }; // x,y relative to that display's workArea

interface Message {
  id: Id; text: string; enabled: boolean; tags: string[];
  styleId: Id;
  overrides: Partial<Omit<Style, 'id' | 'name' | 'isDefault'>>; // deep-partial
  createdAt: string; updatedAt: string;
}

interface Schedule {
  id: Id; name: string; enabled: boolean;
  rule: Rule;
  burst: { count: number; gapMs: number; overlap: 'queue' | 'skip' | 'replace' };
  picker: { mode: 'sequential' | 'random' | 'shuffle' | 'fixed'; messageId?: Id; tags?: string[] };
}

type Rule =
  | { kind: 'interval'; everyMs: number; activeHours?: { from: string; to: string }; weekdays?: number[] }
  | { kind: 'once'; at: string }                 // ISO local
  | { kind: 'daily'; times: string[] }           // 'HH:mm'
  | { kind: 'weekly'; weekdays: number[]; time: string } // 0 = Sunday (JS)
  | { kind: 'monthly'; day: number | 'last'; time: string }
  | { kind: 'yearly'; month: number; day: number; time: string };

interface RuntimeState {
  // per schedule: where its cursor is and when it last fired
  [scheduleId: Id]: { lastFiredAt: string | null; seqIndex: number; shuffleBag: Id[]; done?: boolean };
}
```

Rules that remove v1's confusion:

- **Effective style** of a message = `deepMerge(style(message.styleId), message.overrides)`. One pure function, used by preview, test popup and real popup.
- **Position drag** writes `overrides.position = {kind:'exact', …}` on that message only, via the store.
- **Weekday numbering** follows JS `Date.getDay()` (0 = Sunday) everywhere; the UI shows names.
- **Migration**: `migrations/v0_to_v1.ts` reads a v1 `smaran_settings.json` (offered on first run if found next to an old exe or in a chosen file) and maps text-keyed settings to messages + one style per distinct look.

## Scheduler and burst engine

The scheduler never polls: it computes each schedule's next fire time, sets one `setTimeout` to the earliest, and recomputes after every fire, config change, resume from sleep, time-zone or clock change. All of it runs in the main process.

### `nextFireAt(rule, after: Date): Date | null` — pure function, unit-tested

- `interval`: `lastFiredAt + everyMs` (or now + everyMs on first run); if outside `activeHours`/`weekdays`, roll forward to the next allowed window start.
- `once`: `at` if in the future and not `done`, else `null`.
- `daily`: the earliest of `times` after `after`, else the first time tomorrow.
- `weekly`: the next listed weekday at `time`.
- `monthly`: day N clamped to the month length; `'last'` = last day.
- `yearly`: month/day clamped (29 Feb → 28 Feb in non-leap years).

Use date-fns for arithmetic; never add raw milliseconds across days (DST safety).

### SchedulerService

```ts
class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  arm(): void;                       // compute min nextFireAt over enabled schedules, setTimeout to it (cap 24 h, then re-arm)
  private onDue(): void;            // fire every schedule whose nextFireAt <= now + 1 s, then arm()
  // hooks: store.onChange -> arm(); powerMonitor 'resume' / 'unlock-screen' -> catchUp() then arm()
  catchUp(): void;                  // a schedule missed during sleep fires ONCE (not once per missed slot); once-rules fire if missed < 1 h
  nextSummary(): { scheduleId: Id; at: Date } | null; // for tray tooltip
}
```

### BurstRunner — replaces v1's self-re-arming chain

One queue, one active burst, explicit cancellation. A popup's end never calls back into scheduling code directly; it resolves a promise the runner awaits.

```ts
interface BurstJob { scheduleId: Id | 'manual'; messageId: Id; count: number; gapMs: number }

class BurstRunner {
  private queue: BurstJob[] = [];
  private active: { job: BurstJob; abort: AbortController } | null = null;
  enqueue(job: BurstJob, overlap: 'queue' | 'skip' | 'replace'): void;
  cancelActive(): void;              // tray "dismiss", pause, snooze
  private async run(job: BurstJob, signal: AbortSignal) {
    for (let i = 0; i < job.count && !signal.aborted; i++) {
      if (shouldSuppress()) break;   // paused, Focus Assist, full-screen app
      await popupManager.show(job.messageId, signal); // resolves after fade-out or close
      if (i < job.count - 1) await sleep(job.gapMs, signal);
    }
    this.active = null; this.next();
  }
}
```

- Pause = set `pausedUntil`, `cancelActive()`, scheduler keeps computing but `onDue` skips while paused.
- Snooze from a popup = cancel the active burst and enqueue the same job at now + N minutes (one-shot timer owned by the runner).
- Message picking (sequential cursor, shuffle bag) happens when a schedule fires and is persisted in `runtime` so restarts continue where they left off.
- `shouldSuppress()` (Windows): skip when Focus Assist is on or a full-screen app is in the foreground, if `respectFocusAssist`. Detect via a small native helper or the `windows-focus-assist` npm package; if unavailable, fall back to checking `screen` + foreground window bounds.

## Popup window

Each popup is its own `BrowserWindow` loading the `popup` renderer entry; PopupManager creates it, places it, and resolves a promise when it closes.

```ts
new BrowserWindow({
  width, height, x, y,
  frame: false, transparent: true, resizable: false, movable: true,
  alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false,
  hasShadow: false, backgroundColor: '#00000000',
  webPreferences: { preload: popupPreload, contextIsolation: true, sandbox: true },
});
win.setAlwaysOnTop(true, 'screen-saver');
win.setVisibleOnAllWorkspaces(true);
win.showInactive();                 // never steals focus (v1's WA_ShowWithoutActivating)
```

- **Sizing**: for `auto` mode the renderer measures its text after fonts load and sends `popup:measured {w,h}`; main calls `setContentSize` before `showInactive()`. Keeps preview and popup identical (same React component).
- **Placement**: `resolvePlacement(placement, size)` uses `screen.getAllDisplays()`; an `exact` position on a display that no longer exists falls back to the style's anchor on the primary display. Always clamp inside the display `workArea`.
- **Animation**: CSS opacity transition in the renderer (fade in → stay → fade out), not window opacity tweens; renderer sends `popup:done` at the end.
- **Drag**: `-webkit-app-region: drag` on the card. On `moved` (debounced 300 ms) main stores `{kind:'exact', displayId, x, y}` for that popup's message id.
- **Right-click menu** (native `Menu.popup`): Snooze 5 / 15 / 60 min, Dismiss this burst, Edit this message (opens settings at it), Open settings.
- **Hover**: pauses the stay timer so a message can be read; resumes on leave.
- **Stacking**: if a popup is already on screen at the same spot, the new one waits (runner is serial, so only manual tests can overlap).

## Settings UI

One resizable window (min 960×640) with a left sidebar of five pages; each page edits one noun, so it is always clear what a control changes.

| Page | Left | Right | Key actions |
| --- | --- | --- | --- |
| Messages | Searchable list with enable toggle, tag chips, drag to reorder | Editor: multi-line text, style picker, "Overrides" panel listing only changed fields with a reset per field, position mode | Add, duplicate, delete (with undo toast), Test |
| Styles | List of presets, default marked | Full style form + live preview on a checker/desktop-like background | New from current, duplicate, set default, delete (blocked if in use, offers reassign) |
| Schedules | List with name, rule summary ("Weekdays 09:00"), next fire time, toggle | Rule builder by kind, burst (count, gap, overlap), message picker (mode, tags or one message) | Run now, duplicate, delete |
| App | — | Start at login, show on startup, theme, Focus Assist, pause status | Open data folder, reset to defaults |
| Backup | — | Export/import JSON, import/export messages CSV, import v1 settings | — |

- Live preview renders the shared `<PopupCard style text />` component — the same one the popup window uses — scaled to fit.
- Explicit **Save** with a dirty dot; closing with unsaved changes asks. Saves send a typed patch to main; main validates, writes, and broadcasts the new config to all windows.
- Colour pickers support alpha (`react-colorful` + hex input). Font picker lists installed fonts via `font-list` (main process).
- Forms with react-hook-form + the same zod schemas, so the UI cannot produce an invalid config.
- Keyboard: Ctrl+S save, Ctrl+N new item on the current page, Delete removes selected.

## Folder structure and IPC

Scaffold with `electron-vite` (React + TS template). Three code zones: `main` (Node, owns state and windows), `preload` (the only bridge), `renderer` (React, no Node access). `shared` holds types, schemas and pure logic used by both.

```text
smaran/
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ package.json
├─ build/                     # icon.ico, installer.nsh, license.txt
├─ resources/                 # tray icons (light/dark), bundled font
├─ src/
│  ├─ shared/
│  │  ├─ schema.ts            # zod schemas + types (Config, Style, Message, Schedule, Rule)
│  │  ├─ defaults.ts          # default config, default style
│  │  ├─ effectiveStyle.ts    # deepMerge(style, overrides)
│  │  ├─ nextFireAt.ts        # pure rule math
│  │  ├─ picker.ts            # sequential / random / shuffle
│  │  └─ ipc.ts               # channel names + payload types
│  ├─ main/
│  │  ├─ index.ts             # single-instance lock, app lifecycle
│  │  ├─ store/ConfigStore.ts # load, validate, migrate, atomic save, backups, onChange
│  │  ├─ store/migrations/    # v0_to_v1.ts (Python import), ...
│  │  ├─ scheduler/SchedulerService.ts
│  │  ├─ scheduler/BurstRunner.ts
│  │  ├─ windows/PopupManager.ts
│  │  ├─ windows/SettingsWindow.ts
│  │  ├─ windows/placement.ts
│  │  ├─ tray/Tray.ts
│  │  ├─ system/loginItem.ts  # app.setLoginItemSettings
│  │  ├─ system/focusAssist.ts
│  │  └─ ipc/handlers.ts      # ipcMain.handle registrations, all input zod-validated
│  ├─ preload/
│  │  ├─ settings.ts          # contextBridge.exposeInMainWorld('smaran', api)
│  │  └─ popup.ts
│  └─ renderer/
│     ├─ settings/            # index.html, main.tsx, pages/, components/, store (zustand)
│     ├─ popup/               # index.html, main.tsx
│     └─ ui/PopupCard.tsx     # shared by preview and popup
└─ tests/
   ├─ unit/                   # vitest: nextFireAt, picker, effectiveStyle, migrations, BurstRunner (fake timers)
   └─ e2e/                    # playwright-electron: settings flows, popup shows
```

### IPC contract (`src/shared/ipc.ts`)

| Channel | Direction | Payload → result | Purpose |
| --- | --- | --- | --- |
| `config:get` | renderer → main (invoke) | – → `Config` | Load on window open |
| `config:save` | invoke | `Config` → `{ok} \| {error}` | Validated save |
| `config:changed` | main → renderer (send) | `Config` | Broadcast after any write (incl. popup drag) |
| `popup:test` | invoke | `{messageId} \| {text, style}` → void | Test button |
| `schedule:runNow` | invoke | `{scheduleId}` → void | Run a schedule now |
| `schedule:next` | invoke | – → `{scheduleId, at}[]` | Next fire times for the list |
| `app:pause` / `app:resume` | invoke | `{until?}` → void | Pause control |
| `fonts:list` | invoke | – → `string[]` | Font picker |
| `backup:export` / `backup:import` | invoke | `{format:'json' \| 'csv'}` → `{ok, path?}` | Uses `dialog` in main |
| `popup:init` | main → popup | `{text, style, popupId}` | Popup content |
| `popup:measured` / `popup:done` | popup → main | `{popupId, w, h}` / `{popupId}` | Sizing, lifecycle |

Only the preload exposes these as typed functions (`window.smaran.config.get()`); the renderer never sees `ipcRenderer`.

## Packaging: installer, uninstaller, portable exe

electron-builder produces two Windows x64 artifacts from one config: `Smaran-Setup-<version>.exe` (NSIS installer) and `Smaran-<version>-portable.exe`.

```yaml
# electron-builder.yml
appId: com.sahaj.smaran
productName: Smaran
directories: { output: dist, buildResources: build }
files: [out/**, package.json]
extraResources: [{ from: resources, to: resources }]
win:
  icon: build/icon.ico
  target: [nsis, portable]
nsis:
  oneClick: false                     # full wizard
  perMachine: false                   # per-user install, no admin needed
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Smaran
  runAfterFinish: true
  license: build/license.txt
  deleteAppDataOnUninstall: false     # asked in installer.nsh instead
  include: build/installer.nsh
portable:
  artifactName: ${productName}-${version}-portable.${ext}
```

### Install flow

1. Welcome → licence → install folder (default `%LOCALAPPDATA%\Programs\Smaran`) → install → "Launch Smaran" checked.
2. First launch: onboarding dialog — import v1 settings? start at login? — then writes `config.json`.
3. Single-instance lock: running the installer while the app runs asks to close it (NSIS `installer.nsh` checks the process).

### Uninstall flow (`installer.nsh` custom macros)

- `customUnInit`: close the running app.
- `customUnInstall`: remove the `HKCU\…\Run\Smaran` value (in case login item was set), then ask "Also delete your messages and settings?" — Yes deletes `%APPDATA%\Smaran`.
- Shortcuts and the Add/Remove Programs entry are removed by electron-builder automatically.

### Portable variant

The portable exe stores data in `<exe folder>\SmaranData` when that folder is writable (check at startup with a test write), else `%APPDATA%\Smaran`. Start-at-login for portable points at the exe's current path and is re-validated each launch.

### Signing and updates

Unsigned builds trigger SmartScreen warnings. For public release, sign with a code-signing certificate (`win.signtoolOptions`) or Azure Trusted Signing. Auto-update (later): `electron-updater` with GitHub Releases as `publish` provider; installer variant only.

## Build phases

Eight phases, each ending in something runnable; do them in order. Each phase's checklist is its acceptance gate.

### Phase 0 — Scaffold

electron-vite React+TS template, two renderer entries (settings, popup), ESLint/Prettier, Vitest, Playwright, electron-builder config, app icon.

- [ ] `npm run dev` opens an empty settings window with hot reload
- [ ] `npm run build:win` produces the installer and portable exe
- [ ] Single-instance lock: a second launch focuses the first

### Phase 1 — Shared core (no UI)

`schema.ts`, `defaults.ts`, `effectiveStyle.ts`, `nextFireAt.ts`, `picker.ts` with tests.

- [ ] `nextFireAt` tests cover every rule kind, month-end clamp, 29 Feb, DST change days, active hours
- [ ] Shuffle picker never repeats until the bag empties; sequential survives a message being deleted
- [ ] 100% branch coverage on these files

### Phase 2 — ConfigStore + migrations

- [ ] Loads, validates, fills defaults; invalid file is backed up and replaced with defaults, user is told
- [ ] Atomic save + 5 rolling backups
- [ ] v1 `smaran_settings.json` imports into messages + styles (test with the default v1 file)

### Phase 3 — Popup + PopupManager

- [ ] `popup:test` shows a styled popup that never takes focus (typing in another app continues)
- [ ] Auto-size matches the preview component; fixed size respected
- [ ] Drag saves an exact position per message; reopens there, also on a second monitor
- [ ] Right-click menu works; hover pauses the stay timer

### Phase 4 — Scheduler + BurstRunner + tray

- [ ] Two schedules with different messages fire independently
- [ ] "Show now" during a burst follows the overlap policy; never two chains
- [ ] Pause/resume/snooze; tray tooltip shows next reminder
- [ ] Sleep the PC past a fire time → one catch-up burst after wake
- [ ] Focus Assist / full-screen suppression

### Phase 5 — Settings UI

- [ ] Messages, Styles, Schedules, App pages per the Settings UI section
- [ ] Overrides panel shows only changed fields with per-field reset
- [ ] Save/dirty state; config changes from popup drags appear live

### Phase 6 — Backup, onboarding, login item

- [ ] JSON export → import round-trips byte-for-byte equal config (ids kept)
- [ ] CSV messages import/export with tags and enabled
- [ ] First-run onboarding; start-at-login toggle sets/removes the login item

### Phase 7 — Installer polish and release

- [ ] Install, run, uninstall on a clean Windows 10 and 11 VM: no files or Run key left (unless user kept data)
- [ ] Portable exe runs from a USB folder and stores data beside itself
- [ ] Version, licence, About dialog; release notes; optional signing

## Rules for Claude on this project

Paste this section as the Project's custom instructions.

1. This document is the source of truth. If a request conflicts with it, say so and propose an update to the doc before coding.
2. Work one phase at a time. Finish with: files changed, how to run, and the phase's acceptance checklist ticked or explained.
3. TypeScript `strict: true`, no `any`, no `@ts-ignore`. ESLint + Prettier clean.
4. Security: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` on every window; renderer talks to main only through the typed preload API; every IPC input is zod-validated in main.
5. State lives only in main's `ConfigStore`. Renderers hold copies and send patches; never write the config file from anywhere else.
6. Never key anything by message text or by array index — use `id`.
7. No polling timers for schedules. Use `nextFireAt` + one timeout; re-arm on change and on `powerMonitor` resume.
8. No recursive callbacks between popups and scheduling — the BurstRunner awaits popup promises.
9. Pure logic (`shared/`) gets Vitest tests before it is wired in; time-based code uses fake timers.
10. Every user-visible string is plain English; error dialogs say what to do next.
11. Do not add dependencies beyond the stack list without asking.
12. Windows is the only target for v2.0; keep code paths OS-neutral where it costs nothing.
