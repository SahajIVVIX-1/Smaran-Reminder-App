import fs from 'node:fs';
import yaml from 'yaml';
import type { FileServerSettings, UserAccount, VfsNode } from '@shared/fileserver';

export interface GenerateConfigOptions {
  settings: FileServerSettings;
  users?: UserAccount[];
  vfs?: VfsNode[];
  internalToken?: string;
  adminPassword?: string;
}

export const DEFAULT_PLUGINS = [
  'antibrute',
  'download-counter',
  'server-info',
  'list-uploader',
  'share-links',
  'sharp',
  'thumbnails',
  'chat-plus',
  'auto-refresh',
  'password-rules',
  'video-player',
  'mini-player',
  'url-shortener',
  'show-any',
  'tls-tunnel',
  'trashbin',
  'copy-files',
  'Hide-file',
  'shared',
];

export const DEFAULT_PLUGINS_CONFIG = {
  'share-links': {
    onlyFor: ['smaran'],
  },
  thumbnails: {
    log: true,
    videos: true,
  },
  'chat-plus': {
    anonWrite: true,
    anonRead: true,
  },
  'password-rules': {
    minLength: 4,
  },
  'url-shortener': {
    linkPrefix: '/smaran',
    managementAPI: true,
    linkSlashAllowed: true,
    linkEditAllowed: true,
  },
  'copy-files': {
    onlyFor: ['admistrators', 'smaran'],
  },
  'Hide-file': {
    hideFiles: '',
    hideExactFiles: '',
    hideFolders: '',
  },
  trashbin: {
    trashbin_verboseLogging: true,
  },
};

