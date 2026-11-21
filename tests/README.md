# Smaran Automated E2E Testing Infrastructure

A permanent, reusable, and deterministic end-to-end automated testing system built with [Playwright](https://playwright.dev/) and Electron for the Smaran desktop application.

---

## 1. Directory Structure

```
tests/
├── e2e/                             # End-to-end test specifications
│   ├── app-launch.spec.ts           # Startup, window geometry, welcome flow, mutex
│   ├── navigation.spec.ts           # Sidebar routing across all main views
│   ├── dashboard.spec.ts            # Today view, greetings, natural language quick-add
│   ├── settings.spec.ts             # Themes, font picker, corner positioning, quiet hours
│   ├── reminders.spec.ts            # Reminder creation, editing, deletion & undo
│   ├── automation.spec.ts           # Automations editor, triggers & actions
│   ├── notifications.spec.ts        # Floating cards, hover expansion, stacking, Done/Snooze
│   ├── history.spec.ts              # Event audit logging & restart persistence
│   ├── fileserver.spec.ts           # File server lifecycle, health check endpoint
│   ├── authentication.spec.ts       # Administrator credentials & security validations
│   ├── file-sharing.spec.ts         # LAN/local URLs, QR code modals & WebDAV sharing
│   └── shutdown.spec.ts             # Tray minimize & graceful process termination
├── fixtures/                        # Mock data and test assets
│   ├── test-data.ts                 # Factories for configs, reminders, automations
│   └── test-files/                  # Real files (sample.txt, sample.json) for sharing
├── helpers/                         # Test utilities and drivers
│   ├── app-launcher.ts              # Electron launch harness with temporary sandboxes
│   ├── navigation.ts                # Route switching & navigation helpers
│   ├── assertions.ts                # Layout, overflow & viewport boundary checks
│   └── cleanup.ts                   # Robust Windows directory & process cleanup
├── config/                          # Framework configuration
│   └── e2e.config.ts                # Playwright E2E configuration & reporting rules
└── README.md                        # Testing documentation and command guide
```

---

## 2. Test Execution Commands

All commands are permanently integrated into `package.json` and run from the repository root:

| Command | Purpose |
| :--- | :--- |
| `npm run test:e2e` | Builds the app and runs the complete E2E test suite |
| `npm run test:e2e:smoke` | Fast smoke test covering application launch and navigation |
| `npm run test:e2e:ui` | Visual and UI functional tests covering settings and reminders |
| `npm run test:e2e:fileserver` | Dedicated test suite for File Server, auth, and file sharing |
| `npm run test:e2e:report` | Opens the interactive HTML test report in the browser |
| `npm run test:all` | Runs unit tests (Vitest), HFS smoke tests, and Playwright E2E tests |

---

## 3. Test Isolation & Safety

The testing infrastructure adheres to strict safety and isolation standards:
1. **Isolated Temp Profiles:** Each test creates a clean, ephemeral directory in `%TEMP%\smaran-e2e-*`. The user's production data in `%APPDATA%\Smaran` is **never** touched or modified.
2. **Environment Sanitization:** When launched from environments that set `ELECTRON_RUN_AS_NODE`, the launcher strips this variable so Electron runs as a full Chromium GUI application.
3. **Safe Cleanup:** All temporary directories and child processes are automatically closed and purged upon test completion.
4. **License Bypass in Tests:** Development test runs pass `SMARAN_LICENSE_CHECK=off` in their isolated process environment without modifying any production licensing logic.

---

## 4. Reports & Debugging Artifacts

Test outputs are organized in `test-results/`:
- **HTML Report:** `test-results/html/index.html` (view with `npm run test:e2e:report`)
- **JSON Summary:** `test-results/results.json`
- **Screenshots & Traces:** Captured automatically in `test-results/artifacts/` on test failures.

*Note: Generated artifacts in `test-results/` and `playwright-report/` are gitignored to keep version control clean, while all test code and configurations remain permanent.*
