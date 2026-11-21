import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '@shared/channels';
import type {
  AppInfo,
  AutomationNext,
  AutomationRun,
  BackupResult,
  Browser,
  EditCommand,
  FontsAddResult,
  NextFire,
  NotifyTestRequest,
  PickWhat,
  Route,
  SaveResult,
} from '@shared/ipc';
import type {
  FileServerAuditFilter,
  FileServerSecurityEvent,
  FileServerSettings,
  FirewallStatus,
  SafeAdminCredentials,
  ServerLogEntry,
  ServerStatus,
  StartupDiagnosticInfo,
} from '@shared/fileserver';
import type {
  AvailableScreenSource,
  RemoteHubDevice,
  RemoteHubLogEntry,
  RemoteHubOverview,
  RemoteHubSettings,
  RemoteHubStream,
  RemoteHubUser,
  UserRole,
} from '@shared/remotehub';
import type { AppNotification } from '@shared/notifications';
import type { FontCatalog } from '@shared/fonts';
import type { LicenseImportResult, LicenseInfo } from '@shared/license/info';
import type { LogoState } from '@shared/logoState';
import type { Config, HistoryEntry, Id } from '@shared/schema';

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// The only bridge between the app window and main. The renderer never sees ipcRenderer.
const api = {
  config: {
    get: (): Promise<Config> => ipcRenderer.invoke(IPC.configGet),
    save: (config: Config): Promise<SaveResult> => ipcRenderer.invoke(IPC.configSave, config),
    /** Every write from anywhere (engine, imports, other edits). Returns an unsubscribe. */
    onChanged: (listener: (config: Config) => void): (() => void) =>
      subscribe(IPC.configChanged, listener),
  },
  history: {
    get: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IPC.historyGet),
    clear: (): Promise<void> => ipcRenderer.invoke(IPC.historyClear),
    onChanged: (listener: (entries: HistoryEntry[]) => void): (() => void) =>
      subscribe(IPC.historyChanged, listener),
  },
  notifications: {
    list: (): Promise<AppNotification[]> => ipcRenderer.invoke(IPC.notificationsGet),
    markRead: (id: string): Promise<void> => ipcRenderer.invoke(IPC.notificationsMarkRead, { id }),
    markAllRead: (): Promise<void> => ipcRenderer.invoke(IPC.notificationsMarkAllRead),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(IPC.notificationsDelete, { id }),
    clear: (): Promise<void> => ipcRenderer.invoke(IPC.notificationsClear),
    onChanged: (listener: (notifications: AppNotification[]) => void): (() => void) =>
      subscribe(IPC.notificationsChanged, listener),
  },
  reminders: {
    nextTimes: (): Promise<NextFire[]> => ipcRenderer.invoke(IPC.nextTimes),
    showNow: (reminderId: Id): Promise<boolean> => ipcRenderer.invoke(IPC.showNow, { reminderId }),
    test: (request: NotifyTestRequest): Promise<void> =>
      ipcRenderer.invoke(IPC.notifyTest, request),
    previewBorderLight: (): Promise<void> => ipcRenderer.invoke(IPC.screenBorderPreview),
  },
  license: {
    get: (): Promise<LicenseInfo> => ipcRenderer.invoke(IPC.licenseGet),
    /** Opens a file picker and imports (or replaces) the license image. */
    import: (): Promise<LicenseImportResult> => ipcRenderer.invoke(IPC.licenseImport),
    onChanged: (listener: (info: LicenseInfo) => void): (() => void) =>
      subscribe(IPC.licenseChanged, listener),
  },
  automations: {
    nextTimes: (): Promise<AutomationNext[]> => ipcRenderer.invoke(IPC.automationsNext),
    /** Runs it now, whatever its trigger. */
    run: (id: Id): Promise<boolean> => ipcRenderer.invoke(IPC.automationsRun, { id }),
    cancel: (id: Id): Promise<void> => ipcRenderer.invoke(IPC.automationsCancel, { id }),
    running: (): Promise<AutomationRun[]> => ipcRenderer.invoke(IPC.automationsRuns),
    onRunning: (listener: (runs: AutomationRun[]) => void): (() => void) =>
      subscribe(IPC.automationsRunsChanged, listener),
    browsers: (): Promise<Browser[]> => ipcRenderer.invoke(IPC.automationsBrowsers),
    /** A file picker; resolves to the chosen path, or null. */
    pick: (what: PickWhat): Promise<string | null> =>
      ipcRenderer.invoke(IPC.automationsPick, { what }),
  },
  app: {
    pause: (minutes?: number): Promise<void> => ipcRenderer.invoke(IPC.appPause, { minutes }),
    resume: (): Promise<void> => ipcRenderer.invoke(IPC.appResume),
    info: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
    openDataFolder: (): Promise<string> => ipcRenderer.invoke(IPC.appOpenDataFolder),
    /** Tells main the page's theme so the window's caption buttons match. */
    setTheme: (dark: boolean): void => ipcRenderer.send(IPC.appTheme, { dark }),
    /** Runs a clipboard/edit command on the focused field (for the right-click menu). */
    edit: (command: EditCommand): void => ipcRenderer.send(IPC.appEdit, command),
    onNavigate: (listener: (route: Route) => void): (() => void) =>
      subscribe(IPC.navigate, listener),
  },
  clipboard: {
    /** Writes text to the system clipboard via main process with zero focus/permission restrictions. */
    writeText: (text: string): Promise<boolean> => ipcRenderer.invoke(IPC.clipboardWrite, { text }),
  },
  logo: {
    /** What the Smaran dots should show right now, and every change after. */
    get: (): Promise<LogoState> => ipcRenderer.invoke(IPC.logoGet),
    onState: (listener: (state: LogoState) => void): (() => void) =>
      subscribe(IPC.logoState, listener),
  },
  fonts: {
    list: (): Promise<FontCatalog> => ipcRenderer.invoke(IPC.fontsList),
    add: (): Promise<FontsAddResult> => ipcRenderer.invoke(IPC.fontsAdd),
  },
  backup: {
    export: (): Promise<BackupResult> => ipcRenderer.invoke(IPC.backupExport),
    import: (mode: 'replace' | 'add'): Promise<BackupResult> =>
      ipcRenderer.invoke(IPC.backupImport, { mode }),
  },
  fileserver: {
    status: (): Promise<ServerStatus> => ipcRenderer.invoke(IPC.fileserverStatus),
    start: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke(IPC.fileserverStart),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC.fileserverStop),
    restart: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverRestart),
    getSettings: (): Promise<FileServerSettings> => ipcRenderer.invoke(IPC.fileserverSettingsGet),
    saveSettings: (patch: Partial<FileServerSettings>): Promise<FileServerSettings> =>
      ipcRenderer.invoke(IPC.fileserverSettingsSave, patch),
    pickRootDir: (): Promise<string | null> => ipcRenderer.invoke(IPC.fileserverPickRootDir),
    openFolder: (folderPath?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fileserverOpenFolder, folderPath),
    logs: {
      get: (): Promise<ServerLogEntry[]> => ipcRenderer.invoke(IPC.fileserverLogsGet),
      clear: (): Promise<void> => ipcRenderer.invoke(IPC.fileserverLogsClear),
    },
    generateQr: (url: string): Promise<string> => ipcRenderer.invoke(IPC.fileserverQrGenerate, url),
    mountLocalDrive: (payload?: {
      driveLetter?: string;
      username?: string;
      password?: string;
    }): Promise<{ ok: boolean; driveLetter?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverMountDrive, payload),
    unmountLocalDrive: (driveLetter?: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverUnmountDrive, driveLetter),
    getAdminCredentials: (): Promise<SafeAdminCredentials> =>
      ipcRenderer.invoke(IPC.fileserverAdminGet),
    setAdminCredentials: (creds: {
      username: string;
      password: string;
    }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverAdminSet, creds),
    resetDefaults: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverResetDefaults),
    enableWebClient: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverEnableWebClient),
    restoreWebClient: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverRestoreWebClient),
    getFirewallStatus: (): Promise<FirewallStatus> =>
      ipcRenderer.invoke(IPC.fileserverGetFirewallStatus),
    authorizeFirewall: (): Promise<{ ok: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverAuthorizeFirewall),
    removeFirewall: (): Promise<{ ok: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverRemoveFirewall),
    getDiagnostics: (): Promise<StartupDiagnosticInfo | null> =>
      ipcRenderer.invoke(IPC.fileserverGetDiagnostics),
    exportDiagnostics: (): Promise<string> =>
      ipcRenderer.invoke(IPC.fileserverExportDiagnostics),
    exportMountScript: (): Promise<{ ok: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverExportMountScript),
    openUrl: (url: string): Promise<void> => ipcRenderer.invoke(IPC.fileserverOpenUrl, url),
    onStatusChanged: (listener: (status: ServerStatus) => void): (() => void) =>
      subscribe(IPC.fileserverStatusChanged, listener),
    onLogAdded: (listener: (log: ServerLogEntry) => void): (() => void) =>
      subscribe(IPC.fileserverLogAdded, listener),
    getSessions: (): Promise<Array<{ id: string; ip: string; speed?: number }>> =>
      ipcRenderer.invoke(IPC.fileserverSessionsGet),
    disconnectSession: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.fileserverSessionDisconnect, { id }),
    getSecurityEvents: (filter?: FileServerAuditFilter): Promise<FileServerSecurityEvent[]> =>
      ipcRenderer.invoke(IPC.fileserverSecurityEventsGet, filter),
  },
  remotehub: {
    overview: (): Promise<RemoteHubOverview> => ipcRenderer.invoke(IPC.remotehubOverview),
    start: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke(IPC.remotehubStart),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC.remotehubStop),
    restart: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke(IPC.remotehubRestart),
    getSettings: (): Promise<RemoteHubSettings> => ipcRenderer.invoke(IPC.remotehubSettingsGet),
    saveSettings: (patch: Partial<RemoteHubSettings>): Promise<RemoteHubSettings> =>
      ipcRenderer.invoke(IPC.remotehubSettingsSave, patch),
    createAdmin: (creds: {
      username: string;
      password: string;
      displayName: string;
    }): Promise<RemoteHubUser> => ipcRenderer.invoke(IPC.remotehubAdminCreate, creds),
    getUsers: (): Promise<RemoteHubUser[]> => ipcRenderer.invoke(IPC.remotehubUsersList),
    createUser: (payload: {
      username: string;
      password: string;
      displayName: string;
      role: UserRole;
    }): Promise<RemoteHubUser> => ipcRenderer.invoke(IPC.remotehubUserCreate, payload),
    updateUser: (payload: {
      id: string;
      patch: { displayName?: string; role?: UserRole; enabled?: boolean; password?: string };
    }): Promise<RemoteHubUser> => ipcRenderer.invoke(IPC.remotehubUserUpdate, payload),
    deleteUser: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.remotehubUserDelete, id),
    getDevices: (): Promise<RemoteHubDevice[]> => ipcRenderer.invoke(IPC.remotehubDevicesList),
    requestPairCode: (): Promise<{ code: string; expiresAt: number }> =>
      ipcRenderer.invoke(IPC.remotehubDevicePairRequest),
    revokeDevice: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.remotehubDeviceRevoke, id),
    getSources: (): Promise<AvailableScreenSource[]> =>
      ipcRenderer.invoke(IPC.remotehubSourcesList),
    getStreams: (): Promise<RemoteHubStream[]> => ipcRenderer.invoke(IPC.remotehubStreamsList),
    startStream: (params: {
      sourceId: string;
      name?: string;
      resolution?: string;
      fps?: number;
      bitrateKbps?: number;
      enableSrt?: boolean;
      srtMode?: 'caller' | 'listener';
      srtPort?: number;
      srtLatencyMs?: number;
      srtPassphrase?: string;
    }): Promise<RemoteHubStream> => ipcRenderer.invoke(IPC.remotehubStreamStart, params),
    stopStream: (streamId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.remotehubStreamStop, streamId),
    updateStreamSrt: (payload: {
      streamId: string;
      params: { mode?: 'caller' | 'listener'; port?: number; latencyMs?: number; passphrase?: string };
    }): Promise<RemoteHubStream> => ipcRenderer.invoke(IPC.remotehubStreamSrtUpdate, payload),
    approveControl: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.remotehubControlApprove, sessionId),
    revokeControl: (): Promise<boolean> => ipcRenderer.invoke(IPC.remotehubControlRevoke),
    logs: {
      get: (): Promise<RemoteHubLogEntry[]> => ipcRenderer.invoke(IPC.remotehubLogsGet),
      clear: (): Promise<void> => ipcRenderer.invoke(IPC.remotehubLogsClear),
    },
    onOverviewChanged: (listener: (overview: RemoteHubOverview) => void): (() => void) =>
      subscribe(IPC.remotehubOverviewChanged, listener),
    onLogAdded: (listener: (log: RemoteHubLogEntry) => void): (() => void) =>
      subscribe(IPC.remotehubLogAdded, listener),
  },
};

export type SmaranApi = typeof api;

contextBridge.exposeInMainWorld('smaran', api);
