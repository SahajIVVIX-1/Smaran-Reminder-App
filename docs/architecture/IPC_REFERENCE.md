# IPC Protocol & Channel Reference

All inter-process communication (IPC) in Smaran is strictly typed and routed through `src/shared/channels.ts` and registered via `src/main/ipc.ts`.

---

## 1. Core Application & Configuration Channels

| Channel (`IPC.*`) | Direction | Payload Schema | Return Type | Description |
|---|---|---|---|---|
| `configGet` (`config:get`) | Invoke (R -> M) | `void` | `Config` | Fetches the complete runtime configuration and state tree. |
| `configSave` (`config:save`) | Invoke (R -> M) | `Config` | `{ ok: boolean }` | Validates with `ConfigSchema` and atomically saves configuration to disk. |
| `configChanged` (`config:changed`) | Broadcast (M -> R) | `Config` | `void` | Emitted when config is modified by the engine or another window. |
| `historyGet` (`history:get`) | Invoke (R -> M) | `void` | `HistoryEntry[]` | Retrieves the history event log (up to 1,000 entries). |
| `historyClear` (`history:clear`) | Invoke (R -> M) | `void` | `void` | Clears all history entries. |
| `historyChanged` (`history:changed`) | Broadcast (M -> R) | `HistoryEntry[]` | `void` | Emitted when a new reminder, automation, or server event is logged. |
| `appPause` (`app:pause`) | Invoke (R -> M) | `until: string \| null` | `void` | Pauses reminders until a specific ISO timestamp or indefinitely (`null`). |
| `appResume` (`app:resume`) | Invoke (R -> M) | `void` | `void` | Resumes reminder scheduling immediately. |
| `appInfo` (`app:info`) | Invoke (R -> M) | `void` | `{ version: string; isPackaged: boolean; platform: string }` | Returns application runtime metadata. |
| `appOpenDataFolder` (`app:openDataFolder`) | Invoke (R -> M) | `void` | `void` | Opens the user data storage folder in Windows Explorer. |
| `appTheme` (`app:theme`) | Invoke (R -> M) | `theme: 'system' \| 'light' \| 'dark'` | `void` | Changes application theme and broadcasts native updates. |
| `backupExport` (`backup:export`) | Invoke (R -> M) | `void` | `{ ok: boolean; path?: string }` | Exports encrypted/compressed backup archive of settings and reminders. |
| `backupImport` (`backup:import`) | Invoke (R -> M) | `void` | `{ ok: boolean; error?: string }` | Prompts for backup file and restores settings with validation. |
| `fontsList` (`fonts:list`) | Invoke (R -> M) | `void` | `string[]` | Lists installed Windows system fonts available for UI rendering. |
| `fontsAdd` (`fonts:add`) | Invoke (R -> M) | `fontPath: string` | `{ ok: boolean }` | Adds a custom font file for typography customization. |
| `navigate` (`app:navigate`) | Broadcast (M -> R) | `tab: string` | `void` | Instructs the main application window to navigate to a specific tab. |

---

## 2. Reminder & Engine Channels

| Channel (`IPC.*`) | Direction | Payload Schema | Return Type | Description |
|---|---|---|---|---|
| `nextTimes` (`engine:next`) | Invoke (R -> M) | `void` | `Record<string, string \| null>` | Returns next scheduled fire timestamps for all reminders. |
| `showNow` (`engine:showNow`) | Invoke (R -> M) | `reminderId: string` | `void` | Triggers immediate display of a reminder card for testing/preview. |
| `notifyTest` (`notify:test`) | Invoke (R -> M) | `void` | `void` | Displays a test notification card with sample affirmative text. |

---

## 3. Desktop Notification Window Channels

| Channel (`IPC.*`) | Direction | Payload Schema | Return Type | Description |
|---|---|---|---|---|
| `notifInit` (`notif:init`) | Invoke (R -> M) | `windowId: number` | `NotificationInitData` | Provides card data, shape, animations, and theme to notification window. |
| `notifMeasured` (`notif:measured`) | Send (R -> M) | `{ height: number; width: number }` | `void` | Informs main process of DOM dimensions for coordinate positioning. |
| `notifShown` (`notif:shown`) | Send (R -> M) | `void` | `void` | Signals that entrance animation has finished and countdown has started. |
| `notifAction` (`notif:action`) | Send (R -> M) | `action: 'done' \| 'snooze' \| 'dismiss' \| 'custom', snoozeMin?: number` | `void` | User interacted with notification card buttons. |
| `notifClose` (`notif:close`) | Send (R -> M) | `void` | `void` | Notification window requests immediate closing. |
| `notifDone` (`notif:done`) | Send (R -> M) | `reminderId: string` | `void` | Marks reminder completed / done. |
| `notifInteractive` (`notif:interactive`) | Send (R -> M) | `isInteractive: boolean` | `void` | Hover state changed; pauses or resumes auto-hide countdown. |
| `notifShape` (`notif:shape`) | Broadcast (M -> R) | `CardShape` | `void` | Broadcasts real-time card geometry tweaks from Settings preview. |
| `notifUnhover` (`notif:unhover`) | Broadcast (M -> R) | `void` | `void` | Informs notification renderer that cursor has exited the screen area. |

---

## 4. Automation Channels

