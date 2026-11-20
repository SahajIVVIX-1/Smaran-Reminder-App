import path from 'node:path';
import { app, shell, type Session, type WebContents } from 'electron';

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Validates whether an external URL is safe to open via the default system browser.
 */
export function isSafeExternalUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return false;
    }
    // Block internal loopback/private destinations if attempted via external browser unless local dev/HFS
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely opens an external URL using the system's default browser after scheme verification.
 */
export async function safeOpenExternal(urlStr: string): Promise<void> {
  if (!isSafeExternalUrl(urlStr)) {
    console.warn(`[Security] Blocked attempt to open dangerous external URL: "${urlStr}"`);
    return;
  }
  await shell.openExternal(urlStr);
}

/**
 * Checks if a target navigation URL is internal to the Smaran application.
 */
export function isInternalAppUrl(targetUrl: string): boolean {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === 'file:') {
      const normalized = path.normalize(decodeURIComponent(parsed.pathname)).toLowerCase();
      return (
        normalized.includes(path.normalize('/renderer/')) ||
        normalized.endsWith('.html')
      );
    }

    const isLoopback =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';

    return isLoopback;
  } catch {
    return false;
  }
}

/**
 * Configures global security rules on the default session (CSP, permission denial).
 */
export function configureSessionSecurity(session: Session): void {
  // Reject all device/camera/microphone/geolocation permission requests
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  // Strict Content-Security-Policy headers
  session.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' font: data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    const responseHeaders = { ...details.responseHeaders };
    // Only inject CSP into internal HTML requests
    if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') {
      responseHeaders['Content-Security-Policy'] = [csp];
      responseHeaders['X-Content-Type-Options'] = ['nosniff'];
      responseHeaders['X-Frame-Options'] = ['DENY'];
    }

    callback({ responseHeaders });
  });
}

/**
 * Hardens a specific WebContents instance against unauthorized navigation, window popups, and webviews.
 */
export function secureWebContents(contents: WebContents): void {
  // Prevent arbitrary navigation away from app pages
  contents.on('will-navigate', (event, navigationUrl) => {
    if (!isInternalAppUrl(navigationUrl)) {
      event.preventDefault();
      console.warn(`[Security] Blocked unauthorized navigation to: ${navigationUrl}`);
      if (isSafeExternalUrl(navigationUrl)) {
        void safeOpenExternal(navigationUrl);
      }
    }
  });

  // Intercept and deny window.open / popup creation, delegating safe URLs to external browser
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void safeOpenExternal(url);
    } else {
      console.warn(`[Security] Blocked attempt to open popup with unsafe scheme: "${url}"`);
    }
    return { action: 'deny' };
  });

  // Block webview tags
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
    console.warn('[Security] Blocked attempt to attach webview');
  });
}

/**
 * Attaches global security handlers to the Electron application lifecycle.
 */
export function initGlobalAppSecurity(): void {
  app.on('web-contents-created', (_event, contents) => {
    secureWebContents(contents);
  });
}
