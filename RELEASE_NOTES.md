# Smaran 3.4.4

- **Persistent File Server Security & Audit Storage (`fileserver-audit.json`):**
  - Migrated security events from a transient in-memory array to a persistent, atomic audit store (`FileServerAuditStore`).
  - Preserves event IDs, timestamps, usernames, client IPs, access types, event types, and details across application restarts.
  - Retains up to 5,000 permanent records with deduplication across event ID and composite fingerprints.
  - Admin dashboard directly retrieves persistent events with support for filtering by event type, username, IP, date range, and count limit. Completely separated from the deletable notification inbox.
- **Shared Windows-Safe Atomic Storage Engine (`atomicFile.ts`):**
  - Reusable persistence utility implementing unique temporary staging files with `fs.fsyncSync()` to ensure data is physically committed to disk before replacement.
  - Windows-safe atomic file replacement with exponential backoff retries on `EPERM`, `EBUSY`, and `EACCES` file locks, plus copy/unlink fallback.
  - Automatic `.bak` creation and corruption recovery: damaged files are safely preserved as `<file>.corrupt.<timestamp>` for forensics while state is restored from `.bak`.
  - Automatic cleanup of abandoned temporary files older than 5 minutes on initialization.
- **Resilient NotificationStore & HistoryStore Persistence:**
  - Upgraded `NotificationStore` to atomic persistence with `.bak` recovery, corruption preservation, and safe temp cleanup while maintaining the 500-notification limit.
  - Isolated listener error handling: throwing listeners cannot crash broadcasts or prevent subsequent listeners from executing.
  - Strengthened `HistoryStore`: delayed write flushing with bounded exponential backoff retries on write failures, ensuring writes are never silently lost during app quit.
- **Persistent Failed-Login Escalation & Engine Brute-Force Enforcement:**
  - `HfsProcessSupervisor` persists failed-login attempts per normalized client IP in `failed-logins.json` across app restarts.
  - Enforces a 15-minute rolling window, normalizes IPv4 and IPv6 addresses (including IPv4-mapped IPv6 `::ffff:`), and automatically resets counters upon successful login.
  - Configures server-level protection via HFS `antibrute` plugin with increasing delays and IP blocking.
- **Automated Packaged HFS Engine Smoke Testing (`test:hfs:smoke`):**
  - Added end-to-end automated smoke testing (`scripts/test-hfs-smoke.mjs`) executing the actual packaged engine from `resources/engine.tar.gz`.
  - Verifies entry points, plugins (`smaran-security`, `server-info`, `antibrute`), health endpoint probe, public file access, unauthorized access rejection (401/403), valid authentication, and clean process teardown.
  - Integrated directly into release directory preparation (`scripts/prepare-release-dirs.mjs`) to halt release builds immediately if smoke testing fails.

---

# Smaran 3.4.3

- **Smaran Security Monitor (`smaran-security` plugin):**
  - Resolved plugin initialization failure by specifying `apiRequired: 1` as mandated by HFS engine plugin specifications.
  - Bumped plugin version number to `3.4` and added complete descriptive metadata matching standard HFS plugins.
  - Automatic synchronization ensuring existing runtime installations in user data folders are proactively updated.
- **Mobile & Tablet Client Web UI:**
  - Hidden top-right WebDAV/Windows drive mount button (`.smaran-webdav-widget`) on mobile and tablet screens (`@media (max-width: 1024px)`).
- **User Panel UI & Typography Redesign:**
  - Redesigned the User Panel modal with high-contrast, polished dark aesthetics harmonized with Smaran's obsidian theme.
  - Replaced harsh solid terracotta cards with sleek, elevated dark cards (`#1c1c24` / `#22222d`) and subtle borders (`rgba(255, 255, 255, 0.09)`).
  - Fixed font legibility and contrast: replaced cyan-on-orange and green/red-on-orange text with crisp white values (`#f5f4ef`), clean muted labels (`#9ca3af`), and modern emerald/salmon status badges (`.status-on`, `.status-off`).
  - Polished action buttons: "Admin Panel" with a refined primary brand gradient and subtle glow, "Change password" with a clean dark neutral finish, and "Logout" with an elegant danger-accented pill.
  - Removed awkward asymmetric corner tab blob from dialog headers and styled the modal close button with modern rounded hover effects.

---

# Smaran 3.4.2

- **Windows Shell Context Menu Integration ("Add to Smaran HFS"):**
  - Updated the Windows Explorer right-click context menu label from `Add to HFS (new)` to `Add to Smaran HFS`.
  - Replaced the default HFS icon with Smaran's high-resolution multi-size brandmark (`build/icon.ico`, 16x16 to 256x256).
  - Automatically detects and migrates existing `HKCU\Software\Classes\*\shell\AddToHFS3` and `Directory\shell\AddToHFS3` registry entries to the new Smaran label and logo.
  - Bundled Smaran icons (`hfs.ico` and `smaran.ico`) into the root engine archive and ensured synchronization upon startup and extraction.

---

# Smaran 3.4.1

- **File Server Startup Control:**
  - Disabled file server automatic startup on application launch by default. The server only starts when explicitly started by the user or when Auto-start is deliberately enabled in Settings.
  - Eliminated automatic start coupling to previous `enabled` state.
- **Complete Application Exit from System Tray:**
  - Selecting "Quit Smaran" from the system tray terminates the application completely and immediately.
  - Synchronously terminates the HFS process sidecar (`taskkill /F /T /PID`) and suppresses all exit notifications (e.g. "File server stopped").
  - Cleanly destroys system tray and all notification windows with zero lingering background processes.
- **Notification Theme & Hover/Unhover Fixes:**
  - Restored Smaran's native warm theme tokens (`glass-card`, `text-ink`, `text-muted`, `bg-accent`, `bg-hover`, `border-line/60`, and native action buttons) on all notification cards.
  - Resolved hover/unhover edge-case where cursor rapidly exiting the window left notifications stuck on screen; implemented main-process OS screen cursor bounds tracking (`screen.getCursorScreenPoint()`), unhover events, and renderer heartbeat verification.
  - Clicking "Open File Server", "Open Smaran", or "Open History" navigates to the app and smoothly dismisses the notification.
