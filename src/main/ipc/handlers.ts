import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '@shared/ipc';
import type { ConfigStore } from '../store/ConfigStore';

/** Registers IPC handlers. Every input is validated in main (config:save goes through ConfigSchema). */
export function registerIpcHandlers(store: ConfigStore): void {
  ipcMain.handle(IPC.configGet, () => store.get());
  ipcMain.handle(IPC.configSave, (_event, next: unknown) => store.save(next));

  // Every write, from any source, reaches every open window.
  store.onChange((config) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.configChanged, config);
    }
  });
}
