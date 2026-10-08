# Smaran v2

Windows tray reminder app: styled, always-on-top popups shown in bursts on schedules.
Electron + React + TypeScript. The build plan (`Smaran Reminder v2 — Electron Build Plan.md`) is the source of truth.

## Commands

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm install`        | Install dependencies                                      |
| `npm run dev`        | Run the app with hot reload                               |
| `npm run typecheck`  | TypeScript check for main/preload and renderer            |
| `npm run lint`       | ESLint                                                    |
| `npm run format`     | Prettier                                                  |
| `npm test`           | Unit tests (Vitest)                                       |
| `npm run test:e2e`   | Build, then Playwright tests against the real app         |
| `npm run build:win`  | Build the NSIS installer and the portable exe             |
| `npm run icon`       | Regenerate the placeholder icon                           |

## Release output

Each version gets its own folder, so older builds are never overwritten:

```text
release/<version>/
├─ installer/Smaran-Setup-<version>.exe
├─ portable/Smaran-<version>-portable.exe
└─ win-unpacked/            # unpacked app for quick testing
```

The version comes from `package.json`. Bump it before a new release build.
