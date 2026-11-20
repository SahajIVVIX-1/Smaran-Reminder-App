# Store, Persistence & Migration Engine

## 1. Storage Location & File Hierarchy

All application state is saved under the user profile directory:
- **Default Windows Path:** `%APPDATA%\Smaran\` (e.g. `C:\Users\<User>\AppData\Roaming\Smaran\`)
- **Key Storage Files:**
  - `config.json`: Master configuration containing settings, reminders, automations, and runtime scheduling state.
  - `history.json`: Circular event log recording up to 1,000 recent events (done, missed, snoozed, skipped, automation runs, server logins).
  - `fileserver-settings.json`: HFS server configuration (port, root directory, security toggles).
  - `fileserver-audit.json`: Persistent security audit log recording login successes, failures, and admin actions.
  - `license.json`: Hardware-bound license key and activation tokens.
  - `hfs-engine/`: Extracted HFS 3.4.1 sidecar engine directory containing Node.js source, plugins, and custom templates.

---

## 2. Atomic Disk Writing & Crash Safety

To ensure zero file corruption from unexpected power loss or crashes, `src/main/store.ts` implements atomic file writing:
1. Data is validated against Zod schemas (`ConfigSchema`, `HistorySchema`).
2. Serialized JSON is written to a temporary staging file: `config.json.tmp.<pid>`.
3. The staging file is flushed to physical storage using `fs.fsyncSync()`.
4. The atomic rename `fs.renameSync(tmpPath, targetPath)` replaces the existing `config.json`.
5. An automatic fallback backup copy (`config.json.bak`) is updated on each successful cycle.
6. If `config.json` fails JSON parsing on startup, the engine automatically rolls back to `config.json.bak`.

---

## 3. Configuration Schema & Migration Pipeline

Smaran features an automated backward-compatible migration pipeline (`SCHEMA_VERSION = 6`):

```
v1 (Python Smaran)
   │
   ▼
v2 (Smaran 2.1 – Unified Reminders)
   │
   ▼
v3 (Smaran 2.2 – Per-reminder Sounds & Defaults)
   │
   ▼
v4 (Smaran 2.8 – Anthropic Sans Font Integration)
   │
   ▼
v5 (Smaran 2.13 – Anthropic Serif Default)
   │
   ▼
v6 (Smaran 2.14 through 3.4.3 – Automations, File Server, Expanded Desktop Notifications)
```

### Migration History Details

#### v1 -> v2 (Python to Electron Architecture)
- Reads legacy Python config files (`settings.json`, `reminders.json`).
- Converts schedule tuples into `Rule` objects (`interval`, `daily`, `weekly`, etc.).
- Preserves reminder message strings into `rotatingLines`.

#### v2 -> v3
- Added per-reminder sound customization (`default`, `on`, `off`).
- Introduced card shape presets (`compact`, `comfortable`, `large`) and custom dimensions.

#### v3 -> v4 & v5
- Default font family updated to high-legibility typography (`Anthropic Serif` / `Inter`).

#### v5 -> v6 (Current Schema)
- Introduced `automations` array and `automation` settings block (`DEFAULT_AUTOMATION_SETTINGS`).
- Added Attention Motion engine settings (`DEFAULT_NOTIFICATION_MOTION` with `fade-cycle`, `bounce`, `pulse`, `wiggle`, `slide`).
- Added Screen Border light controls (`borderLight`, `borderLightThickness`, `borderLightBrightness`).
- Added File Server settings integration.

---

## 4. Backup & Restore Specification

Smaran includes full backup export and import:
- **Export Format:** `.smaran-backup` (JSON format containing version, timestamp, configuration, reminder definitions, automation rules, and history).
- **Import Validation:** Validates the backup file through `ConfigSchema.safeParse()`. If valid, atomically merges or replaces existing schedules, prompts the user to reload, and recalculates all upcoming timer interrupts without requiring an app restart.
