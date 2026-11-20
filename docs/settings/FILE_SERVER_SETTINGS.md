# File Server (Smaran HFS) Settings & Network Suite

The **File Server Settings** tab configures the bundled HTTP file server and WebDAV engine (`HFS 3.4.1`), ports, root directories, authentication credentials, network mounting, and security alerts.

---

## 1. Core Server Settings

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Server Master Toggle** | `settings.enabled` | `boolean` | `false` | `true`, `false` | Master enable toggle for the file server subsystem. |
| **Server Port** | `settings.port` | `number` | `5901` | `1024` to `65535` | The TCP network port used for both HTTP web access and WebDAV network drive access. |
| **Auto-Start Server** | `settings.autoStart` | `boolean` | `false` | `true`, `false` | **OFF by default** (v3.4.1+). When enabled, the HFS server starts automatically upon application launch. When disabled, the server only starts when explicitly requested. |
| **Auto-Open Admin Panel** | `settings.autoOpenAdminOnStart` | `boolean` | `false` | `true`, `false` | Automatically opens the browser to `http://localhost:<port>/~/admin/` when the server starts. |
| **Root Shared Directory** | `settings.rootDir` | `string` | `''` (user home) | Absolute path | The physical Windows folder mapped to the root `/` virtual file path of the server. |
| **Admin Username** | `settings.adminUsername` | `string` | `'admin'` | String | Master administrative account name for HFS web console management. |
| **Admin Password** | `settings.adminPassword` | `string` | Dynamically generated | String | Master password for administrator access. Enforced minimum 4 characters by `password-rules` plugin. |

---

## 2. Security Alerts & Audit Settings

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Notify on Login** | `settings.notifyOnLogin` | `boolean` | `true` | `true`, `false` | Displays a desktop notification whenever a client or administrator successfully authenticates to the server. |
| **Notify on Failed Login** | `settings.notifyOnFailedLogin` | `boolean` | `true` | `true`, `false` | Displays an expanded security alert notification on failed password attempts, tracking client IP and attempt counts. |
| **Notify on Admin Activity** | `settings.notifyOnAdminActivity` | `boolean` | `true` | `true`, `false` | Displays an alert when administrative changes occur (e.g. port modifications, folder permission adjustments, user additions). |

---

## 3. WebDAV Network Drive Suite (Drive `Z:`)

Smaran includes native Windows WebDAV drive mapping so users can access files directly in Windows Explorer as a physical hard drive:
1. **1-Click Local Mount (`IPC.fileserverMountDrive`):**
   - Mounts `http://127.0.0.1:<port>/` to drive letter `Z:` using Windows `net use Z: http://127.0.0.1:<port>/ /persistent:no`.
   - Checks and activates the Windows `WebClient` service automatically.
   - Verifies verified drive connectivity using `fs.existsSync('Z:\\')`.
2. **1-Click Unmount (`IPC.fileserverUnmountDrive`):**
   - Unmounts drive `Z:` using `net use Z: /delete /yes`.
3. **Standalone Export Script (`IPC.fileserverExportMountScript`):**
   - Generates and exports a standalone batch script (`mount-smaran-drive.bat`) containing automatic registry adjustments (`BasicAuthLevel = 2`) and `net use` instructions so any computer on the local network can mount the Smaran server as Drive `Z:`.

---

## 4. Windows Explorer Context Menu ("Add to Smaran HFS")

Smaran registers a Windows shell context menu for files and folders:
- **Label:** `Add to Smaran HFS` (updated from legacy `Add to HFS (new)`).
- **Icon:** Custom multi-resolution Smaran icon (`icon.ico`, 16x16 up to 256x256).
- **Registry Keys:**
  - `HKCU\Software\Classes\*\shell\AddToHFS3`
  - `HKCU\Software\Classes\Directory\shell\AddToHFS3`
- **Behavior:** Clicking the right-click option immediately mounts the selected file or directory into the active HFS Virtual File System (VFS) without copying files.

---

## 5. Client Web Interface Customization

The client web interface accessible via browser or mobile is injected with Smaran's obsidian atmosphere:
- **Obsidian Dark Aesthetic:** High-contrast dark cards (`#1c1c24`), clean fonts, and emerald/salmon status badges.
- **Responsive Tablet/Mobile Hiding:** At `@media (max-width: 1024px)`, the desktop WebDAV mount widget is hidden to ensure a clean mobile viewing experience.
- **Center Watermark:** Ambient high-resolution Smaran vector watermark logo rendered at `opacity: 0.09` with radial lighting.
