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
  'smaran-security',
];

export const DEFAULT_PLUGINS_CONFIG = {
  antibrute: {
    increment: 3,
    max: 60,
    blockAfter: 10,
    blockForHours: 1,
    maxQueuePerIp: 16,
  },
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
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0d0d11">
  <meta name="robots" content="noindex, nofollow">

  <title>404 Not Found | Smaran HFS</title>

  <style>
    :root {
      color-scheme: dark;

      --bg: #0d0d11;
      --surface: #17171d;
      --border: rgba(255,255,255,.09);

      --text: #f5f4ef;
      --muted: #a1a1aa;

      --accent: #e07850;
      --accent-hover: #ed8962;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      min-height: 100vh;
      min-height: 100dvh;

      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;

      padding: 24px;
      overflow-x: hidden;

      position: relative;
      isolation: isolate;

      background: var(--bg);
      color: var(--text);

      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        Arial,
        sans-serif;

      -webkit-font-smoothing: antialiased;
    }

    /* Ambient background lighting */

    body::before {
      content: "";

      position: fixed;

      width: 600px;
      height: 600px;

      top: 5%;
      left: 50%;

      transform: translateX(-50%);

      background: radial-gradient(
        circle,
        rgba(224,120,80,.13) 0%,
        rgba(224,120,80,.045) 40%,
        transparent 70%
      );

      pointer-events: none;
      z-index: -1;
    }

    /* Original Smaran HFS logo */

    .brand-logo {
      position: absolute;

      top: 35px;
      left: 50%;

      transform: translateX(-50%);

      display: flex;
      justify-content: center;
      align-items: center;

      width: 100%;

      animation: fadeIn .7s ease both;
    }

    .brand-logo img {
      display: block;

      width: 145px;
      max-height: 65px;

      height: auto;

      object-fit: contain;

      background: transparent;
      border: none;
      box-shadow: none;
    }

    /* Main error card */

    .card {
      position: relative;

      width: 100%;
      max-width: 490px;

      margin-top: 90px;

      padding: 42px 36px 34px;

      text-align: center;

      background: rgba(23,23,29,.94);

      border: 1px solid var(--border);
      border-radius: 22px;

      box-shadow:
        0 28px 80px rgba(0,0,0,.42),
        0 0 0 1px rgba(224,120,80,.035);

      animation: appear .55s ease both;
    }

    /* Status badge */

    .badge {
      display: inline-flex;

      align-items: center;
      justify-content: center;
      gap: 8px;

      padding: 7px 13px;

      border-radius: 30px;

      background: rgba(224,120,80,.10);

      border: 1px solid rgba(224,120,80,.22);

      color: #ed9878;

      font-size: 11px;
      font-weight: 700;

      letter-spacing: 1.2px;
    }

    .badge-dot {
      width: 6px;
      height: 6px;

      border-radius: 50%;

      background: var(--accent);

      box-shadow: 0 0 9px rgba(224,120,80,.6);
    }

    /* Heading */

    h1 {
      margin: 23px 0 13px;

      color: #ffffff;

      font-size: clamp(27px, 6vw, 34px);
      font-weight: 720;

      letter-spacing: -1.2px;
      line-height: 1.2;
    }

    /* Description */

    .description {
      max-width: 365px;

      margin: 0 auto;

      color: var(--muted);

      font-size: 14px;
      line-height: 1.8;
    }

    /* Information section */

    .info {
      display: flex;

      gap: 13px;
      align-items: flex-start;

      margin: 27px 0;

      padding: 16px;

      text-align: left;

      background: rgba(255,255,255,.025);

      border: 1px solid var(--border);
      border-radius: 12px;
    }

    .info-icon {
      flex-shrink: 0;
      color: var(--accent);
    }

    .info strong {
      display: block;

      margin-bottom: 5px;

      color: #eeeeee;
      font-size: 13px;
      font-weight: 650;
    }

    .info p {
      color: var(--muted);

      font-size: 12px;
      line-height: 1.65;
    }

    /* Action buttons */

    .actions {
      display: flex;
      flex-direction: column;
      gap: 11px;
    }

    .btn {
      width: 100%;
      min-height: 48px;

      display: inline-flex;

      align-items: center;
      justify-content: center;
      gap: 10px;

      padding: 12px 20px;

      border-radius: 11px;

      text-decoration: none;

      font-size: 13px;
      font-weight: 650;

      transition:
        background .2s ease,
        transform .2s ease,
        box-shadow .2s ease,
        border-color .2s ease;
    }

    .btn-primary {
      background: var(--accent);
      color: #ffffff;

      box-shadow:
        0 5px 20px rgba(224,120,80,.19);
    }

    .btn-primary:hover {
      background: var(--accent-hover);

      transform: translateY(-2px);

      box-shadow:
        0 8px 25px rgba(224,120,80,.28);
    }

    .btn-primary:active {
      transform: translateY(0);
    }

    .btn:focus-visible {
      outline: 2px solid var(--accent-hover);
      outline-offset: 4px;
    }

    /* Footer */

    .footer {
      margin-top: 27px;

      text-align: center;

      color: #70707b;

      font-size: 11px;
      letter-spacing: .3px;
    }

    .footer span {
      color: #a3a3ad;
      font-weight: 650;
    }

    /* Animations */

    @keyframes appear {
      from {
        opacity: 0;
        transform: translateY(12px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }

    /* Mobile responsiveness */

    @media (max-width: 480px) {

      body {
        padding: 17px;
      }

      .brand-logo {
        top: 22px;
      }

      .brand-logo img {
        width: 125px;
        max-height: 55px;
      }

      .card {
        margin-top: 75px;

        padding: 34px 23px 28px;

        border-radius: 18px;
      }

      h1 {
        font-size: 28px;
      }
    }

    /* Reduced motion accessibility */

    @media (prefers-reduced-motion: reduce) {

      *,
      *::before,
      *::after {
        animation-duration: .01ms !important;
        transition-duration: .01ms !important;
      }
    }

  </style>
</head>

<body>

  <!-- Original Smaran HFS Logo (Outside Card) -->

  <div class="brand-logo">
    <img
      src="$URLhfs-logo.svg"
      alt="Smaran HFS"
      onerror="this.onerror=null;this.src='$URLhfs-logo-icon.svg'"
    >
  </div>


  <!-- Main 404 Error Card -->

  <main class="card">

    <!-- HTTP Status -->

    <div class="badge">
      <span class="badge-dot"></span>
      HTTP 404 · NOT FOUND
    </div>


    <!-- Main Heading -->

    <h1>
      We couldn't find that page.
    </h1>


    <!-- Description -->

    <p class="description">
      The requested file, folder, or shared link could not
      be found on this Smaran HFS server. It may have been
      moved, renamed, or deleted.
    </p>


    <!-- Information Box -->

    <div class="info">

      <div class="info-icon" aria-hidden="true">

        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <circle cx="12" cy="12" r="9"/>

          <path
            d="M12 11v5m0-8h.01"
            stroke-linecap="round"
          />
        </svg>

      </div>

      <div>

        <strong>What can you do?</strong>

        <p>
          Check the URL for typing errors or return to
          the file browser to find the resource.
        </p>

      </div>

    </div>


    <!-- Navigation -->

    <div class="actions">

      <a href="$URL" class="btn btn-primary">

        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H5a2 2 0 0 1-2-2V10Z"
            stroke-linejoin="round"
          />
        </svg>

        Return to Files ($HOME)

      </a>

    </div>

  </main>


  <!-- Footer -->

  <footer class="footer">
    <span>Smaran HFS</span>
    &nbsp;·&nbsp;
    Secure Local File Server
  </footer>

</body>
</html>

[style]
:root {
  color-scheme: dark;
  --bg: #0d0d11 !important;
  --color: #e06c43 !important;
  --faint-contrast: #16161d !important;
  --mild-contrast: #1c1c24 !important;
  --good-contrast: #242430 !important;
  --ghost-contrast: rgba(255, 255, 255, 0.04) !important;
  --ghost-contrast-alt: rgba(255, 255, 255, 0.02) !important;
  --text: #e4e4e7 !important;
  --text-high-contrast: #ffffff !important;
  --link: #e07850 !important;
  --button-bg: #1c1c24 !important;
  --button-text: #f5f4ef !important;
  --focus-color: #e06c43 !important;
  --separator: rgba(255, 255, 255, 0.08) !important;
  --success: #34d399 !important;
  --warning: #fbbf24 !important;
  --error: #f87171 !important;
}

/* Smaran Base Obsidian Atmosphere */
html, body {
  background-color: #0d0d11 !important;
  color: #f5f4ef !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  position: relative;
}

#root {
  position: relative;
  z-index: 1;
  background: transparent !important;
  min-height: 100vh;
}

/* Bigger Smaran Watermark Logo in Center of Background */
.smaran-bg-watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(560px, 85vw);
  height: min(560px, 85vw);
  max-width: 560px;
  max-height: 560px;
  pointer-events: none;
  z-index: 0;
  opacity: 0.09;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 50px rgba(224, 108, 67, 0.2));
  transition: opacity 0.3s ease;
}
.smaran-bg-watermark svg {
  width: 100%;
  height: 100%;
}

