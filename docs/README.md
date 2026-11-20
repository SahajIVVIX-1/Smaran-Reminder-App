# Smaran – Comprehensive Technical Documentation & Architecture Reference

> **Version:** 3.4.3  
> **Target Audience:** Artificial Intelligence agents, system architects, and core developers.  
> **Repository:** `d:\03_Projects\Smaran-Reminder-App`  
> **Release Target:** Windows 10/11 (x64) – Desktop Electron Application

---

## 1. Executive Summary

**Smaran** is an advanced, production-grade personal productivity and system operations desktop suite built on Electron, Vite, TypeScript, and React. Initially designed as an always-on-top, ambient schedule reminder system with mathematical vector animations, Smaran 3.x has evolved into an integrated desktop powerhouse featuring:

1. **Intelligent Reminders:** Precision scheduling (interval, daily, weekly, monthly, yearly, one-time) with quiet-hours deferral, full-screen/DND busy hold, rotating messages, custom sounds, and follow-up bursts.
2. **Smart Automations Subsystem:** Configurable multi-step workflows triggered by system events (boot, sign-in, unlock, battery status, idle time) or schedules, featuring a native Windows 5-second countdown desktop notification card with immediate `[Run Now]` or `[Cancel]` controls.
3. **Smaran HFS (Self-Hosted HTTP File Server & WebDAV):** A bundled, zero-trust local HTTP file server and WebDAV sidecar (based on HFS 3.4.1 engine) with live connection monitoring, 1-click Windows Drive `Z:` network mounting, standalone `.bat` export, and Windows Explorer right-click shell integration (`Add to Smaran HFS`).
4. **Desktop Security & Activity Monitoring:** An integrated security event pipeline (`smaran-security` plugin v3.4) capturing logins, failed brute-force attempts, and administrative actions with IP geolocation classification (LAN vs External) and desktop security notifications.
5. **Obsidian Design System & Mathematical Vector Dots:** A sleek dark UI with warm terracotta accents (`#e06c43`), responsive layout scaling, custom card geometry, and an ambient mathematical vector dots animation engine running at 60 FPS across title bars and system tray icons.
6. **Air-Gapped Ed25519 Cryptographic Licensing:** Asymmetric hardware-fingerprinted licensing system supporting machine-bound offline activations.

---

## 2. Documentation Map & Navigation

This documentation suite is organized modularly to enable any AI model or engineer to inspect any subsystem down to the exact setting, data structure, IPC signature, or failure handling procedure:

