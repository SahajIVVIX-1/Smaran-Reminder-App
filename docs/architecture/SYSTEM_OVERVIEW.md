# System Architecture & Process Model

## 1. Process Topology

Smaran utilizes a multi-process architecture based on Electron and Node.js child processes. This isolates rendering, application logic, and background server execution into fault-tolerant compartments:

```
                                  +-----------------------------+
                                  |    Electron Main Process    |
                                  |  (Node.js / Chromium Host)  |
                                  |  - Engine & Precision Timer |
                                  |  - Store & Config Sync      |
                                  |  - Window Manager           |
                                  |  - System Power / Idle Hook |
                                  +--------------+--------------+
                                                 |
         +--------------------+------------------+-------------------+--------------------+
         |                    |                  |                   |                    |
         v                    v                  v                   v                    v
+------------------+ +-----------------+ +---------------+ +------------------+ +------------------+
| Main Window      | | Notification    | | Tray Window   | | Screen Border    | | HFS Sidecar      |
| (Renderer)       | | Windows (up to  | | (Renderer)    | | Illumination     | | (Child Process)  |
| - Today          | | 4 stacked cards)| | - Quick menu  | | Window           | | Node.js HFS      |
| - Reminders      | | Standard / Auto | | - Fast stats  | | - Ambient border | | Engine (v3.4.1)  |
| - Automations    | | / FileServer    | | - Status icon | |   pulse glow     | | Zero-Trust Web   |
| - File Server    | +-----------------+ +---------------+ +------------------+ | & WebDAV (5901)  |
| - History        |                                                            +------------------+
| - Settings       |
+------------------+
```

---

## 2. Process Responsibilities

### A. Electron Main Process (`src/main/`)
The main process coordinates all operating system integrations, lifecycle events, and data persistence:
1. **Single Instance Lock:** Enforces a single instance using `app.requestSingleInstanceLock()`. Secondary instances forward their command-line arguments to the primary instance and exit immediately.
2. **Persistence Management (`store.ts`):** Reads and writes `config.json` atomically with backup recovery.
3. **Reminder Engine (`engine.ts`):** Calculates next due timestamps with drift compensation, listens to system sleep/wake/unlock events via `electron.powerMonitor`, suppresses normal alerts during quiet hours or full-screen applications, and coordinates burst follow-ups.
4. **Automation Engine (`src/main/automations/`):** Manages trigger evaluations, execution pipelines, 5-second countdown desktop notification windows with interactive cancellation, and child process execution via `node:child_process`.
5. **File Server Supervisor (`src/main/fileserver/HfsProcessSupervisor.ts`):** Unpacks and verifies the self-contained HFS 3.4.1 sidecar (`resources/engine.tar.gz`), binds network ports, monitors real-time stdout streams for security events (`[SMARAN_SECURITY_EVENT]`), handles zero-trust credentials, and manages Windows Explorer context menu integration.
6. **Window Manager (`windows.ts`):** Creates, positions, and manages all renderer windows (Main App, Multi-card Notifications, Tray popup, Setup, License dialog, and Screen Border illumination).

### B. Preload Scripts (`src/preload/`)
All renderer windows run with `contextIsolation: true` and `nodeIntegration: false`. The preload layer exposes strictly typed APIs to the global `window` object via Electron's `contextBridge`:
- `src/preload/app.ts` -> `window.smaran` (config, history, automations, file server, licensing, system controls).
- `src/preload/notification.ts` -> `window.smaranNotification` (card geometry, actions, dismissal, timer status).
- `src/preload/menu.ts` -> `window.smaranMenu` (tray menu interaction).
- `src/preload/license.ts` -> `window.smaranLicense` (license import and hardware activation).
- `src/preload/setup.ts` -> `window.smaranSetup` (installer progress and setup workflow).

### C. Renderer Processes (`src/renderer/`)
1. **Main App (`src/renderer/app/`):** The primary user interface containing navigation, page views (Today, Reminders, Automations, File Server, History, Settings), responsive modals, and settings controls.
2. **Notification Windows (`src/renderer/notification/`):** Lightweight, transparent, frameless windows designed for desktop alerts. Supports standard cards, automation countdown cards, and security alert cards.
3. **Screen Border Window (`src/renderer/screenborder/`):** Full-screen transparent overlay drawing an ambient animated light beam along the screen perimeter when alerts or tasks are running.
4. **Tray Popup (`src/renderer/menu/`):** Fast-opening context menu anchored to the Windows taskbar notification area.

### D. File Server Sidecar Process (`resources/engine/`)
The file server runs as an independent Node.js child process (`node src/index.js`):
- Runs isolated from the Electron main thread.
- Communicates via structured stdout/stderr lines and an internal loopback HTTP/JSON REST API authenticated with dynamic session tokens.
- Fully terminated synchronously (`taskkill /F /T /PID`) when Smaran exits from the tray.

---

## 3. Lifecycle & Window Management

### Window Positioning & Screen Coordinates
The main process dynamically detects display topology via `electron.screen`:
- **Primary vs. Cursor Screen:** The notification system can display notifications either on the primary Windows monitor or the monitor currently containing the user's mouse cursor (`settings.notification.screen`).
- **Corner Anchoring:** Notifications anchor to one of five preset screen positions:
  - `top-right` (default)
  - `bottom-right`
  - `top-left`
  - `bottom-left`
  - `top-center`
- **Multi-Card Stacking:** Up to 4 active notifications stack vertically. When a new card appears, existing cards smoothly slide down or up to make room.

### System Sleep, Wake & Unlock Handling
1. **Sleep Detection:** When Windows triggers `powerMonitor.on('suspend')`, active countdown timers are paused, and current due times are held.
2. **Wake & Unlock Handling:** When `powerMonitor.on('resume')` or `powerMonitor.on('unlock-screen')` fires:
   - The engine recalculates overdue time-of-day reminders and presents a consolidated "Missed while away" notification.
   - Interval reminders are aligned to resume from the wake timestamp rather than bursting all accumulated missed triggers.
   - The HFS sidecar socket state is verified and re-established if interrupted.

### Tray Exit Procedure
When "Quit Smaran" is selected from the system tray menu:
1. All active notification windows are destroyed immediately.
2. The HFS sidecar process tree is forcibly terminated synchronously (`taskkill /F /T /PID <childPid>`).
3. Exit notifications are suppressed to prevent lingering popups.
4. Tray icon and screen border overlays are removed.
5. `app.exit(0)` is invoked with zero background processes left behind.
