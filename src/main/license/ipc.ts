import { BrowserWindow, dialog, nativeImage, app } from 'electron';
import { IPC } from '@shared/ipc';
import { LicenseError, type Bitmap } from '@shared/license/core';
import type { LicenseImportResult, LicenseInfo } from '@shared/license/info';
import type { LicenseStore } from './LicenseStore';
import { registerSafeHandle, registerSafeOn } from '../ipc/security';

const LICENSE_ROLES = ['license', 'app'] as const;

export const LICENSE_DIALOG: Electron.OpenDialogOptions = {
  title: 'Import Your Smaran License',
  properties: ['openFile'],
  filters: [
    { name: 'License image', extensions: ['png', 'jpg', 'jpeg'] },
    { name: 'All files', extensions: ['*'] },
  ],
};

/** Decodes JPG and other images with Chromium's decoder, to RGBA (BGRA on Windows). */
export function decodeWithNativeImage(bytes: Uint8Array): Bitmap | null {
  const image = nativeImage.createFromBuffer(Buffer.from(bytes));
  if (image.isEmpty()) return null;
  const { width, height } = image.getSize();
  const bgra = image.toBitmap();
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i + 3 < bgra.length && i + 3 < rgba.length; i += 4) {
    rgba[i] = bgra[i + 2] ?? 0;
    rgba[i + 1] = bgra[i + 1] ?? 0;
    rgba[i + 2] = bgra[i] ?? 0;
    rgba[i + 3] = bgra[i + 3] ?? 255;
  }
  return { width, height, rgba };
}

/** Lets the user pick a license image and imports it. Never throws. */
export async function pickAndImport(
  store: LicenseStore,
  parent: BrowserWindow | null,
): Promise<LicenseImportResult> {
  const result = parent
    ? await dialog.showOpenDialog(parent, LICENSE_DIALOG)
    : await dialog.showOpenDialog(LICENSE_DIALOG);
  const path = result.filePaths[0];
  if (result.canceled || !path) return { ok: false, canceled: true };
  try {
    return { ok: true, info: store.importFile(path) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof LicenseError
          ? error.message
          : 'This image doesn’t contain a Smaran license.',
    };
  }
}

/** License IPC for the app window and the license screen. */
export function registerLicenseIpc(
  store: LicenseStore,
  onImported: (info: LicenseInfo) => void,
): void {
  registerSafeHandle(IPC.licenseGet, [...LICENSE_ROLES], () => store.info());
  registerSafeHandle(IPC.licenseImport, [...LICENSE_ROLES], async (event) => {
    const result = await pickAndImport(store, BrowserWindow.fromWebContents(event.sender));
    if (result.ok) {
      for (const win of BrowserWindow.getAllWindows())
        if (!win.isDestroyed()) win.webContents.send(IPC.licenseChanged, result.info);
    }
    return result;
  });
  registerSafeHandle(IPC.licenseActivate, [...LICENSE_ROLES], () => {
    const info = store.info();
    if (info.status === 'valid') {
      onImported(info);
    }
  });
  registerSafeOn(IPC.licenseQuit, [...LICENSE_ROLES], () => app.quit());
}