/* Ambient Radial Lighting */
body::before {
  content: "";
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, rgba(224, 108, 67, 0.08) 0%, rgba(224, 108, 67, 0.02) 40%, rgba(13, 13, 17, 0) 70%);
  pointer-events: none;
  z-index: 0;
}

/* Top Right WebDAV / Windows Drive Mount Widget */
.smaran-webdav-widget {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 999999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.smaran-webdav-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(22, 22, 29, 0.94);
  color: #f5f4ef;
  border: 1px solid rgba(224, 108, 67, 0.45);
  border-radius: 9999px;
  padding: 7px 15px;
  font-size: 12.5px;
  font-weight: 600;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(224, 108, 67, 0.15);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.smaran-webdav-btn:hover {
  background: rgba(32, 32, 42, 0.98);
  border-color: rgba(224, 108, 67, 0.75);
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(224, 108, 67, 0.3);
}

.smaran-pulse-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e06c43;
  box-shadow: 0 0 8px #e06c43;
  animation: smaranPulse 2.2s infinite;
}

@keyframes smaranPulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(224, 108, 67, 0.7); }
  70% { transform: scale(1.15); box-shadow: 0 0 0 7px rgba(224, 108, 67, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(224, 108, 67, 0); }
}

.smaran-webdav-pop {
  display: none;
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 350px;
  background: #15151c !important;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  padding: 1.25rem;
  box-shadow: 0 24px 50px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(224, 108, 67, 0.2);
  color: #f5f4ef;
  box-sizing: border-box;
  z-index: 2147483647;
}

