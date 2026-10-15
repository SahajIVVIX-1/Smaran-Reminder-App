# Smaran

Gentle reminders for Windows: type what to remember and when, and Smaran shows it as a calm
notification card at the right time. Lives in the tray.
Electron + React + TypeScript. `docs/DESIGN.md` explains how reminders behave and why; `RELEASE_NOTES.md` lists what changed.
The original build plan (`Smaran Reminder v2 — Electron Build Plan.md`) describes 2.0 and is kept for history.

## Commands

| Command                 | What it does                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `npm install`           | Install dependencies                                                |
| `npm run dev`           | Run the app with hot reload                                         |
| `npm run typecheck`     | TypeScript check for main/preload and renderer                      |
| `npm run lint`          | ESLint                                                              |
| `npm run format`        | Prettier                                                            |
| `npm test`              | Unit tests (Vitest)                                                 |
| `npm run test:coverage` | Unit tests with coverage                                            |
| `npm run test:e2e`      | Build, then Playwright tests against the real app                   |
| `npm run build:win`     | Build the NSIS installer and the portable exe                       |
| `npm run test:smoke`    | After `build:win`: smoke-test the packaged app                      |
| `npm run icon`          | Regenerate the placeholder icon                                     |

Tests always use a temporary data folder; they never touch your real `%APPDATA%\Smaran`.

## Release output

Each version gets its own folder, so older builds are never overwritten:

```text
release/<version>/
├─ installer/Smaran-Setup-<version>.exe
├─ portable/Smaran-<version>-portable.exe
└─ win-unpacked/            # unpacked app for quick testing
```

The version comes from `package.json`. Bump it before a new release build.

The installer and the portable exe are the same file: `scripts/make-setup.mjs` copies the portable
exe to the Setup name, and when Smaran starts under a name containing "Setup" it shows its own
installer window (`src/main/setup`) and installs itself to `%LOCALAPPDATA%\Programs\smaran`
(or over an earlier install). Settings › Apps runs `Smaran.exe --uninstall`.

## Where data lives

- Installed: `%APPDATA%\Smaran\config.json` (reminders and settings; 5 rolling backups in `backups\`)
  and `history.json` (the last 1,000 events).
- Portable: `SmaranData\` next to the exe when that folder is writable, otherwise `%APPDATA%\Smaran`.
- Uninstalling removes the start-at-login entry and asks whether to delete the data folder.

## Code layout

```text
src/shared/    schema (zod), defaults, nextFireAt, time windows, quickParse, ruleSummary, IPC types
src/shared/legacy/  the 2.0 schema, kept only to upgrade old files
src/main/      SmaranApp (wiring), engine/Engine (what to show and when), store/ (ConfigStore,
               HistoryStore, migrations, backup), windows/ (AppWindow, NotificationCenter, placement),
               tray/, system/, ipc/
src/preload/   app.ts and notification.ts: the only bridge (sandboxed, contextIsolation on)
src/renderer/  app/ (Today, Reminders, History, Settings), notification/ (the card), theme.css
tests/         unit/ (Vitest), e2e/ (Playwright + Electron), smoke/ (packaged build), fixtures/
```

## Signing

Builds are unsigned, so SmartScreen warns on first run. To sign, add a certificate to
`electron-builder.yml` (`win.signtoolOptions`) or use Azure Trusted Signing.
