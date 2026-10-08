// No imports here: sandboxed preloads bundle this file and cannot load npm packages.
// IPC channel names shared by main, preload and renderer.
export const IPC = {
  configGet: 'config:get',
  configSave: 'config:save',
  configChanged: 'config:changed',
  popupTest: 'popup:test',
  scheduleRunNow: 'schedule:runNow',
  scheduleNext: 'schedule:next',
  appPause: 'app:pause',
  appResume: 'app:resume',
  appInfo: 'app:info',
  appOpenDataFolder: 'app:openDataFolder',
  fontsList: 'fonts:list',
  backupExport: 'backup:export',
  backupImport: 'backup:import',
  settingsDirty: 'settings:dirty',
  settingsFocusMessage: 'settings:focusMessage',
  popupInit: 'popup:init',
  popupMeasured: 'popup:measured',
  popupShown: 'popup:shown',
  popupDone: 'popup:done',
  popupContextMenu: 'popup:contextMenu',
  popupDragMove: 'popup:dragMove',
  popupDragEnd: 'popup:dragEnd',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