.smaran-webdav-pop.open {
  display: block;
}

@keyframes smaranPopIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.smaran-pop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.smaran-pop-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.95rem;
  color: #ffffff;
}

.smaran-pop-close {
  background: transparent;
  border: none;
  color: #888;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: color 0.15s;
}

.smaran-pop-close:hover {
  color: #ffffff;
}

.smaran-pop-desc {
  font-size: 0.8rem;
  color: #9c9ca4;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.smaran-pop-action {
  margin-bottom: 1rem;
}

.smaran-pop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 0.75rem 1rem;
  background: #e06c43;
  color: #ffffff;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(224, 108, 67, 0.35);
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.smaran-pop-btn:hover {
  background: #ea7a53;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(224, 108, 67, 0.45);
}

.smaran-pop-subtext {
  display: block;
  font-size: 0.72rem;
  color: #777;
  margin-top: 0.4rem;
  text-align: center;
}

.smaran-pop-url-box {
  background: #0d0d11;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  margin-bottom: 0.85rem;
}

.smaran-pop-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 0.3rem;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.smaran-copy-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f5f4ef;
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.smaran-copy-btn:hover {
  background: rgba(224, 108, 67, 0.3);
  color: #ffffff;
}

.smaran-pop-url {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  color: #e07850;
  word-break: break-all;
  user-select: all;
}

.smaran-pop-guide {
  font-size: 0.72rem;
  color: #888;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.smaran-pop-guide code {
  color: #e07850;
  font-family: monospace;
}

/* Smaran Theme Polish for HFS Web UI & Plugins */
.list-wrapper {
  background: transparent !important;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.entry-panel, .entry-row {
  border-radius: 10px !important;
  transition: background-color 0.15s ease, transform 0.1s ease !important;
}

.entry-panel:hover, .entry-row:hover {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

.breadcrumb {
  font-weight: 500;
}

.dialog-backdrop {
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  background: rgba(0, 0, 0, 0.72) !important;
}

.dialog {
  background: #14141c !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 16px !important;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(224, 108, 67, 0.15) !important;
  color: #f5f4ef !important;
  padding: 20px 22px !important;
  position: relative !important;
  overflow: visible !important;
}

/* Remove awkward corner blob tab from dialog top-left */
.dialog .dialog-icon.dialog-type,
.dialog .dialog-type {
  display: none !important;
}

/* Clean dialog title */
.dialog .dialog-title {
  color: #f5f4ef !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  letter-spacing: -0.01em !important;
  text-align: center !important;
  margin: 0 0 14px 0 !important;
  padding: 0 !important;
  border: none !important;
}

/* Modern close button */
.dialog .dialog-closer {
  position: absolute !important;
  top: 14px !important;
  right: 14px !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  min-height: 28px !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.08) !important;
  color: #a1a1aa !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 14px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
}

.dialog .dialog-closer:hover {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #f87171 !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  transform: scale(1.05);
}

/* User Panel Typography & Button Contrast */
#user-panel {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  color: #f5f4ef !important;
}