- **Attention Motion Setting:**
  - Set Attention motion to OFF by default. Motion styles and configuration options only display when the master toggle is switched ON.
- **Expanded Automation & File Server Desktop Notifications:**
  - Designed dedicated expanded notification cards for Automations, File Server events, and Security alerts.
  - Cards feature the Smaran animated brandmark, category badges (Automation, File Server, Security Alert), clear titles, detailed descriptions, event timestamps, metadata badges (User, Client IP, Access Type, Reason, Attempt count), and context-aware action buttons.
  - Implemented smooth top-down entry animation (`translateY(-36px)` -> `translateY(0)`) and upward dismissal animation (`translateY(0)` -> `translateY(-36px)`).
  - Preserved traditional phone-pill morphing and snooze behavior for ordinary reminder notifications.
- **Removed Unwanted Loading Line:**
  - Completely eliminated the animated screen border light beam (`ScreenBorderWindow`) and notification card perimeter border light (`<BorderRing />`).
  - Progress countdown indicators now display exclusively within their respective automation cards.
- **Resolved Critical File Server Status Flickering:**
  - Synchronized authoritative process state (`stopped`, `starting`, `running`, `stopping`, `error`) from the main process supervisor into the global Zustand store (`useApp`).
  - Eliminated the 0.5s temporary "Starting Server" flash when switching between application tabs.
  - Added a start concurrency mutex in `HfsProcessSupervisor` preventing duplicate concurrent start invocations.

---

# Smaran 3.4.0

- **Complete Settings Architecture Redesign:**
  - Redesigned `Settings.tsx` into four distinct primary categories: **System**, **Reminders**, **Automations**, and **File Server**.
  - **System Settings:** Windows startup control (`startAtLogin`), display font selector, theme options (Dark / Light / System), backup & restore (export, restore, add reminders from file, reveal data folder), and diagnostic system information.
  - **Reminder Settings:** Focus & quiet hours, hold reminders while busy, global reminder pause, notification screen corner position, target display selector, notification card size presets, attention motion styles, notification card shapes, display duration presets & custom seconds, chime sound toggle, screen border light beam (thickness, brightness, interactive preview), and test reminder trigger.
  - **Automation Settings:** Enable/disable automations, global automation pause, smart pre-execution desktop notifications toggle, configurable countdown slider (1 to 60 seconds, default 5 seconds), audio chime toggle, and failure notification alerts.
  - **File Server Settings:** Master file server toggle, auto-start on Smaran launch, live port & network status, storage root directory picker with default reset, successful login alerts, failed login alerts, and administrator activity notifications.
  - All configurations persist reliably in local storage and restore seamlessly across app restarts.
- **Smart Automation Notification System:**
  - Designed interactive desktop notification cards presented before executing scheduled automation actions.
  - Includes Smaran branding, action description, scheduled execution time, animated countdown ("Starting in 5 s"), progress indicator bar, and action buttons: **Cancel** (aborts execution and records outcome in history) and **Run Now** (immediately executes action).
  - Main-process timer orchestration ensures robust countdown handling regardless of renderer window state.
  - Automatic failure notifications trigger if any automation step encounters an execution error.
- **File Server Security & Activity Notifications:**
  - Integrated real-time security event interception directly from the Smaran HFS sidecar process.
  - Captures successful user logins, failed login attempts, and administrative modifications (port changes, storage root reconfigurations, server start/stop, credential updates).
  - Implemented normalized client IP resolution (strips IPv4-mapped IPv6 `::ffff:` wrappers and maps local loopback addresses) with LAN vs. External network detection.
  - Implemented rolling 15-minute brute-force tracking per IP: repeated failed attempts escalate in severity (warning to critical).
  - Pushes security and activity events simultaneously to desktop notifications, persistent Notification Center inbox, and permanent History.
- **Unified Notification Center & Extended Audit History:**
  - Unified event data model spanning `reminders`, `automations`, `fileserver`, `security`, and `system`.
  - Added slide-over **Notification Center Drawer** accessible from the navigation sidebar with live unread badge count, category filtering, mark as read, delete, and clear inbox controls.
  - Extended **History** with category filters (All Events, Reminders, Automations, File Server, Security, System), real-time search filtering, date grouping, category-specific icons, and permanent audit retention (clearing inbox notifications never erases audit history).
  - Added **Security & Live Connected Sessions** dashboard card in File Server view featuring live connected client monitoring with one-click session disconnection.

---

# Smaran 3.3.17

- **HFS Engine Archive Root Extraction Fix:** Resolved server startup alert (`HFS engine extraction incomplete. Missing entry points: src/index.js, package.json, central.json`). Corrected the tar packaging pipeline in `scripts/prepare-release-dirs.mjs` to bundle engine resources strictly at the archive root (`-C resources/engine/dist .`) without an extraneous `dist/` directory prefix.
- **Automatic Self-Healing Engine Extraction:** Added automatic nested directory detection and flattening (`flattenNestedDistIfNeeded`) in `HfsProcessSupervisor.ts`. Any existing or previous installation where the engine was extracted into `fileserver_engine/dist/` is automatically flattened into the engine runtime root directory on startup, eliminating the need to manually clear application data.
- **Eliminated Windows License File Lock Race Condition:** Fixed an issue where importing a license in portable mode could revert to "Activation Required" until re-imported. 
  - In `LicenseStore.ts`, throttled `lastSeen` timestamp updates to at most once per hour instead of re-writing the license file to disk on every single license check or status poll.
  - Isolated the `lastSeen` update in an independent `try/catch` block so temporary Windows filesystem lock collisions, indexer contention, or background reads never invalidate a cryptographically verified license.
  - Replaced fixed `.tmp` naming with unique temporary filenames and added atomic `copyFileSync` fallback when `renameSync` encounters temporary Windows file handle locks.
- **Dynamic Stale License Error Recovery:** Enhanced `HfsProcessSupervisor.getStatus()` to proactively clear cached "License activation required" warning banners as soon as a valid license is detected in the environment.

---

# Smaran 3.3.16

