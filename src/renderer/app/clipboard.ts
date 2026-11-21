/**
 * Reliable cross-platform clipboard copy helper.
 * Tries native Electron IPC first (works regardless of window focus or permissions),
 * then falls back to navigator.clipboard.writeText (if in a secure context),
 * and finally to textarea execCommand('copy') for guaranteed success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') return false;

  try {
    if (window.smaran?.clipboard?.writeText) {
      const res = await window.smaran.clipboard.writeText(text);
      if (res) return true;
    }
  } catch {
    // fallback
  }

  try {
    if (navigator?.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }

  try {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    input.focus();
    input.select();
    const success = document.execCommand('copy');
    document.body.removeChild(input);
    return Boolean(success);
  } catch {
    return false;
  }
}
