# Smaran

Gentle reminders for Windows: type what to remember and when, and Smaran shows it as a calm
notification card at the right time. Lives in the tray.
Automations can also lock, sleep, sign out or shut down the PC, and open apps, files, scripts
and links: at a time, at startup or sign-in, or on Windows events such as lock, unlock and wake.

### Smaran HFS (Self-Hosted HTTP File Server & WebDAV Engine)
Smaran includes its own built-in HTTP File Server engine (inspired by Rejetto HFS) to share files and folders over Wi-Fi and local networks:
- **Zero External Dependencies**: Embedded directly into Smaran's native Node.js process without requiring external servers, runtimes, or tools.
- **Enterprise Concurrency**: High-concurrency socket engine tuned to effortlessly handle 1,000s of simultaneous connected PCs (`maxConnections = 2048`, `keepAliveTimeout = 65000ms`, non-blocking streaming).
- **Mandatory Web Authentication**: Default system administrator (`smaran` / `smaran@123`) with compulsory password change on first login. 15-minute inactivity session expiration with active transfer exemptions and navigation protection.
- **Full Web Admin Control Panel**: Remotely manage server settings (ports, limits, rate limiting), user accounts with granular permissions (Read, Upload, Delete, Rename, Mkdir, Comment, Zip, VFS), VFS mounts, and live audit logs directly from any browser.
- **Granular WebDAV Drive Mapping**: Mount Smaran HFS directly in Windows File Explorer as a drive letter (`net use Z: http://<IP>:5900/`) or macOS Finder with native HTTP 401 Basic Authentication and live bidirectional filesystem synchronization.
- **Folder Drag-and-Drop with Floating Dock**: Drag files directly onto target folders with glowing drop targets. Floating progress dock displays transfer percentage, real-time speed (MB/s), and dynamic ETA.
- **Integrated Speed Benchmark**: Test LAN latency, local download/upload speeds (Mbps), and internet connectivity directly within the app and web manager.
- **Client Context URL Sync**: Browser URLs auto-update to `/?context=<user>@<ip>` with an interactive header status badge showing user role and source IP.
- **Virtual File System (VFS)**: Mount physical disks (`D:\Photos`), virtual organizational folders, and external link nodes with granular inheritance permissions (`canRead`, `canUpload`, `canArchive`, `canDelete`).
- **Streaming ZIP Downloads**: On-the-fly streaming ZIP folder & multi-file downloads directly to HTTP responses via `yazl` without intermediate disk space.
- **LAN Web File Manager**: Responsive, dark-themed web browser interface with table & visual grid views, multi-file selection batch dock, and instant search.
- **In-Browser Rich Media Player**: Lightbox for fullscreen image viewing with zoom/rotate, HTML5 video player, audio player, syntax-highlighted code/text viewer, and PDF preview.
- **File Descriptions**: Standard `descript.ion` reading and editing displayed directly in web & in-app file listings.
- **Bandwidth Throttling & Limits**: Global download/upload speed limits (KB/s), per-IP speed limits, and concurrent download caps.
- **UPnP Router Port Forwarding**: Automatic one-click router port mapping via `@rejetto/nat-upnp` for instant remote access.
- **Dynamic DNS (DDNS)**: Automated periodic IP updates for DuckDNS, No-IP, and DynDNS webhooks.
- **Live Connection Inspector & Audit Logs**: Real-time connected clients table displaying IP, User-Agent, active path, speed, and one-click socket disconnect. Full audit logs tracking all client actions.
- **Security & Firewall**: IP allowlist and blocklist masks (wildcards & CIDR notation) with anti-brute force temporary lockout.
- **Users & Permissions**: Role-based access control (Admin, User, Guest), per-user permissions, and password-protected folders.
- **Share Links**: Secure tokenized sharing links with expiration, maximum download limits, 1-click LAN copy links, and QR code sharing.
- **Reminder Integration**: Attach files from your file server directly to reminders.

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

- Installed: `%APPDATA%\Smaran\config.json` (reminders, automations and settings; 5 rolling backups in `backups\`)
  and `history.json` (the last 1,000 events).
- Portable: `SmaranData\` next to the exe when that folder is writable, otherwise `%APPDATA%\Smaran`.
- Uninstalling removes the start-at-login entry and asks whether to delete the data folder.

## Code layout

```text
src/shared/    schema (zod), defaults, nextFireAt, time windows, quickParse, ruleSummary, IPC types
src/shared/legacy/  the 2.0 schema, kept only to upgrade old files
src/main/      SmaranApp (wiring), engine/Engine (what to show and when), automations/
               (AutomationEngine, actions, browser detection), store/ (ConfigStore,
               HistoryStore, migrations, backup), windows/ (AppWindow, NotificationCenter, placement),
               tray/, system/, ipc/
src/preload/   app.ts and notification.ts: the only bridge (sandboxed, contextIsolation on)
src/renderer/  app/ (Today, Reminders, Automations, History, Settings), notification/ (the card), theme.css
tests/         unit/ (Vitest), e2e/ (Playwright + Electron), smoke/ (packaged build), fixtures/
```

## Licenses

Smaran installs and opens only with a valid license image (see `src/shared/license/core.ts` for
the format: an Ed25519-signed payload hidden in a PNG's pixel low bits; JPGs carry it in a
comment segment). The app checks it offline with the public key in
`src/shared/license/publicKey.ts` and keeps the verified license in `license.json` in the data
folder.

| Command                                              | What it does                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run license:keygen`                             | Make the signing key (once) in `%USERPROFILE%\.smaran-license`, and write the public key into the app |
| `npm run license:sign -- --name "Asha Rao" --years 2` | Issue a license PNG from the command line                          |
| `npm run license:core`                               | Re-bundle the format for the Register page and the signing script after changing `core.ts` |

The plain private key never goes in this repository or on the website. `npm run
license:seal-key` locks it with a passphrase (PBKDF2-SHA256, 600,000 iterations, then
AES-256-GCM) into `site/Register/key.enc.json`; the unlisted `/Register/` page unlocks it in the
browser with that passphrase and signs there. The locked file is public, so use a long passphrase
and re-seal with a new one if someone who knew it shouldn't issue licenses any more. Back the key up; whoever has
it can issue licenses. Development runs may skip the check with `SMARAN_LICENSE_CHECK=off`;
packaged builds never can. Offline licensing deters copying but can't make it impossible.

## Signing

Builds are unsigned, so SmartScreen warns on first run. To sign, add a certificate to
`electron-builder.yml` (`win.signtoolOptions`) or use Azure Trusted Signing.