export const DEFAULT_CUSTOM_HTML = `[403]
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>403 Forbidden - Smaran HFS</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0d0d11;
      color: #f5f4ef;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      position: relative;
      overflow-x: hidden;
    }
    body::before {
      content: "";
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      height: 520px;
      background: radial-gradient(circle, rgba(224, 108, 67, 0.14) 0%, rgba(13, 13, 17, 0) 70%);
      pointer-events: none;
      z-index: 0;
    }
    .card {
      position: relative;
      z-index: 1;
      background: rgba(22, 22, 28, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 20px;
      max-width: 480px;
      width: 100%;
      padding: 2.5rem 2rem;
      text-align: center;
      box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(224, 108, 67, 0.12);
    }
    .logo-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 68px;
      height: 68px;
      border-radius: 18px;
      background: rgba(224, 108, 67, 0.12);
      border: 1px solid rgba(224, 108, 67, 0.3);
      margin-bottom: 1.5rem;
      box-shadow: 0 8px 16px -4px rgba(224, 108, 67, 0.2);
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #e06c43;
      background: rgba(224, 108, 67, 0.15);
      border: 1px solid rgba(224, 108, 67, 0.3);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 0.75rem;
    }
    p {
      color: #9c9ca4;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.25rem;
      font-size: 0.9rem;
      font-weight: 600;
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: #e06c43;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(224, 108, 67, 0.35);
    }
    .btn-primary:hover {
      background: #ea7a53;
      box-shadow: 0 6px 18px rgba(224, 108, 67, 0.45);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #e4e4e7;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.09);
      color: #ffffff;
    }
    .footer {
      margin-top: 2rem;
      font-size: 0.8rem;
      color: #63636e;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
        <g transform="translate(32 32) scale(1.12) translate(-32 -32)">
          <path d="M32 32L30.91 31.93L29.82 31.76L28.77 31.47L27.74 31.07L26.77 30.56L25.86 29.94L25.02 29.24L24.26 28.45L23.58 27.58L23.01 26.64L22.54 25.65L22.18 24.61L21.92 23.54L21.8 22.45L21.78 21.35L21.89 20.26L22.1 19.18L22.43 18.14L22.88 17.13L23.43 16.18L24.08 15.29L24.81 14.48L25.64 13.75L26.53 13.12L27.49 12.58L28.5 12.14L29.55 11.83L30.63 11.63L31.73 11.54L32.82 11.56L33.91 11.71L34.98 11.98L36.01 12.35L37 12.83L37.93 13.42L38.78 14.11L39.56 14.88L40.26 15.73L40.87 16.65" stroke="#f5f4ef" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M23.15 47.32L23.76 48.24L24.45 49.09L25.23 49.87L26.08 50.56L27.01 51.14L28 51.63L29.03 52L30.09 52.27L31.18 52.42L32.27 52.45L33.37 52.36L34.45 52.16L35.5 51.85L36.51 51.41L37.46 50.88L38.36 50.24L39.19 49.52L39.92 48.71L40.57 47.82L41.12 46.87L41.57 45.86L41.9 44.82L42.12 43.74L42.22 42.65L42.21 41.55L42.08 40.46L41.83 39.39L41.46 38.35L40.99 37.36L40.42 36.42L39.75 35.56L38.99 34.77L38.14 34.06L37.23 33.45L36.26 32.93L35.24 32.53L34.18 32.24L33.1 32.07L32 32" stroke="#f5f4ef" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M50.1 13.9h0.01" stroke="#e06c43" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>
    </div>
    <div class="badge">HTTP 403 · Access Forbidden</div>
    <h1>Access Forbidden</h1>
    <p>You do not have permission to access this resource or directory. Please sign in with an authorized account or contact your administrator.</p>
    <div class="actions">
      <a href="$URL" class="btn btn-primary">Return to Files ($HOME)</a>
      <a href="$URL~/admin/" class="btn btn-secondary">Sign In / Admin Panel</a>
    </div>
  </div>
  <div class="footer">Smaran HFS · Secure Local File Server</div>
</body>
</html>

[404]
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 Not Found - Smaran HFS</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0d0d11;
      color: #f5f4ef;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      position: relative;
      overflow-x: hidden;
    }
    body::before {
      content: "";
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      height: 520px;
      background: radial-gradient(circle, rgba(224, 108, 67, 0.14) 0%, rgba(13, 13, 17, 0) 70%);
      pointer-events: none;
      z-index: 0;
    }
    .card {
      position: relative;
      z-index: 1;
      background: rgba(22, 22, 28, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 20px;
      max-width: 480px;
      width: 100%;
      padding: 2.5rem 2rem;
      text-align: center;
      box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(224, 108, 67, 0.12);
    }
    .logo-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 68px;
      height: 68px;
      border-radius: 18px;
      background: rgba(224, 108, 67, 0.12);
      border: 1px solid rgba(224, 108, 67, 0.3);
      margin-bottom: 1.5rem;
      box-shadow: 0 8px 16px -4px rgba(224, 108, 67, 0.2);
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #e06c43;
      background: rgba(224, 108, 67, 0.15);
      border: 1px solid rgba(224, 108, 67, 0.3);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 0.75rem;
    }
    p {
      color: #9c9ca4;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.25rem;
      font-size: 0.9rem;
      font-weight: 600;
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: #e06c43;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(224, 108, 67, 0.35);
    }
    .btn-primary:hover {
      background: #ea7a53;
      box-shadow: 0 6px 18px rgba(224, 108, 67, 0.45);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #e4e4e7;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.09);
      color: #ffffff;
    }
    .footer {
      margin-top: 2rem;
      font-size: 0.8rem;
      color: #63636e;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
        <g transform="translate(32 32) scale(1.12) translate(-32 -32)">
          <path d="M32 32L30.91 31.93L29.82 31.76L28.77 31.47L27.74 31.07L26.77 30.56L25.86 29.94L25.02 29.24L24.26 28.45L23.58 27.58L23.01 26.64L22.54 25.65L22.18 24.61L21.92 23.54L21.8 22.45L21.78 21.35L21.89 20.26L22.1 19.18L22.43 18.14L22.88 17.13L23.43 16.18L24.08 15.29L24.81 14.48L25.64 13.75L26.53 13.12L27.49 12.58L28.5 12.14L29.55 11.83L30.63 11.63L31.73 11.54L32.82 11.56L33.91 11.71L34.98 11.98L36.01 12.35L37 12.83L37.93 13.42L38.78 14.11L39.56 14.88L40.26 15.73L40.87 16.65" stroke="#f5f4ef" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M23.15 47.32L23.76 48.24L24.45 49.09L25.23 49.87L26.08 50.56L27.01 51.14L28 51.63L29.03 52L30.09 52.27L31.18 52.42L32.27 52.45L33.37 52.36L34.45 52.16L35.5 51.85L36.51 51.41L37.46 50.88L38.36 50.24L39.19 49.52L39.92 48.71L40.57 47.82L41.12 46.87L41.57 45.86L41.9 44.82L42.12 43.74L42.22 42.65L42.21 41.55L42.08 40.46L41.83 39.39L41.46 38.35L40.99 37.36L40.42 36.42L39.75 35.56L38.99 34.77L38.14 34.06L37.23 33.45L36.26 32.93L35.24 32.53L34.18 32.24L33.1 32.07L32 32" stroke="#f5f4ef" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M50.1 13.9h0.01" stroke="#e06c43" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>
    </div>
    <div class="badge">HTTP 404 · Not Found</div>
    <h1>Page Not Found</h1>
    <p>The requested file, directory, or link was not found on this Smaran HFS server. It may have been moved, renamed, or deleted.</p>
    <div class="actions">
      <a href="$URL" class="btn btn-primary">Return to Files ($HOME)</a>
    </div>
  </div>
  <div class="footer">Smaran HFS · Secure Local File Server</div>
</body>
</html>

[top]
<div id="smaran-webdav-widget" style="position:fixed;bottom:1.25rem;right:1.25rem;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <button id="smaran-webdav-btn" onclick="var m=document.getElementById('smaran-webdav-pop');m.style.display=(m.style.display==='none'||!m.style.display)?'block':'none';" style="display:inline-flex;align-items:center;gap:0.5rem;background:#18181e;color:#f5f4ef;border:1px solid rgba(224,108,67,0.45);border-radius:9999px;padding:0.6rem 1.15rem;font-size:0.82rem;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.6);cursor:pointer;transition:transform 0.15s ease;">
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#e06c43;box-shadow:0 0 8px #e06c43;"></span>
    Mount as Windows Drive / WebDAV
  </button>
  <div id="smaran-webdav-pop" style="display:none;position:absolute;bottom:3.25rem;right:0;width:340px;background:#15151b;border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:1.25rem;box-shadow:0 24px 48px rgba(0,0,0,0.85);color:#f5f4ef;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
      <span style="font-weight:700;font-size:0.95rem;color:#ffffff;">WebDAV Drive Connection</span>
      <button onclick="document.getElementById('smaran-webdav-pop').style.display='none';" style="background:none;border:none;color:#888;cursor:pointer;font-size:1.1rem;line-height:1;padding:0.2rem;">✕</button>
    </div>
    <p style="font-size:0.8rem;color:#9c9ca4;line-height:1.45;margin-bottom:1rem;">
      Mount files from this Smaran server directly into Windows Explorer as a network drive (Drive Z:).
    </p>
    <div style="margin-bottom:1rem;">
      <a href="/~/webdav/mount.bat" download="mount-smaran-drive.bat" style="display:flex;align-items:center;justify-content:center;gap:0.5rem;width:100%;padding:0.7rem;background:#e06c43;color:#ffffff;border-radius:10px;font-size:0.85rem;font-weight:600;text-decoration:none;box-shadow:0 4px 14px rgba(224,108,67,0.35);text-align:center;box-sizing:border-box;">
        ⚡ Download Windows Mount Script (.bat)
      </a>
      <span style="display:block;font-size:0.72rem;color:#777;margin-top:0.35rem;text-align:center;">1-Click Setup: Automatically configures WebClient & maps Z:</span>
    </div>
    <div style="background:#0d0d11;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.65rem;margin-bottom:0.85rem;">
      <div style="font-size:0.7rem;text-transform:uppercase;color:#888;margin-bottom:0.25rem;letter-spacing:0.05em;font-weight:600;">Direct WebDAV URL</div>
      <div style="font-family:monospace;font-size:0.75rem;color:#e06c43;word-break:break-all;user-select:all;" id="smaran-pop-url"></div>
    </div>
    <div style="font-size:0.73rem;color:#888;line-height:1.45;">
      <strong style="color:#d4d4d8;">macOS Finder:</strong> Press <code style="color:#e06c43;">Cmd+K</code> and enter the URL above.<br>
      <strong style="color:#d4d4d8;">Credentials:</strong> Enter your Smaran username & password if prompted.
    </div>
  </div>
</div>
<script>
  (function(){
    var u = window.location.protocol + '//' + window.location.host + '/';
    var el = document.getElementById('smaran-pop-url');
    if (el) el.innerText = u;
  })();
</script>
`;