- **Top-Right WebDAV Mount Option on Client Web GUI:** Relocated the WebDAV network drive mount widget to the top-right corner of the HFS client web interface (`custom.html`). Added a live pulsing indicator dot (`#e06c43`), folder icon, and adaptive label (`Mount as Drive Z:` on desktop, compact `Mount Drive` on mobile viewports &le;768px).
- **Interactive WebDAV Network Drive Dialog:** Dropped down from the top-right button with a solid dark obsidian backdrop (`#15151c`), high-contrast border, and elevated z-index, completely eliminating bleed-through of underlying directory items. Includes:
  - 1-Click Windows Mount Script (`.bat`) download configured for WebClient service activation and Drive Z: mapping.
  - Direct WebDAV URL with one-click clipboard copy.
  - Quick setup instructions for Windows Explorer, macOS Finder (`Cmd+K`), and mobile WebDAV clients.
  - Click-outside and close-button dismissal.
- **Centered Background Watermark Logo:** Embedded a large, centered vector brandmark of Smaran's signature 'S' curve in the background of the web interface (`opacity: 0.09` desktop, `0.07` mobile) with ambient radial lighting and `pointer-events: none` to keep interactive directory tables fully accessible.
- **Default Administrator Credentials & Password Pattern:**
  - Default administrator username updated from `admin` to `smaran`.
  - Auto-generated default password pattern strictly adheres to: `smaran@DDMMYYYY-Exacttime-Day(in short) with sec` (e.g. `smaran@20112026-025130-Fri`), satisfying all length, character class, entropy, and complexity rules.
  - Handled on first initialization in `FileServerStore.ts` and default reset in `FileServerManager.ts`.
- **HFS Theme Harmonization, Plugin Compatibility & Mobile Responsiveness:**
  - Overhauled `:root` CSS variables in `custom.html` to align with Smaran's dark obsidian atmosphere (`#0d0d11`) and warm amber accents (`#e06c43`/`#e07850`).
  - Preserves 100% functionality across all 19 bundled plugins (mini-player, video player, chat plus, upload, directory search, download counters, server info).
  - Responsive layout scaling cleanly down to narrow mobile viewports without horizontal clipping.
- **Automatic Runtime Engine Synchronization:** Enhanced `HfsProcessSupervisor.ts` to automatically detect changes to `resources/engine/dist/custom.html` and synchronize them directly into `%APPDATA%\Smaran\fileserver_engine\custom.html` on engine startup.

---

# Smaran 3.3.15

- **Unified File Server Design System:** Completely overhauled `FileServer.tsx` to align seamlessly with Smaran's design tokens and aesthetic established across `Reminders`, `Automations`, `Today`, and `Settings`. Replaced disparate 2-column numbered developer boxes with standard Smaran containers (`max-w-[820px] px-7 pt-8 pb-16`), canonical Anthropic Serif typography (`font-serif text-[26px] leading-tight`), consistent action button layouts, and native `Card` and `Row` structures.
- **Header Alignment & Status Toolbar:** Replaced oversized hero box with a standardized Smaran page header displaying live server controls ("Admin Panel ↗", "Restart", "Stop Server" / "Start Server") directly in the header toolbar, accompanied by an elegant live status overview card with metric badges.
- **Left Panel Navigation Polish:** Removed the redundant "Reminders are on" status indicator from the left navigation sidebar in `App.tsx` for a cleaner, distraction-free sidebar layout.
- **Custom Themed 404 & 403 Error Pages:** Integrated full Smaran-branded vector art and obsidian theme into HFS error pages served by the engine.

---

# Smaran 3.3.14

- **Restored Pre-Installation Setup Screen & User Control:** Fixed installer regression where double-clicking the Setup executable started copying files immediately. Restored the dedicated pre-installation screen presenting destination path (`%LOCALAPPDATA%\Programs\Smaran`), license status, and user action buttons: "Start Installation", "Change License…", and "Cancel". The installer strictly waits for explicit user confirmation before touching the disk.
- **Dedicated Completion Screen & Explicit Application Launch:** Eliminated automatic background application launching during installation. Upon copying completion, an interactive completion screen ("Smaran is Ready") displays with the animated checkmark scene and explicit choices: "Launch Smaran" (launches application and closes installer) and "Finish" (closes installer without launching).
- **Restored Portable License Activation Workflow:** Restored the expected portable application licensing sequence in `LicenseGate.tsx`. The license screen opens in idle state with "Import License Image…" and "Quit". Selecting a file does not trigger premature background processing; instead, it executes the full visual verification sequence across four distinct milestones (payload extraction, Ed25519 digital signature validation, integrity/credential checking, and offline installation finalization) before cleanly activating the main application.
- **Target-Specific Windows Process Cleanup:** Rebuilt Windows process management in `src/main/setup/winSystem.ts` using strict path and command line validation (`verifiedSmaranProcs`). Strictly targets `Smaran.exe` located within the designated installation directory and Smaran HFS child processes matching both `fileserver_engine` and `config.yaml`. Never terminates unrelated Electron, Node, or developer processes running on the host system.
- **True Application Window Readiness Verification:** Enhanced `launchAndVerifyInstalled()` in `src/main/setup/install.ts` to verify the actual Windows GUI window handle (`MainWindowHandle != 0`) and process responsiveness, rather than relying solely on process ID existence. Added asynchronous child spawn error handling and robust polling timeouts.
- **Strict HFS Engine Archive Integrity Verification:** Implemented pre- and post-extraction archive validation using native `tar.exe -ztf`. Verifies that `resources/engine.tar.gz` is present, uncorrupted, exceeds 1 MB, and contains essential runtime entry points (`src/index.js`, `package.json`, `central.json`). Safely cleans up incomplete extractions if extraction fails.
- **Fail-Fast Release Pipeline for HFS Assets:** Updated `scripts/prepare-release-dirs.mjs` to validate archive integrity before building release distributions, terminating the build process (`process.exit(1)`) immediately if `engine.tar.gz` is missing, damaged, or incomplete.
- **Cryptographically Secure Default Admin Credentials:** Completely eliminated hardcoded default credentials (`smaran` / `smaran`). New installations generate a cryptographically random 16-character password (`crypto.randomBytes(12).toString('base64url')`), legacy installations with default passwords are automatically upgraded to unique secure credentials, and both frontend and backend enforce minimum 8-character passwords with common default rejections.
- **Multi-Target Authenticode Signature Verification:** Completely overhauled `scripts/verify-signatures.mjs` to independently verify Authenticode signatures for the Main Application executable (`Smaran.exe`), Windows Setup Installer (`Smaran-Setup-*.exe`), and Portable executable (`Smaran-*-portable.exe`). Halts with exit code 1 if any expected executable is missing. Accurately reports certificate validity and never claims signed status without a valid certificate.
- **Comprehensive Unit Testing Suite:** Added `tests/unit/setup.test.ts` verifying process isolation environment filters (`appEnv()`), installation path resolution, engine archive integrity checks, secure password generation, and password complexity validation.

