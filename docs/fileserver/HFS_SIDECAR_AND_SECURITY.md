# HFS Sidecar Engine, Security Plugins & WebDAV

## 1. HFS 3.4.1 Sidecar Engine Architecture

Smaran packages a self-contained Node.js HTTP File Server (based on HFS 3.4.1) in `resources/engine.tar.gz`.

### Process Supervisor (`HfsProcessSupervisor.ts`)
- **Extraction & Verification:** On first run or version change, Smaran extracts `engine.tar.gz` into `%APPDATA%\Smaran\hfs-engine\`.
- **Root Directory Flattening:** Detects and flattens nested folder structures so `src/index.js`, `package.json`, and `central.json` reside directly at the runtime root.
- **Port Conflict Resolution:** Scans and verifies TCP port availability (`port: 5901`). If occupied, reports clear diagnostics without crashing the application.
- **Child Process Management:** Spawns `node src/index.js` using Node child process APIs. Keeps child alive, monitors heartbeat, and captures stdout/stderr in memory.

---

## 2. Zero-Trust Configuration Bridge (`HfsConfigBridge.ts`)

Instead of storing unencrypted passwords or relying on unsafe default HFS accounts:
- Generates `config.yaml` with `localhost_admin: false` (disables open unauthenticated localhost access).
- Configures dynamic internal session tokens.
- Bundles 20 default plugins:
  - `antibrute` (rate limiting and IP banning after repeated failed attempts)
  - `download-counter`
  - `server-info`
  - `list-uploader`
  - `share-links`
  - `sharp` (high-performance image processing)
  - `thumbnails` (dynamic video and image thumbnail caching)
  - `chat-plus`
  - `auto-refresh`
  - `password-rules` (enforces 4+ character passwords)
  - `video-player` & `mini-player`
  - `url-shortener`
  - `show-any`
  - `tls-tunnel`
  - `trashbin` (moves deleted files to safe trash rather than permanent deletion)
  - `copy-files`
  - `Hide-file`
  - `shared`
  - `smaran-security` (v3.4 security and activity audit monitor)

---

## 3. The `smaran-security` Plugin (v3.4)

The custom bridge plugin (`resources/engine/dist/plugins/smaran-security/plugin.js`) monitors engine security events:

```javascript
exports.version = 3.4;
exports.description = "Smaran security monitor — monitors login events, failed authentication attempts, and user activity for desktop notifications.";
exports.apiRequired = 1;

exports.init = (api) => {
  function emit(type, data) {
    console.log(`[SMARAN_SECURITY_EVENT] ${JSON.stringify({ type, ...data, timestamp: new Date().toISOString() })}`);
  }
  api.events.multi({
    login(ctx) { ... },
    failedLogin({ ctx, username, via }) { ... },
    logout(ctx) { ... }
  });
};
```

### Event Parsing & IP Geolocation Classification
The supervisor parses every stdout line for `[SMARAN_SECURITY_EVENT]`:
1. **IP Normalization:** Normalizes `::ffff:192.168.1.5` -> `192.168.1.5`.
2. **Access Classification:** Identifies whether the client is local/LAN (`127.0.0.1`, `10.*.*.*`, `172.16-31.*.*`, `192.168.*.*`) or `External`.
3. **Repeat Attempt Tracking:** Aggregates rapid consecutive failed attempts from the same IP address (`repeatCount`) to detect brute-force attacks.
4. **Desktop Security Notification:** Triggers an expanded desktop security alert card on failed logins and logs the event in `fileserver-audit.json`.

---

## 4. WebDAV Drive Mounting Suite

- **Windows WebClient Service:** Automatically checks and enables the `WebClient` Windows service (`sc config WebClient start= auto && net start WebClient`).
- **Basic Auth Compatibility:** Ensures `HKLM\SYSTEM\CurrentControlSet\Services\WebClient\Parameters\BasicAuthLevel = 2` is configured so Windows Explorer allows authentication to local IP servers.
- **Drive Mapping:** Maps `http://127.0.0.1:5901/` to Drive `Z:`.
- **Export Script Generator:** Generates a portable `.bat` script that other PCs on the network can run as Administrator to connect to Smaran HFS with one click.