export function generateMountBatScript(host = '127.0.0.1', port = 5901): string {
  return `@echo off
setlocal EnableDelayedExpansion
title Smaran HFS - Windows WebDAV Drive Setup

:: 1. Check and request Administrator privileges if WebClient service is not running
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [Smaran HFS] Requesting Administrator privileges to configure Windows WebClient service...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \\"\\"%~f0\\"\\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo       Smaran HFS - Windows WebDAV Drive Setup
echo ========================================================
echo.
echo [1/3] Configuring Windows WebClient service...
sc config WebClient start= auto >nul 2>&1
net start WebClient >nul 2>&1

echo [2/3] Enabling WebDAV Basic Authentication for HTTP in Registry...
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\WebClient\\Parameters" /v BasicAuthLevel /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\WebClient\\Parameters" /v FileSizeLimitInBytes /t REG_DWORD /d 4294967295 /f >nul 2>&1

echo Restarting WebClient service to apply registry settings...
net stop WebClient /y >nul 2>&1
net start WebClient >nul 2>&1

echo.
echo [3/3] Mounting WebDAV Network Drive Z: to http://${host}:${port}/ ...
net use Z: /delete /yes >nul 2>&1
net use Z: "http://${host}:${port}/" /persistent:yes

if exist Z:\\ (
    echo.
    echo ========================================================
    echo SUCCESS: Smaran HFS mounted successfully as Drive Z:!
    echo ========================================================
    explorer Z:\\
) else (
    echo.
    echo Notice: Drive mapping command completed.
    echo If prompted by Windows, enter your Smaran HFS username and password.
    explorer "http://${host}:${port}/"
)
echo.
pause
`;
}