---

# Smaran 3.3.13

- **Windows Authenticode Code Signing Configuration & Verification:** Configured automated Windows Authenticode signing pipeline in `electron-builder.yml` with SHA-256 digest hashing and RFC 3161 DigiCert timestamping (`http://timestamp.digicert.com`). Added `scripts/verify-signatures.mjs` to inspect output binaries, reporting certificate status, signer identity, issuer, thumbprint, and timestamp validity. Added comprehensive `docs/WINDOWS_SIGNING_GUIDE.md` covering OV/EV certificate acquisition, Azure Trusted Signing / cloud HSM integration, and SmartScreen reputation building.
- **Lightning-Fast Portable Startup (< 1.5 Seconds):** Eliminated packaging duplication that previously bundled 12,201 loose files into the portable 7-Zip SFX package. Packaged the self-contained HFS server engine into a single compressed 5 MB archive (`resources/engine.tar.gz`), reducing the unpacked Windows distribution file count from 12,201 files to ~45 files and eliminating 3–4 minutes of antivirus and extraction latency down to < 1.5 seconds.
- **On-Demand Engine Extraction with 0ms Re-Startup:** Enhanced `HfsProcessSupervisor` with automated archive extraction using Windows native `tar.exe`. The server engine is extracted only when the file server is initialized for the first time; subsequent server starts verify the runtime directory and start in 0 ms without re-extracting.
- **Rebuilt Windows Installer Architecture & Fixed Post-Install Launch:**
  - Standardized per-user installation path to `%LOCALAPPDATA%\Programs\Smaran` with zero administrator privilege requirement.
  - Eliminated brittle `explorer.exe` invocation in `launchInstalled()`. The installed application is launched directly with an isolated environment (`appEnv()`), cleanly stripping all `PORTABLE_EXECUTABLE_*` variables so the app never re-triggers the setup routine.
  - Added process startup verification (`waitForSmaranRunningFrom`) that polls the operating system process table for 4.5 seconds to confirm `Smaran.exe` is actively running before concluding the setup window.
  - Added interactive error handling with "Try Again" and "Open Folder" options in `SetupCard.tsx` in case of unexpected launch blockage.
- **Robust Windows Apps & Features Uninstallation:**
  - Enhanced uninstall argument detection to handle `--uninstall`, `-uninstall`, and `/uninstall` flags, ensuring the uninstaller window opens reliably from Windows Settings > Installed Apps.
  - Prioritized uninstaller evaluation before setup or application startup.
  - Automatically terminates lingering Smaran processes and background HFS engine child processes prior to file cleanup.
  - Unregisters Start Menu and Desktop shortcuts, Windows Run startup entries, and registry uninstall keys.
  - Safely preserves user data, reminders, automations, and license keys by default, offering an optional checkbox for full data deletion.
  - Handled locked file removal with a delayed, hidden cleanup script executing after process termination.
- **Instantaneous Cryptographic License Verification:** Removed artificial 10-second verification delay (`durationMs = 10000`) in `LicenseGate.tsx`. The Ed25519 digital signature and steganographic license payload are verified cryptographically in under 50ms, transitioning immediately to welcome and activation.
- **Startup Diagnostics Instrumentation:** Added `src/main/system/diagnostics.ts` tracking process initialization, `app.whenReady()`, license validation, window rendering, and engine startup milestones without exposing license keys or passwords.

---

# Smaran 3.3.12

- **Full Shared Files Permissions by Default:** Configured default Virtual File System (VFS) permissions to full shared access (`can_see: "*"`, `can_read: "*"`, `can_list: "*"`, `can_upload: "*"`, `can_delete: "*"`, `can_archive: "*"`), allowing seamless read, write, upload, delete, and archiving across all client devices on the local network.
- **Default Storage Directory Set to Documents/Smaran Files:** Updated default root storage directory to `Documents/Smaran Files` (`app.getPath('documents')/Smaran Files`), providing an easily accessible, dedicated personal file hub in the user's Documents library.
- **Custom Themed Error Pages (403 Forbidden & 404 Not Found):** Integrated custom dark obsidian (`#0d0d11`) and warm amber (`#e06c43`) error templates into HFS `custom.html`, featuring official Smaran vector branding, clear error descriptions, return-to-files navigation (`$URL`), and direct link to the Admin Panel.
- **Automated Windows WebDAV Fix (WebClient Service & BasicAuthLevel):** Resolved Windows Explorer WebDAV mounting error ("Windows could not reach the WebDAV endpoint / Ensure WebClient service is enabled") caused by Windows default `BasicAuthLevel=1`. Added an automated Administrator setup tool (`enable-webdav.bat` and 1-click in-app action) that configures the Windows `WebClient` service to Automatic, enables unencrypted HTTP Basic Authentication (`BasicAuthLevel=2`), sets the file transfer size limit to 4GB, and restarts the service.
- **Network WebDAV Client Mount Script & In-Browser Widget:** Built an automatic mount script generator and added an in-browser WebDAV connection widget to the frontend (`[top]`). Any client on the network can download a customized `mount-smaran-drive.bat` directly via `/~/webdav/mount.bat` to mount Drive Z: with 1 click.
- **Export Mount Script from Desktop UI:** Added an "Export Mount Script (.bat)" button in the desktop WebDAV control card, allowing users to save and share the pre-configured mount script with any Windows PC on their network.

---

# Smaran 3.3.11

