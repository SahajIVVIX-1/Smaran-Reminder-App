# System Settings Specification

The **System Settings** tab configures the operating system integration, theme, window behavior, desktop notification appearance, Attention Motion, screen border lighting, and diagnostics.

---

## 1. Application Startup & System Tray

| Setting | Key | Type | Default | Detailed Description |
|---|---|---|---|---|
| **Start with Windows** | `settings.startAtLogin` | `boolean` | `true` | Automatically launches Smaran when the user logs in to Windows. Managed in `src/main/system/startup.ts` via Windows Registry key `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\Smaran`. |
| **Minimize to Tray** | `settings.minimizeToTray` | `boolean` | `true` | Closing the main application window minimizes it to the Windows notification tray instead of quitting the application. |
| **Complete Tray Exit** | N/A (Tray action) | Action | N/A | Clicking "Quit Smaran" from the tray triggers a complete, immediate termination: destroys all notification windows, forcefully kills the HFS sidecar tree (`taskkill /F /T /PID`), suppresses exit popups, and exits with code 0. |

---

## 2. Appearance & Theme

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Theme** | `settings.theme` | `enum` | `'system'` | `'system'`, `'light'`, `'dark'` | Controls UI theme styling. In `'system'` mode, listens to Windows dark/light OS mode via `nativeTheme.shouldUseDarkColors`. In `'dark'` mode, applies Obsidian theme (`#0d0d11` background, `#16161f` cards, `#f5f4ef` text, `#e06c43` accent). |
| **Font Family** | `settings.font` | `string` | `'Anthropic Serif'` | Any installed font or bundled serif/sans | Global font used across the entire application interface, notifications, and modals. |
| **Vector Dots Titlebar Art** | `settings.logo.animate` | `boolean` | `true` | `true`, `false` | Enables 60fps vector dots choreography on the window titlebar. |
| **Vector Dots Mode** | `settings.logo.mode` | `enum` | `'auto'` | `'auto'`, `'scene'` | `'auto'` dynamically transitions through shapes; `'scene'` locks to one specific chosen animation choreography. |
| **Liquid Merge** | `settings.logo.liquid` | `boolean` | `true` | `true`, `false` | Enables organic liquid smoothing when adjacent vector dots touch. |
| **Tray Icon Animation** | `settings.logo.tray.animate` | `boolean` | `true` | `true`, `false` | Renders dynamic vector dot frames directly into the Windows taskbar tray icon. |

---

## 3. Desktop Notification Appearance & Screen Placement

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Screen Placement** | `settings.notification.screen` | `enum` | `'primary'` | `'primary'`, `'cursor'` | `'primary'` always displays notification cards on the primary monitor. `'cursor'` dynamically routes notification windows to the monitor where the user's cursor currently resides. |
| **Corner Placement** | `settings.notification.corner` | `enum` | `'top-right'` | `'top-right'`, `'bottom-right'`, `'top-left'`, `'bottom-left'`, `'top-center'` | Specifies the screen anchor point where notifications stack. |
| **Size Preset** | `settings.notification.size` | `enum` | `'comfortable'` | `'compact'` (308px), `'comfortable'` (340px), `'large'` (384px) | Default horizontal width preset for notification cards. |
| **Custom Width** | `settings.notification.card.width` | `number \| null` | `null` (auto) | `200` to `560` px | Custom pixel width overriding standard size presets. |
| **Custom Height** | `settings.notification.card.height`| `number \| null` | `null` (auto) | `30` to `200` px | Custom minimum pixel height. |
| **Border Radius** | `settings.notification.card.radius`| `number \| null` | `18` px | `0` to `32` px | Custom corner curvature for notification cards. |
| **Card Padding** | `settings.notification.card.padding`| `number \| null`| `12` px | `4` to `28` px | Internal whitespace padding inside notification cards. |
| **Notification Sound**| `settings.notification.sound` | `boolean` | `true` | `true`, `false` | Master audio chime toggle played on notification arrival. |

---

## 4. Attention Motion System

The Attention Motion system introduces eye-catching ambient movements to ensure critical notifications are noticed.

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Attention Motion Toggle** | `settings.notification.motion.enabled` | `boolean` | `false` | `true`, `false` | **OFF by default** (v3.4.1+). Motion styles and configurations only appear in the UI when this toggle is switched ON. |
| **Motion Type** | `settings.notification.motion.type` | `enum` | `'fade-cycle'` | `'fade-cycle'`, `'bounce'`, `'pulse'`, `'wiggle'`, `'slide'` | Motion choreography style applied to visible notification cards. |
| **Fade Cycle - Visible Time** | `motion.fadeCycle.visibleSec` | `number` | `3` sec | `1` to `60` sec | Duration the card remains fully opaque before cycling. |
| **Fade Cycle - Fade Time** | `motion.fadeCycle.fadeSec` | `number` | `0.6` sec | `0.2` to `5` sec | Duration of the subtle opacity dip transition. |
| **Fade Cycle - Min Opacity**| `motion.fadeCycle.minOpacity` | `number` | `0.1` | `0.0` to `0.6` | Minimum opacity level during cycle. |
| **Bounce Energy** | `motion.bounce.energy` | `enum` | `'medium'` | `'gentle'`, `'medium'`, `'energetic'` | Spring tension and amplitude for vertical bouncing. |
| **Pulse Speed** | `motion.pulse.speed` | `enum` | `'balanced'` | `'calm'`, `'balanced'`, `'rapid'` | Frequency of card breathing and border glow pulsation. |
| **Wiggle Interval** | `motion.wiggle.intervalSec` | `number` | `3` sec | `1` to `10` sec | Seconds between subtle horizontal wiggle movements. |

---

## 5. Screen Border Illumination System

Smaran features an ambient screen border illumination window that projects a smooth light beam around the screen perimeter while notifications or automations are active.

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Screen Border Light** | `settings.notification.borderLight` | `boolean` | `true` | `true`, `false` | Master toggle for the screen perimeter glow window. |
| **Border Thickness** | `settings.notification.borderLightThickness` | `number` | `4` px | `1` to `24` px | Width of the perimeter beam in pixels. |
| **Border Brightness** | `settings.notification.borderLightBrightness` | `number` | `150` % | `50` to `200` % | Intensity and bloom opacity of the illumination beam. |

---

## 6. Data Storage, Backup & Diagnostics

- **Open Storage Folder:** Directly launches `%APPDATA%\Smaran\` in Windows Explorer via `IPC.appOpenDataFolder`.
- **Export Backup:** Creates an export archive (`.smaran-backup`) containing all reminders, automations, server settings, and historical logs.
- **Import Backup:** Reads and validates an external archive through `ConfigSchema.safeParse()`, safely migrating older backup files if required.
- **Diagnostics & Error Logs:** Main process outputs structured diagnostic logs with timestamps to stdout and `%APPDATA%\Smaran\logs\`.