#user-panel > div:first-child {
  font-size: 13.5px !important;
  font-weight: 500 !important;
  color: #9ca3af !important;
  margin-bottom: 6px !important;
  padding-bottom: 8px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}

#user-panel button {
  width: 100% !important;
  margin: 3px 0 !important;
  padding: 9px 14px !important;
  border-radius: 8px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
}

/* Admin Panel Button: Primary Orange Action */
#user-panel #admin-panel-btn {
  background: linear-gradient(135deg, #e06c43 0%, #c8532a 100%) !important;
  color: #ffffff !important;
  border: 1px solid rgba(224, 108, 67, 0.5) !important;
  font-weight: 600 !important;
  box-shadow: 0 2px 8px rgba(224, 108, 67, 0.25) !important;
}

#user-panel #admin-panel-btn:hover {
  background: linear-gradient(135deg, #e77750 0%, #d45e35 100%) !important;
  box-shadow: 0 4px 14px rgba(224, 108, 67, 0.38) !important;
  transform: translateY(-1px);
}

/* Change Password Button: Sleek Dark Neutral */
#user-panel #change-password-btn {
  background: #1c1c25 !important;
  color: #f5f4ef !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
}

#user-panel #change-password-btn:hover {
  background: #262633 !important;
  border-color: rgba(224, 108, 67, 0.45) !important;
  transform: translateY(-1px);
}

/* Logout Button: Subtle Danger Action */
#user-panel #logout-btn {
  background: rgba(239, 68, 68, 0.1) !important;
  color: #fca5a5 !important;
  border: 1px solid rgba(239, 68, 68, 0.25) !important;
}

#user-panel #logout-btn:hover {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #ffffff !important;
  border-color: rgba(239, 68, 68, 0.4) !important;
  transform: translateY(-1px);
}

/* Server-Info Plugin High-Contrast Theme Overrides */
#user-disk-info {
  margin-top: 10px !important;
  padding-top: 10px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #f5f4ef !important;
}

#user-disk-info .section-title {
  color: #9ca3af !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  margin: 10px 0 6px 0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding-bottom: 3px !important;
}

#user-disk-info .drive-item {
  background: #1c1c24 !important;
  border: 1px solid rgba(255, 255, 255, 0.09) !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  color: #f5f4ef !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;
  text-align: left !important;
  line-height: 1.35 !important;
  transition: all 0.15s ease !important;
}

#user-disk-info .drive-item:hover {
  background: #242430 !important;
  border-color: rgba(224, 108, 67, 0.35) !important;
}

#user-disk-info .hfs-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}

#user-disk-info .hfs-list-item {
  background: #1c1c24 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 7px !important;
  padding: 6px 11px !important;
  font-size: 12px !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  transition: all 0.15s ease !important;
}

#user-disk-info .hfs-list-item:hover {
  background: #23232c !important;
}

#user-disk-info .hfs-label {
  color: #a1a1aa !important;
  font-weight: 500 !important;
  font-size: 12px !important;
}

#user-disk-info .hfs-value {
  color: #f5f4ef !important;
  font-weight: 600 !important;
  font-size: 12px !important;
}

#user-disk-info .status-on {
  color: #34d399 !important;
  background: rgba(52, 211, 153, 0.12) !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  font-weight: 600 !important;
}

#user-disk-info .status-off {
  color: #f87171 !important;
  background: rgba(248, 113, 113, 0.12) !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  font-weight: 600 !important;
}

/* Plugin Protection & Harmonization */
#player, #video-player {
  background: rgba(22, 22, 28, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(12px) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7) !important;
}

.play-button {
  background: rgba(224, 108, 67, 0.2) !important;
  color: #e06c43 !important;
  border-radius: 6px !important;
  border: 1px solid rgba(224, 108, 67, 0.35) !important;
}

.play-button:hover {
  background: #e06c43 !important;
  color: #ffffff !important;
}

.smaran-btn-text-short {
  display: none;
}

/* Mobile & Tablet Responsiveness: Hide mount drive on mobile/tablet screens */
@media (max-width: 1024px) {
  .smaran-webdav-widget {
    display: none !important;
  }
}

@media (max-width: 768px) {
  .smaran-bg-watermark {
    width: min(320px, 80vw);
    height: min(320px, 80vw);
    opacity: 0.07;
  }
  .list-wrapper {
    padding: 0 0.5rem;
  }
}