- **Complete WebDAV Integration & Verified Drive Mounting:** Fully enabled and verified WebDAV protocol compliance (RFC 4918), supporting OPTIONS and PROPFIND methods, Basic authentication, and native Windows File Explorer network drive mapping (`net use Z:`). Includes robust drive verification check (`fs.existsSync('Z:\\')`), automated WebClient service startup query, and meaningful, human-friendly error messages on connection failures.
- **Background Startup by Default & Browser Launch Preference:** Starting the file server runs quietly in the background without automatically launching Chrome or any browser. Added an explicit desktop setting: `Automatically open Admin Panel after server starts` (`autoOpenAdminOnStart`, default OFF). The manual "Open Web Admin Panel ↗" button remains active at all times when running.
- **Live Port Configuration & Automatic Server Reload:** Added live HTTP server port configuration directly from the desktop UI (validating unprivileged ports 1024–65535 and verifying socket availability). Applying a new port synchronizes HFS `config.yaml` and smoothly restarts the running engine without manual process stopping, updating all localhost, LAN, WebDAV, and QR endpoints instantly.
- **Custom Storage Root Directory Synchronization:** Selecting a new storage directory via native Windows folder picker saves permanently to configuration, immediately re-points HFS root VFS (`vfs.source`) with full upload/delete permissions, and restarts the engine automatically so files in the new directory are instantly served over Web and WebDAV. Added 1-click "Reset to Default" storage directory option.
- **Automatic Administrator Credentials Synchronization:** Updating administrator username or password from desktop UI securely writes to HFS `config.yaml` and restarts the engine via sequential sync queue, immediately validating new credentials and rejecting stale passwords across Web Admin and WebDAV without storing plaintext passwords in logs.
- **Sequential Configuration Synchronization Queue:** Protected all server configuration updates (port, storage directory, credentials, launch preferences) with a sequential execution queue, preventing race conditions or conflicting simultaneous process restarts.
- **Organized 5-Section Desktop Control Center:** Rebuilt `FileServer.tsx` into five distinct, intuitive control sections:
  1. **Server Configuration**: Start/stop/restart controls, live pulsating status beacon, active port input with Apply button, and auto-start toggle.
  2. **Storage Directory**: Current path display with tooltips, browse folder picker, open in Windows Explorer, and reset to default directory.
  3. **WebDAV Network Storage**: Real-time WebDAV status badge, live WebDAV URLs (localhost & LAN), 1-click URL copy, verified "Mount as Drive Z:" button with loading spinner, and unmount button.
  4. **Administrator Credentials**: Admin username, masked password input with Show/Hide toggle, and Save Credentials button with sync feedback.
  5. **Browser & Administration**: Auto-open Admin Panel switch, admin console URL, and primary Web Admin Panel launch button.
- **Factory Defaults Reset:** Preserved the dedicated Danger Zone card and confirmation modal to easily revert to factory defaults (port 5901, admin `smaran`/`smaran`, default folder, and 19 bundled plugins).

---

# Smaran 3.3.10

- **Redesigned Desktop File Server Dashboard:** Completely overhauled the desktop application File Server interface (`src/renderer/app/pages/FileServer.tsx`) into an elegant, high-contrast, modern control center adhering strictly to Smaran's design system (`bg-surface`, `bg-sheet`, `border-line`, `text-ink`, `text-muted`, and warm amber `#e06c43`).
- **Removed Engine Version Badges:** Removed all user-facing `HFS 3.4.1 Engine` badges and labels from the desktop File Server page, maintaining a unified commercial product presentation while preserving internal technical compatibility.
- **Removed Desktop Activity Logs Table:** Completely removed the desktop activity logs table, clear log buttons, and log display controls from the desktop UI to eliminate clutter while leaving internal diagnostic logging, error reporting, and backend process capture fully intact.
- **Enhanced Start Server Experience:** Redesigned the running state with a live pulsating status beacon, real-time metrics summary (Port, Active Client Connections, Web Access State, and Root Directory name with Explorer button), and organized network endpoint cards.
- **Polished Network Endpoints & Drive Mount Card:** Split live access into dedicated LAN Wi-Fi cards (with 1-click URL copy and QR Code modal) and Localhost/WebDAV cards with integrated Windows Explorer Drive Z: mounting status feedback.
- **Refined Admin & Storage Settings Grid:** Beautiful two-column configuration section for live Admin Credentials (username and password with visibility toggle) and Storage/Networking parameters (Root folder picker, HTTP port, and auto-start toggle).
- **Safe Reset to Defaults Modal:** Added a dedicated Danger Zone card with a 2-step confirmation modal to restore factory configuration without accidental clicks.

---

# Smaran 3.3.9

- **Pre-bundled 19 Official Plugins:** Included 19 high-value HFS plugins out-of-the-box (`archive-viewer`, `file-resumer`, `image-tools`, `mediainfo`, `pdf-viewer`, `search`, `srt-subtitles`, etc.) pre-configured as defaults.
- **Client Frontend Favicon:** Added official Smaran branding favicon to the client browser dashboard.
- **Reset Configuration to Defaults:** Added factory reset capabilities both via desktop app confirmation and in-browser endpoint (`/~/admin/reset`).

---

# Smaran 3.3.8

- **Professional Redesigned Web Admin Sidebar:** Replaced the default bright orange sidebar with an obsidian dark theme palette (`#111114`), high-contrast typography, warm amber accents (`#e06c43`), smooth hover and selection transitions, and active navigation indicators.
- **Official Smaran Watermark:** Replaced the legacy coffee cup background graphic with the official Smaran vector watermark, rendered with subtle transparency and elegant positioning that preserves dashboard readability.
- **Removed HFS Update Prompts & Badges:** Eliminated all default HFS update check sections ("No update available", "All releases", "Auto check updates daily", "Include beta versions") and telemetry surveys, ensuring complete visual independence without interfering with Smaran's own update system.
- **Cleaned Branding & Removed HFS Versioning:** Removed user-facing `3.4.1` version numbers beside Smaran HFS headers for a clean commercial product presentation while preserving internal technical compatibility.
- **Enhanced Typography:** Adopted modern Inter sans-serif typography across the administration interface for consistent font weights, crisp line heights, and refined mobile/desktop readability.
- **Updated Default Port to 5901:** Changed default HTTP file server listening port from `8080` to `5901` across server stores, supervisor, UI inputs, and drive mounting.
- **Default Admin Credentials (`smaran`/`smaran`):** Configured out-of-the-box administrator credentials to username `smaran` and password `smaran` with instant SRP credential synchronization.

