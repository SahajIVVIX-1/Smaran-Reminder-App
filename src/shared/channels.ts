// No imports here: sandboxed preloads bundle this file and cannot load npm packages.
// IPC channel names shared by main, preload and renderer.
export const IPC = {
  configGet: 'config:get',
  configSave: 'config:save',
  configChanged: 'config:changed',
  historyGet: 'history:get',
  historyClear: 'history:clear',
  historyChanged: 'history:changed',
  nextTimes: 'engine:next',
  showNow: 'engine:showNow',
  notifyTest: 'notify:test',
  appPause: 'app:pause',
  appResume: 'app:resume',
  appInfo: 'app:info',
  appOpenDataFolder: 'app:openDataFolder',
  appTheme: 'app:theme',
  backupExport: 'backup:export',
  backupImport: 'backup:import',
  fontsList: 'fonts:list',
  fontsAdd: 'fonts:add',
  navigate: 'app:navigate',
  notifInit: 'notif:init',
  notifMeasured: 'notif:measured',
  notifShown: 'notif:shown',
  notifAction: 'notif:action',
  notifClose: 'notif:close',
  notifDone: 'notif:done',
  notifInteractive: 'notif:interactive',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