[top]
<div class="smaran-bg-watermark" aria-hidden="true">
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(32 32) scale(1.18) translate(-32 -32)">
      <path d="M32 32L30.91 31.93L29.82 31.76L28.77 31.47L27.74 31.07L26.77 30.56L25.86 29.94L25.02 29.24L24.26 28.45L23.58 27.58L23.01 26.64L22.54 25.65L22.18 24.61L21.92 23.54L21.8 22.45L21.78 21.35L21.89 20.26L22.1 19.18L22.43 18.14L22.88 17.13L23.43 16.18L24.08 15.29L24.81 14.48L25.64 13.75L26.53 13.12L27.49 12.58L28.5 12.14L29.55 11.83L30.63 11.63L31.73 11.54L32.82 11.56L33.91 11.71L34.98 11.98L36.01 12.35L37 12.83L37.93 13.42L38.78 14.11L39.56 14.88L40.26 15.73L40.87 16.65" stroke="#f5f4ef" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M23.15 47.32L23.76 48.24L24.45 49.09L25.23 49.87L26.08 50.56L27.01 51.14L28 51.63L29.03 52L30.09 52.27L31.18 52.42L32.27 52.45L33.37 52.36L34.45 52.16L35.5 51.85L36.51 51.41L37.46 50.88L38.36 50.24L39.19 49.52L39.92 48.71L40.57 47.82L41.12 46.87L41.57 45.86L41.9 44.82L42.12 43.74L42.22 42.65L42.21 41.55L42.08 40.46L41.83 39.39L41.46 38.35L40.99 37.36L40.42 36.42L39.75 35.56L38.99 34.77L38.14 34.06L37.23 33.45L36.26 32.93L35.24 32.53L34.18 32.24L33.1 32.07L32 32" stroke="#f5f4ef" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50.1 13.9h0.01" stroke="#e06c43" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>
</div>

<div id="smaran-webdav-widget" class="smaran-webdav-widget">
  <button id="smaran-webdav-btn" class="smaran-webdav-btn" onclick="var m=document.getElementById('smaran-webdav-pop');m.classList.toggle('open');" aria-label="Mount as Windows Drive or WebDAV">
    <span class="smaran-pulse-dot"></span>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    <span class="smaran-btn-text-full">Mount as Drive Z:</span>
    <span class="smaran-btn-text-short">Mount Drive</span>
  </button>
  <div id="smaran-webdav-pop" class="smaran-webdav-pop">
    <div class="smaran-pop-header">
      <div class="smaran-pop-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e06c43" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>WebDAV Network Drive</span>
      </div>
      <button class="smaran-pop-close" onclick="document.getElementById('smaran-webdav-pop').classList.remove('open');" aria-label="Close">✕</button>
    </div>
    <p class="smaran-pop-desc">
      Mount files from this Smaran server directly into Windows Explorer, macOS Finder, or mobile WebDAV apps as a native network drive.
    </p>
    <div class="smaran-pop-action">
      <a href="/~/webdav/mount.bat" download="mount-smaran-drive.bat" class="smaran-pop-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>
        <span>1-Click Windows Mount Script (.bat)</span>
      </a>
      <span class="smaran-pop-subtext">Automatically starts WebClient &amp; maps Drive Z:</span>
    </div>
    <div class="smaran-pop-url-box">
      <div class="smaran-pop-label">
        <span>Direct WebDAV URL</span>
        <button class="smaran-copy-btn" id="smaran-copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('smaran-pop-url').innerText);this.innerText='Copied!';setTimeout(()=>{this.innerText='Copy';},2000);" title="Copy URL">Copy</button>
      </div>
      <div class="smaran-pop-url" id="smaran-pop-url"></div>
    </div>
    <div class="smaran-pop-guide">
      <div><strong>Windows:</strong> Run downloaded <code>.bat</code> as Admin or use Map Network Drive.</div>
      <div><strong>macOS:</strong> Finder &rarr; Go &rarr; Connect to Server (<code>Cmd+K</code>).</div>
      <div><strong>Mobile:</strong> Compatible with Documents, FE File Explorer, Solid Explorer.</div>
    </div>
  </div>
</div>

[bottom]
<script>
  (function(){
    var u = window.location.protocol + '//' + window.location.host + '/';
    var el = document.getElementById('smaran-pop-url');
    if (el) el.innerText = u;
    document.addEventListener('click', function(e){
      var w = document.getElementById('smaran-webdav-widget');
      var p = document.getElementById('smaran-webdav-pop');
      if (w && p && p.classList.contains('open') && !w.contains(e.target)) {
        p.classList.remove('open');
      }
    });
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
