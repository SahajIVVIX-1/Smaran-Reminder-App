// IPC channel names shared by main, preload and renderer.
// Payload schemas are added per channel as each phase wires it up (see the plan's IPC contract).
export const IPC = {
  configGet: 'config:get',
  configSave: 'config:save',
  configChanged: 'config:changed',
  popupTest: 'popup:test',
  scheduleRunNow: 'schedule:runNow',
  scheduleNext: 'schedule:next',
  appPause: 'app:pause',
  appResume: 'app:resume',
  fontsList: 'fonts:list',
  backupExport: 'backup:export',
  backupImport: 'backup:import',
  popupInit: 'popup:init',
  popupMeasured: 'popup:measured',
  popupDone: 'popup:done',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
