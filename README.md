# Smaran v2

Windows tray reminder app: styled, always-on-top popups shown in bursts on schedules.
Electron + React + TypeScript. The build plan (`Smaran Reminder v2 — Electron Build Plan.md`) is the source of truth; `RELEASE_NOTES.md` lists what 2.0 does.

## Commands

| Command                 | What it does                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `npm install`           | Install dependencies                                                |
| `npm run dev`           | Run the app with hot reload                                         |
| `npm run typecheck`     | TypeScript check for main/preload and renderer                      |
| `npm run lint`          | ESLint                                                              |
| `npm run format`        | Prettier                                                            |
| `npm test`              | Unit tests (Vitest)                                                 |
| `npm run test:coverage` | Unit tests with coverage (100% required on `src/shared` and store)  |
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

## Where data lives

- Installed: `%APPDATA%\Smaran\config.json`, with 5 rolling backups in `backups\`.
- Portable: `SmaranData\` next to the exe when that folder is writable, otherwise `%APPDATA%\Smaran`.
- Uninstalling removes the start-at-login entry and asks whether to delete the data folder.

## Code layout

```text
src/shared/    schema (zod), defaults, effectiveStyle, nextFireAt, picker, overrides, csv, ruleSummary, IPC
src/main/      SmaranApp (wiring), store/ (ConfigStore, migrations, backup), scheduler/ (SchedulerService,
               BurstRunner), windows/ (PopupManager, SettingsWindow, placement), tray/, system/, ipc/
src/preload/   settings.ts and popup.ts: the only bridge (sandboxed, contextIsolation on)
src/renderer/  settings/ (pages, components, zustand store), popup/, ui/PopupCard.tsx (shared by both)
tests/         unit/ (Vitest), e2e/ (Playwright + Electron), smoke/ (packaged build), fixtures/
```

## Signing

Builds are unsigned, so SmartScreen warns on first run. To sign, add a certificate to
`electron-builder.yml` (`win.signtoolOptions`) or use Azure Trusted Signing.