---

# Smaran 3.3.7

- **Full Native Integration of HFS 3.4.1 Engine as Smaran HFS:** Directly integrated the complete, official HFS (HTTP File Server) v3.4.1 engine into Smaran as a fully native, managed subsystem while keeping all core reminder and automation features cleanly isolated and untouched.
- **Dedicated Desktop Controller with In-Browser Web Admin:** Desktop application features a streamlined file server control center with power toggles, real-time status badges, LAN & Localhost client links, 1-click In-Browser Web Admin Panel (`/~/admin/`), live Admin Credentials Manager (Username & Password with SRP sync), and live audit logs drawer.
- **Zero-Trust Hardened Security:** Enforces `localhost_admin: false` with unforgeable internal tokens (`SMARAN_INTERNAL_TOKEN`) and CSRF protection to prevent any unauthorized localhost or network administrative bypasses.
- **Persistent Web Admin Configurations:** Changes made in the web admin panel (VFS mounts, granular user accounts, folder permissions, speed limits, reverse proxy settings) are permanently stored and restored cleanly across restarts in `config.yaml`.
- **Embedded Zero-Dependency Windows Packaging:** Bundles the precompiled HFS engine, web frontend, admin panel, and runtime plugins directly inside `resources/engine/dist`, running seamlessly on Electron's internal Node runtime (`ELECTRON_RUN_AS_NODE`) without requiring any separate Node.js installation.
- **1-Click WebDAV & Network Sharing:** Instant Windows Explorer WebDAV Drive Z: mounting, vector QR code modal for mobile devices, and LAN/WAN link copying.

---

# Smaran 3.3.6

- **Complete Removal of File Server Subsystem:** Fully eliminated all file server and HFS engine components, sidecar supervisor, HTTP servers, WebDAV modules, VFS mounts, and related background processes.
- **Pure Core Reminder & Automation Experience:** Restored Smaran to its focused, lightweight, and calm reminder and automation utility with zero background network listening ports or extra server overhead.
- **Reduced Binary Size & Dependencies:** Removed all external file server dependencies (`@rejetto/nat-upnp`, `mime-types`, `qrcode`, `yazl`), returning the executable and installation packages to a minimal footprint.

---

# Smaran 3.3.5

- **Full In-Browser HFS 3.4.1 Administration (`/~/admin/`):** Full web-based administrative management matching original HFS capabilities. Manage Virtual File System (VFS) nodes, user accounts and roles, granular folder permissions, upload/download limits, plugins, logs, and server options directly in the browser.
- **Persistent HFS Configuration Across Restarts:** Modified supervisor configuration lifecycle so `config.yaml` is permanently preserved. Any folders, accounts, limits, or plugin configurations saved via the web admin panel persist across server restarts and application reloads.
- **Streamlined Desktop File Server Controls:** Redesigned the desktop software File Server view into a fast, clutter-free controller. Removed duplicate sub-tabs in favor of direct Client Web Links (LAN & Localhost), 1-click Web Admin Panel button (`/~/admin/`), real-time Admin Credentials Control (Username & Password configuration with SRP synchronization), and live server logs drawer.
- **Direct Admin Credentials Synchronization:** Updated Electron IPC and backend supervisor to dynamically configure the HFS admin username and password. Changes made from the desktop app are synced via HFS API in real time or written to `config.yaml` when stopped.
- **1-Click WebDAV & Network Sharing Tools:** Retained instant 1-click Windows Explorer Drive Z: mounting, vector QR code generation for mobile devices, and LAN/WAN link copying.

---

# Smaran 3.3.4

- **Integrated Official HFS 3.4.1 File Server Engine:** Replaced custom HTTP file serving with the production-grade HFS (HTTP File Server by Rejetto) v3.4.1 engine running as a managed, high-performance isolated sidecar process.
- **Zero-Trust Security & Hardened Localhost Administration:** Completely resolved HFS's default `localhost_admin` vulnerability by explicitly enforcing `localhost_admin: false` and establishing an unforgeable, cryptographically random internal bridge token (`SMARAN_INTERNAL_TOKEN`) with anti-CSRF protection between Smaran's Electron process and the engine.
- **Smaran HFS Dark Theme & Visual Identity:** Customized the HFS web explorer and admin dashboard with the official Smaran charcoal dark theme palette (`#0c0c0e`, `#16161a`), warm amber brand accents (`#e06c43`), and high-resolution Smaran vector logos.
- **Automated Process Lifecycle Supervision:** Built `HfsProcessSupervisor` with automated child process spawning, non-blocking health check polling, PID tracking, stdout/stderr audit logging, and clean exit handling with zero orphaned processes on shutdown.
- **Self-Contained Bundling & Packaging:** Embedded the complete precompiled HFS engine, frontend assets, admin console, and production dependencies directly into `resources/engine/dist`, running seamlessly via Electron's internal Node runtime without requiring any external Node.js installation.

---

# Smaran 3.3.3

- **HFS-Inspired Reliability & Zero-Trust Authentication:** Hardened the embedded Smaran file server engine with industrial-grade session validation, rejecting bad credentials immediately with 401 Unauthorized and eliminating any possibility of authentication fallthrough into guest mode.
- **Locked Non-Dismissible Sign-In Modal:** Protected the web explorer with a non-dismissible, locked login modal and inline red error feedback badge whenever authentication is required or credentials fail.
- **Dedicated Previews in New Browser Tabs:** Added `/preview/<path>` endpoint delivering standalone, streaming media previews (HTTP 206 Range video/audio seeking, zoom/pan/rotate image viewer, syntax-highlighted code viewer with one-click copy, PDF viewer, and clean download fallback cards) under a strict Content Security Policy.
- **Dual Local LAN & External WAN Sharing:** Share modal now provides an instant toggle between Local LAN URLs and External (Public / DDNS) URLs, complete with real-time vector SVG QR code generation and 1-click clipboard copy.
- **Desktop-Grade Right-Click Context Menu:** Native floating context menu for fast Open/Preview, Download, Share, Copy Link, Rename, and Delete with viewport edge clamping.
- **Security Regression Suite:** Added 25 automated security tests in `tests/unit/fileserver-security-regression.test.ts` covering failed logins, token verification, and role permissions.