### A. Architecture & Core Systems
- [System Architecture & Process Model](file:///d:/03_Projects/Smaran-Reminder-App/docs/architecture/SYSTEM_OVERVIEW.md) – Multi-process Electron runtime, main process duties, sidecar lifecycle, crash recovery, and security boundaries.
- [IPC Protocol & Channel Reference](file:///d:/03_Projects/Smaran-Reminder-App/docs/architecture/IPC_REFERENCE.md) – Exhaustive catalog of all 95 IPC communication channels, signatures, payloads, and response schemas.
- [Store, Persistence & Migration Engine](file:///d:/03_Projects/Smaran-Reminder-App/docs/architecture/STORE_AND_PERSISTENCE.md) – JSON persistence (`config.json`), atomic disk flushing, multi-version migrations (v1 through v6), and backup archives.

### B. Settings Subsystem (Every Single Option & Flag)
- [System Settings Specification](file:///d:/03_Projects/Smaran-Reminder-App/docs/settings/SYSTEM_SETTINGS.md) – Windows startup, system tray behavior, themes, notification screen placement, Attention Motion styles, screen border lighting, and diagnostics.
- [Reminder Settings & Scheduling Rules](file:///d:/03_Projects/Smaran-Reminder-App/docs/settings/REMINDER_SETTINGS.md) – Durations, snooze intervals, priorities (`normal` vs `important`), sound themes, missed reminder handling, quiet hours, and full-screen suppression.
- [Automation Settings & Safety Policies](file:///d:/03_Projects/Smaran-Reminder-App/docs/settings/AUTOMATION_SETTINGS.md) – Global automation master switches, pre-execution countdown parameters, failure notifications, and disruptive power safety cards.
- [File Server Settings & Network Suite](file:///d:/03_Projects/Smaran-Reminder-App/docs/settings/FILE_SERVER_SETTINGS.md) – Ports, auto-start controls, LAN/external bindings, authentication, WebDAV network mount, security alert thresholds, and Explorer context menu.

### C. Feature Engines & Implementation Details
- [Reminder Data Model & Scheduling Engine](file:///d:/03_Projects/Smaran-Reminder-App/docs/reminders/DATA_MODEL_AND_SCHEDULING.md) – `Reminder` schema, rotating affirmations, repeat rules, DST/month-end calculations (`nextFireAt.ts`), and Natural Language Quick Add syntax (`quickParse.ts`).
- [Automation Engine, Triggers & Actions](file:///d:/03_Projects/Smaran-Reminder-App/docs/automations/ENGINE_AND_ACTIONS.md) – Event and schedule triggers, action types (`power`, `open`, `link`), multi-step pipelines, and 5-second countdown notification cards.
- [HFS Sidecar Engine, Security Plugins & WebDAV](file:///d:/03_Projects/Smaran-Reminder-App/docs/fileserver/HFS_SIDECAR_AND_SECURITY.md) – Node sidecar extraction, zero-trust config generation, `smaran-security` v3.4 bridge, client web UI customization, and Windows registry context menu.
- [Desktop Notification Architecture](file:///d:/03_Projects/Smaran-Reminder-App/docs/notifications/NOTIFICATION_ARCHITECTURE.md) – Multi-window coordinate positioning, stacking cards, auto-hide progress bar, OS screen cursor hover detection, and expanded cards.
- [UI Design System, Components & Themes](file:///d:/03_Projects/Smaran-Reminder-App/docs/ui/DESIGN_SYSTEM_AND_COMPONENTS.md) – Color tokens, typography, component library, and responsive breakpoint rules.
- [Vector Dots Animation Runtime](file:///d:/03_Projects/Smaran-Reminder-App/docs/ui/VECTOR_DOTS_ENGINE.md) – Vector canvas engine, 60fps frame loop, mathematical choreographies (dance, nature, mechanics), liquid merging, and system tray animations.
- [Ed25519 Cryptographic Licensing System](file:///d:/03_Projects/Smaran-Reminder-App/docs/licensing/ED25519_LICENSING_SYSTEM.md) – Asymmetric signature verification, hardware fingerprinting (CPU/Motherboard/Disk), offline activation, and key generation tools.
- [Build, Packaging & Code-Signing Pipeline](file:///d:/03_Projects/Smaran-Reminder-App/docs/build/BUILD_AND_PACKAGING_GUIDE.md) – `electron-vite`, `electron-builder`, NSIS installer generation, portable standalone binaries, Windows code-signing, and GitHub release automation.

---

## 3. Technology Stack & Key Dependencies

| Layer | Technologies |
|---|---|
| **Runtime Environment** | Electron 44.7.0 (Chromium 134, Node 22, V8), Windows 10/11 x64 |
| **Frontend Core** | React 18.3.1, TypeScript 5.8, Vite 7.3.7, Tailwind CSS / Vanilla CSS Variables |
| **Animation Engines** | Motion (`motion/react` v14.14), Custom Vector Dots 60 FPS HTML5 Canvas engine |
| **Form & Validation** | Zod v4 (Schema definition and type-safe validation), Date-fns v4.4 |
| **File Server Sidecar** | HFS 3.4.1 (Node.js HTTP File Server), YAML v2.7, Node Tar, Archiver |
| **Security & Crypto** | Node `node:crypto` (Ed25519 keypairs, SHA-256, SHA-512, hardware hashes) |
| **Packaging & Installer**| Electron-Builder 26.15, NSIS (Nullsoft Scriptable Install System), Windows `signtool.exe` |

---

## 4. Key Directory Structure

```
Smaran-Reminder-App/
├── build/                      # Build icons (icon.ico, icon.png, tray assets)
├── docs/                       # Complete AI-readable architectural documentation
├── resources/                  # Bundled assets (engine.tar.gz HFS sidecar, elevate.exe)
├── scripts/                    # Build, license core, setup packaging, release scripts
├── site/                       # Static landing page site (site.js, dots.js, index.html)
├── src/
│   ├── main/                   # Electron Main Process
│   │   ├── automations/        # Automation scheduler, executor, process launcher
│   │   ├── fileserver/         # HFS process supervisor, config bridge, API client, audit store
│   │   ├── license/            # Ed25519 licensing, fingerprinting, verification core
│   │   ├── system/             # Windows autostart, tray, audio synthesizer, power monitor
│   │   ├── engine.ts           # Reminder precision scheduling engine
│   │   ├── store.ts            # Persistent configuration store and migrations
│   │   ├── screenBorder.ts     # Screen border illumination window controller
│   │   ├── windows.ts          # Window creation, bounds management, blur/focus handling
│   │   └── ipc.ts              # IPC handlers registered with Electron ipcMain
│   ├── preload/                # Sandboxed context bridge scripts (app, notif, menu, license, setup)
│   ├── renderer/               # React UI for App, Notifications, Tray menu, License, Setup
│   │   ├── app/                # Main application UI (Today, Reminders, Automations, FileServer, History, Settings)
│   │   ├── notification/       # Desktop notification cards (Standard, Automation, FileServer)
│   │   ├── dots/               # Vector Dots UI components
│   │   └── menu/               # System tray popup menu UI
│   └── shared/                 # Isomorphic TypeScript schemas, interfaces, math, IPC channels
└── tests/                      # Unit and integration test suite (Vitest)
```