export function generateHfsConfigYaml(options: GenerateConfigOptions): string {
  const { settings, users = [], vfs = [], adminPassword } = options;
  const adminUser = settings.adminUsername || 'smaran';
  const adminPwd = adminPassword || settings.adminPassword || '';

  const accountsRecord: Record<string, unknown> = {
    [adminUser]: {
      password: adminPwd,
      admin: true,
      ignore_limits: true,
      belongs: ['admistrators'],
    },
    admistrators: {
      ignore_limits: true,
      admin: true,
    },
  };

  for (const u of users) {
    if (u.username !== adminUser && u.username !== 'admistrators') {
      accountsRecord[u.username] = {
        password: u.password || 'smaran',
        admin: u.role === 'admin',
        ignore_limits: u.role === 'admin',
        ...(u.role === 'admin' ? { belongs: ['admistrators'] } : {}),
      };
    }
  }

  const vfsRecord: Record<string, unknown> = {};
  if (vfs.length > 0) {
    for (const node of vfs) {
      if (node.physicalPath) {
        const cleanPath = node.physicalPath.replace(/\\/g, '/');
        const vfsRel = node.vfsPath.replace(/^\//, '') || node.name;
        vfsRecord[vfsRel] = {
          source: cleanPath,
          can_see: '*',
          can_read: '*',
          can_list: '*',
          can_upload: '*',
          can_delete: '*',
          can_archive: '*',
        };
      }
    }
  } else if (settings.rootDir) {
    vfsRecord.source = settings.rootDir.replace(/\\/g, '/');
    vfsRecord.can_see = '*';
    vfsRecord.can_read = '*';
    vfsRecord.can_list = '*';
    vfsRecord.can_upload = '*';
    vfsRecord.can_delete = '*';
    vfsRecord.can_archive = '*';
  }

  const doc = {
    title: 'Smaran HFS',
    port: settings.port || 5901,
    localhost_admin: false,
    open_browser_at_start: false,
    force_theme: 'dark',
    accept_cors: true,
    force_webdav_login: true,
    accounts: accountsRecord,
    vfs: vfsRecord,
    enable_plugins: [...DEFAULT_PLUGINS],
    plugins_config: DEFAULT_PLUGINS_CONFIG,
  };

  return '# Generated by Smaran HFS Bridge\n' + yaml.stringify(doc, { lineWidth: 1000 });
}

export function syncHfsConfigFile(
  configYamlPath: string,
  options: {
    settings: FileServerSettings;
    adminPassword?: string;
    previousAdminUsername?: string;
    defaultStorageDir: string;
  },
): void {
  const { settings, adminPassword, previousAdminUsername, defaultStorageDir } = options;
  const adminUser = settings.adminUsername || 'smaran';
  const adminPwd = adminPassword || settings.adminPassword || '';
  const storageRoot = settings.rootDir || defaultStorageDir;
  const rootDir = storageRoot.replace(/\\/g, '/');

  if (!fs.existsSync(configYamlPath)) {
    const yamlStr = generateHfsConfigYaml({
      settings: {
        ...settings,
        rootDir: storageRoot,
      },
      adminPassword: adminPwd,
    });
    fs.writeFileSync(configYamlPath, yamlStr, 'utf8');
    return;
  }

  try {
    const raw = fs.readFileSync(configYamlPath, 'utf8');
    interface ConfigDoc {
      title?: string;
      port?: number;
      open_browser_at_start?: boolean;
      localhost_admin?: boolean;
      force_theme?: string;
      accept_cors?: boolean;
      force_webdav_login?: boolean;
      vfs?: Record<string, unknown>;
      accounts?: Record<string, Record<string, unknown>>;
      enable_plugins?: string[];
      plugins_config?: Record<string, unknown>;
      [key: string]: unknown;
    }
    const doc = (yaml.parse(raw) as ConfigDoc) || {};

    doc.title = 'Smaran HFS';
    doc.port = settings.port || 5901;
    doc.open_browser_at_start = false;
    doc.localhost_admin = false;
    doc.force_theme = 'dark';
    doc.accept_cors = true;
    doc.force_webdav_login = true;

    // VFS synchronization: default to full shared permissions ('*')
    if (!doc.vfs || typeof doc.vfs !== 'object') {
      doc.vfs = {};
    }
    doc.vfs.source = rootDir;
    doc.vfs.can_see = '*';
    doc.vfs.can_read = '*';
    doc.vfs.can_list = '*';
    doc.vfs.can_upload = '*';
    doc.vfs.can_delete = '*';
    doc.vfs.can_archive = '*';

    // Accounts synchronization
    if (!doc.accounts || typeof doc.accounts !== 'object') {
      doc.accounts = {};
    }

    if (previousAdminUsername && previousAdminUsername !== adminUser && doc.accounts) {
      Reflect.deleteProperty(doc.accounts, previousAdminUsername);
    }

    doc.accounts[adminUser] = {
      ...(doc.accounts[adminUser] || {}),
      password: adminPwd,
      admin: true,
      ignore_limits: true,
      belongs: ['admistrators'],
    };

    doc.accounts.admistrators = {
      ...(doc.accounts.admistrators || {}),
      ignore_limits: true,
      admin: true,
    };

    // Ensure enable_plugins
    if (!Array.isArray(doc.enable_plugins)) {
      doc.enable_plugins = [...DEFAULT_PLUGINS];
    } else {
      for (const p of DEFAULT_PLUGINS) {
        if (!doc.enable_plugins.includes(p)) {
          doc.enable_plugins.push(p);
        }
      }
    }

    // Ensure plugins_config
    if (!doc.plugins_config || typeof doc.plugins_config !== 'object') {
      doc.plugins_config = { ...DEFAULT_PLUGINS_CONFIG };
    } else {
      doc.plugins_config = {
        ...DEFAULT_PLUGINS_CONFIG,
        ...doc.plugins_config,
      };
    }

    const output = '# Updated by Smaran HFS Bridge\n' + yaml.stringify(doc, { lineWidth: 1000 });
    fs.writeFileSync(configYamlPath, output, 'utf8');
  } catch (err) {
    console.error('Failed to sync config.yaml:', err);
  }
}