---

# Smaran 3.3.2

- **Enterprise NAS UI/UX Redesign:** Transformed the Smaran HFS web manager into a modern, enterprise-grade LAN file server interface inspired by Synology DSM, Linear, Dropbox, and Google Drive.
- **Dark-First Modern Aesthetics:** Deep charcoal styling (`#0c0c0e`), elevated panels (`#16161a`), subtle borders, Inter typography with tabular numerals, and refined Smaran warm amber accents (`#e06c43`).
- **Fixed App Shell & Collapsible Navigation Sidebar:** Fixed 54px header with glassmorphism, responsive sidebar drawer for tablets and mobile devices, and smooth transitions without viewport jumps.
- **Sidebar Sections with Real Data:** Quick access to My Files, Recent Activity (backed by real server transfer history), Shared Links (live token management), and Virtual File System (VFS) drives, plus a real-time docked Storage & System Info card with dynamic storage meters and live upload/download speed gauges.
- **Dual File Explorer Views:** Instant toggle between a clean table view with inline image thumbnails, Lucide-style type icons, formatted sizes, relative dates, and hover actions, and a NAS card grid view with folder cards and rich preview headers.
- **Folder-Specific Drag & Drop Targeting:** Dragging files over any folder row or card highlights that specific folder with an amber glow and uploads directly into it.
- **Floating Upload Manager:** Asynchronous background upload dock with real-time transfer speeds in MB/s, estimated time remaining (ETA), queue progress, and minimize/expand controls.
- **Floating Multi-Item Selection Dock:** Select multiple files or folders to stream as a ZIP archive or perform batch deletions with confirmation dialogs.
- **Self-Contained Vector SVG QR Code Generator:** Generate instant vector QR codes for local LAN shares without any external CDN or internet dependency.
- **Comprehensive 10-Tab Enterprise Admin Dashboard:** Full NAS management suite covering Server Overview metrics, Server Settings, Users & Roles (with 8 granular permission toggles), VFS Mounts, Shared Links, Live Client Sockets with 1-click disconnect, Bandwidth & Throttling, WebDAV & Tunneling guidance, Security & IP controls, and Real-Time Audit Logs.
- **Network Transfer Benchmark (Speed Test):** Integrated speed test modal measuring ping latency, streaming download MB/s, and chunked upload MB/s directly between browser and server.

---

# Smaran 3.3.1

- **Application Logo as Official Web Favicon:** The file server web manager now serves the official Smaran logo icon as its favicon (`/favicon.png` and `/favicon.ico`) with HTTP caching and embedded fallback, ensuring the Smaran brand appears consistently in browser tabs and bookmarks.
- **Eliminated Browser-Native Popups:** Web browser API requests no longer trigger the browser's native basic auth credentials dialog. The `WWW-Authenticate: Basic` challenge header is now reserved strictly for WebDAV client user-agents (`Microsoft-WebDAV-MiniRedir`, `DavWWWRoot`, `WebDAVFS`), allowing the clean Smaran in-app login modal to operate without conflict.
- **Ultra-Smooth 60fps Vector Smaran Dots Logo:** Replaced the low-resolution SVG goo-filter animation in the web manager header with the official vector-resampled `dots.js` engine. Smoothly morphs between signature scenes (`smark`, `dance`, `bell`, `check`, `heart`) at 60fps with zero pixelation or blurry edges on any display resolution.
- **Secure Password Handling & Refresh-to-Logout:** Removed hardcoded default credentials from the sign-in modal fields. Session tokens are now stored strictly in JavaScript memory (`X-Session-Id`) without persistent cookies; reloading or refreshing the web page immediately logs out the session. Removed the 15-minute inactivity timer so long-running transfers and active sessions never drop unexpectedly.
- **1-Click WebDAV Disk Mounting for Windows Explorer & macOS:** 
  - **In-App Desktop:** Added a 1-click **"Mount as Drive Z:"** button in the File Server dashboard that starts the Windows WebClient service, maps the local drive letter, and opens Windows Explorer directly.
  - **LAN Web Clients:** Added a 1-click **"Download 1-Click Drive Mounter (.bat)"** endpoint (`/api/mount-bat`) in the web manager that generates a ready-to-run Windows batch script. The script automatically enables Windows LAN HTTP authentication (`BasicAuthLevel=2`), clears previous mappings, maps Drive Z:, and opens the folder.
  - **Bidirectional Live Sync:** Files added, modified, or deleted in the mounted drive immediately sync with host storage according to the authenticated user's permissions.
- **Safe Native ReplaceState Address Bar Context:** Ported the `safeNativeReplaceState` typewriter effect from `blog.sahaj.si`. Smoothly streams the client identity into the address bar (`/?context=you@<ip>`) with zero backend 302 redirects, zero router reconciliation crashes, and zero page reloads.
- **Complete Web Administration Suite:** Authenticated administrators can now manage every aspect of the server directly from their browser across an expanded 6-tab Admin Panel:
  - **Settings:** Edit Server Name, Host Root Path, HTTP Port, Bind Address, Max Connections, Upload Size Limit, Rate Limit, Download/Upload Speed Caps, Per-IP Speed Caps, Authentication Required, Guest Access, WebDAV, UPnP, and Brute Force Protection.
  - **User Accounts:** Add, delete, and fully edit existing user accounts (change roles, update passwords, and toggle each of the 8 permissions: Read, Upload, Delete, Rename, Mkdir, Comment, VFS, Zip).
  - **VFS Mounts:** Add virtual folder mappings to physical host folders and configure read-only flags.
  - **Active Shares:** Inspect and revoke tokenized sharing links.
  - **Live Connections:** View connected client sessions and disconnect sockets with 1 click.
  - **Audit Logs:** Real-time searchable server activity log with one-click clear.

---

# Smaran 3.3.0