| Channel (`IPC.*`) | Direction | Payload Schema | Return Type | Description |
|---|---|---|---|---|
| `automationsNext` (`automations:next`) | Invoke (R -> M) | `void` | `Record<string, string \| null>` | Computes upcoming schedule timestamps for active automations. |
| `automationsRun` (`automations:run`) | Invoke (R -> M) | `automationId: string` | `{ ok: boolean; error?: string }` | Manually executes an automation rule immediately. |
| `automationsCancel` (`automations:cancel`) | Invoke (R -> M) | `automationId: string` | `void` | Cancels a pending pre-execution countdown or active execution step. |
| `automationsRuns` (`automations:runs`) | Invoke (R -> M) | `void` | `AutomationRun[]` | Returns historical execution runs and statuses. |
| `automationsRunsChanged` (`automations:runsChanged`) | Broadcast (M -> R) | `AutomationRun[]` | `void` | Broadcasts execution outcome updates to Automations UI. |
| `automationsBrowsers` (`automations:browsers`) | Invoke (R -> M) | `void` | `BrowserInfo[]` | Detects installed web browsers for URL opening actions. |
| `automationsPick` (`automations:pick`) | Invoke (R -> M) | `kind: 'app' \| 'file' \| 'script'` | `string \| null` | Opens native Windows file dialog to choose executable/script path. |

---

## 5. File Server (Smaran HFS) Channels

| Channel (`IPC.*`) | Direction | Payload Schema | Return Type | Description |
|---|---|---|---|---|
| `fileserverStatus` (`fileserver:status`) | Invoke (R -> M) | `void` | `ServerStatus` | Returns state, running port, LAN URLs, and connection counts. |
| `fileserverStart` (`fileserver:start`) | Invoke (R -> M) | `void` | `{ ok: boolean; error?: string }` | Starts the HFS sidecar process and binds the network port. |
| `fileserverStop` (`fileserver:stop`) | Invoke (R -> M) | `void` | `{ ok: boolean; error?: string }` | Gracefully stops the file server engine. |
| `fileserverRestart` (`fileserver:restart`) | Invoke (R -> M) | `void` | `{ ok: boolean; error?: string }` | Restarts the engine to reload configuration changes. |
| `fileserverSettingsGet` (`fileserver:settings:get`) | Invoke (R -> M) | `void` | `FileServerSettings` | Retrieves persistent file server settings. |
| `fileserverSettingsSave` (`fileserver:settings:save`) | Invoke (R -> M) | `FileServerSettings` | `{ ok: boolean }` | Validates and persists file server settings to disk. |
| `fileserverPickRootDir` (`fileserver:pickRootDir`) | Invoke (R -> M) | `void` | `string \| null` | Opens directory picker to select root shared folder. |
| `fileserverOpenFolder` (`fileserver:fs:openFolder`) | Invoke (R -> M) | `path: string` | `void` | Opens local directory in Windows Explorer. |
| `fileserverLogsGet` (`fileserver:logs:get`) | Invoke (R -> M) | `void` | `ServerLogEntry[]` | Fetches server log entries. |
| `fileserverLogsClear` (`fileserver:logs:clear`) | Invoke (R -> M) | `void` | `void` | Clears stored server logs. |
| `fileserverQrGenerate` (`fileserver:qr:generate`) | Invoke (R -> M) | `text: string` | `string` | Generates a base64 Data URL QR code for mobile connection. |
| `fileserverMountDrive` (`fileserver:mount:drive`) | Invoke (R -> M) | `payload?: { letter?: string }` | `{ ok: boolean; error?: string }` | Mounts Smaran WebDAV as a native Windows drive (`Z:`). |
| `fileserverUnmountDrive` (`fileserver:unmount:drive`) | Invoke (R -> M) | `letter?: string` | `{ ok: boolean; error?: string }` | Unmounts the Windows network drive letter cleanly. |
| `fileserverExportMountScript` (`fileserver:exportMountScript`) | Invoke (R -> M) | `void` | `{ ok: boolean; filePath?: string; error?: string }` | Exports standalone `.bat` script for other LAN PCs to mount Drive `Z:`. |
| `fileserverStatusChanged` (`fileserver:event:statusChanged`) | Broadcast (M -> R) | `ServerStatus` | `void` | Broadcasts live server state changes (starting, running, stopped, port). |
| `fileserverLogAdded` (`fileserver:event:logAdded`) | Broadcast (M -> R) | `ServerLogEntry` | `void` | Emits newly generated server stdout/stderr logs. |
| `fileserverSessionsGet` (`fileserver:sessions:get`) | Invoke (R -> M) | `void` | `ActiveSession[]` | Returns active connected clients and transfer speeds. |
| `fileserverSessionDisconnect` (`fileserver:session:disconnect`) | Invoke (R -> M) | `sessionId: string` | `void` | Drops an active client connection. |

---

## 6. Licensing & Setup Channels

| Channel (`IPC.*`) | Direction | Payload Schema | Return Type | Description |
|---|---|---|---|---|
| `licenseGet` (`license:get`) | Invoke (R -> M) | `void` | `LicenseInfo` | Checks license validity, expiry, and machine fingerprint. |
| `licenseImport` (`license:import`) | Invoke (R -> M) | `void` | `{ ok: boolean; error?: string }` | Prompts user to select license file (`.smaranlic`). |
| `licenseActivate` (`license:activate`) | Invoke (R -> M) | `licenseKey: string` | `{ ok: boolean; error?: string }` | Validates Ed25519 signature against public key and machine ID. |
| `licenseChanged` (`license:changed`) | Broadcast (M -> R) | `LicenseInfo` | `void` | Broadcasts licensing state changes across all windows. |
| `licenseQuit` (`license:quit`) | Invoke (R -> M) | `void` | `void` | Exits the application when activation is rejected. |
| `setupInit` (`setup:init`) | Invoke (R -> M) | `void` | `SetupInfo` | Initializes setup wizard information. |
| `setupStart` (`setup:start`) | Invoke (R -> M) | `SetupConfig` | `void` | Initiates installation or portable unpacking workflow. |
| `setupProgress` (`setup:progress`) | Broadcast (M -> R) | `ProgressData` | `void` | Streams file extraction percentage and tasks to setup UI. |