- **Mandatory Web Authentication & System Admin Protection:** Web file server requires authentication by default. Initialized with secure default administrator (`smaran` / `smaran@123`) requiring compulsory password change on first sign-in. The `smaran` username is protected against renaming or deletion. Includes 15-minute idle session timeout with active transfer exemption and `beforeunload` transfer protection.
- **Full Web-Based Administrator Control Panel:** Authenticated administrators can manage server configuration entirely through the browser: update server name, listening port, max connections, upload limits, and rate limits; create and manage user accounts with granular permissions (Read, Upload, Delete, Rename, Mkdir, Comment, Zip, VFS); manage Virtual File System mounts; and inspect/clear real-time server audit logs.
- **High-Concurrency Engine for Enterprise Workloads:** Socket and keep-alive tuning supporting thousands of simultaneous connected PCs (`maxConnections = 2048`, `keepAliveTimeout = 65000ms`, `socket.setNoDelay(true)`, `socket.setKeepAlive(true, 15000ms)`). Backpressure-aware streaming ensures low memory footprint under high traffic.
- **Granular Authenticated WebDAV Drive Mounting:** Windows Explorer and macOS Finder drive mapping (`net use Z: http://<IP>:5900/`) prompts for credentials via HTTP 401 Basic Realm challenge. Bidirectional changes sync live with host filesystem while enforcing per-user permissions for `PROPFIND`, `PUT`, `DELETE`, `MKCOL`, `MOVE`, and `COPY`.
- **Folder-Targeted Drag & Drop Uploads with Floating Dock:** Drag files or folders onto any folder row with animated highlight targeting to upload directly into that directory. Floating upload progress dock displays overall progress %, real-time speed in MB/s, and dynamic ETA calculation.
- **Integrated LAN & Internet Speed Test Widget:** Real-time throughput and latency testing widget available directly within the in-app server overview and web file manager. Measures local network ping latency, LAN download Mbps, LAN upload Mbps, and external internet connectivity.
- **Client Context URL Synchronization:** Web manager automatically appends client identity context `/?context=<user>@<ip>` to the browser URL, paired with an interactive header status badge showing user role and client IP address.
- **Responsive Multi-Row Tabs & UI Polish:** In-app File Server navigation tabs now wrap cleanly into a 2-row responsive grid across all display resolutions. Replaced raw HTML select dropdowns with Smaran's themed `<Select>` component. Widened actions column with 1-click LAN copy links for every file and folder without clipping.
- **Detailed Server Audit Logs:** Every file upload, download, deletion, rename, directory creation, and authentication attempt is recorded with client IP, timestamp, and HTTP status code. Viewable in real-time in both the app and web admin panel.

---

# Smaran 3.2.1

- **Native Smaran Web Popups:** Completely eliminated browser-native `prompt()`, `confirm()`, and `alert()` dialogs in the web file manager. All user interactions (Folder Creation, Renaming, File Deletion, Batch Deletion, Description/Comment Editing, and Sign In) now use beautifully crafted, native Smaran modal popups featuring Anthropic Serif typography, dark obsidian glass styling, autofocus, Esc/Enter keyboard navigation, and seamless state resolution.
- **Smaran Animated Dots Logo in Web UI:** Integrated the iconic animated 3-dot Smaran logo directly into the web file manager header. Powered by real-time spring physics and an SVG liquid-merge filter, the dots cycle smoothly through signature Smaran dances (`s-mark`, typing `bounce`, orbital `spiral`, and harmonic `wave`) with interactive hover expansion and click impulse kicks.
- **Inline Authentication Feedback:** Replaced browser alert boxes on authentication failure with smooth inline alert notices and shake feedback within the sign-in modal.

---

# Smaran 3.2.0

- **Complete Rejetto HFS 3.4.1 Feature Parity (Zero External Dependencies):** Upgraded Smaran HFS into a full-fledged HFS alternative running natively inside Smaran without external tools or dependencies.
- **Hierarchical Virtual File System (VFS):** Mount arbitrary physical folders/drives (`D:\Photos`), virtual organization folders, and link nodes anywhere in the server path hierarchy. Supports granular permissions inheritance (`canRead`, `canUpload`, `canArchive`, `canDelete`), read-only flags, and hidden nodes.
- **On-the-Fly Streaming ZIP Archives:** Stream single folders or multi-file selections directly as ZIP archives using `yazl` with zero intermediate disk space. Added single-click ZIP download buttons across Web and in-app file managers.
- **Native WebDAV Server (RFC 4918):** Mount Smaran HFS directly in Windows File Explorer as a drive letter (`net use Z: http://<IP>:5900/`) or in macOS Finder without needing a web browser. Full support for `PROPFIND`, `MKCOL`, `MOVE`, `COPY`, `DELETE`, `LOCK`, `UNLOCK`, and `PUT`.
- **In-Browser Rich Media Lightbox & Players:** Built-in fullscreen image lightbox with zoom, rotate, and next/prev cycling; HTML5 seekable video streaming player; audio player; syntax-highlighted code/text viewer; and in-browser PDF preview.
- **Table & Grid View Modes:** Seamlessly toggle between detailed table list view and visual card/thumbnail grid view in the web file manager.
- **Multi-File Batch Selection:** Checkbox selection with floating bottom dock for batch ZIP download and batch deletion.
- **File Descriptions & Comments:** Standard `descript.ion` reading and editing across both the web and in-app managers.
- **Bandwidth Throttling & Limits:** Token-bucket bandwidth limiter with configurable global download/upload caps (KB/s), per-IP speed caps, and maximum concurrent download limits.
- **UPnP Router Port Forwarding:** Single-toggle automatic router port forwarding via `@rejetto/nat-upnp` for instant internet access.
- **Dynamic DNS (DDNS) Updater:** Automated periodic IP updates for DuckDNS, No-IP, DynDNS, and custom webhooks.
- **Live Connection Inspector:** Real-time connected clients table displaying client IP, User-Agent browser/OS, current path, data transferred, and one-click socket disconnect.
- **Security & IP Firewall:** IP allowlist and blocklist masks supporting wildcards (`192.168.1.*`) and CIDR notation (`10.0.0.0/8`), combined with automatic anti-brute force temporary lockout after 5 failed login attempts.

---

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
