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
  ActiveTransfer,
  DirectoryListing,
  FileServerSettings,
  ServerLogEntry,
  ServerStatus,
  ShareLink,
  TransferHistoryEntry,
  UserAccount,
} from '@shared/fileserver';
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
  reminders: {
    nextTimes: (): Promise<NextFire[]> => ipcRenderer.invoke(IPC.nextTimes),
    showNow: (reminderId: Id): Promise<boolean> => ipcRenderer.invoke(IPC.showNow, { reminderId }),
    test: (request: NotifyTestRequest): Promise<void> =>
      ipcRenderer.invoke(IPC.notifyTest, request),
    previewBorderLight: (): Promise<void> =>
      ipcRenderer.invoke(IPC.screenBorderPreview),
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
    getSettings: (): Promise<FileServerSettings> =>
      ipcRenderer.invoke(IPC.fileserverSettingsGet),
    saveSettings: (patch: Partial<FileServerSettings>): Promise<FileServerSettings> =>
      ipcRenderer.invoke(IPC.fileserverSettingsSave, patch),
    pickRootDir: (): Promise<string | null> => ipcRenderer.invoke(IPC.fileserverPickRootDir),
    listDir: (relPath = ''): Promise<DirectoryListing | null> =>
      ipcRenderer.invoke(IPC.fileserverListDir, relPath),
    mkdir: (parentRel: string, name: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverMkdir, { path: parentRel, name }),
    delete: (relPath: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverDelete, relPath),
    rename: (relPath: string, newName: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverRename, { path: relPath, newName }),
    move: (srcPath: string, destFolder: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fileserverMove, { srcPath, destFolder }),
    openFolder: (relPath?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fileserverOpenFolder, relPath),
    users: {
      list: (): Promise<UserAccount[]> => ipcRenderer.invoke(IPC.fileserverUsersList),
      save: (user: {
        id?: string;
        username: string;
        password?: string;
        role: 'admin' | 'user' | 'guest';
        permissions: {
          read: boolean;
          upload: boolean;
          delete: boolean;
          rename: boolean;
          mkdir: boolean;
        };
        allowedFolders?: string[];
      }): Promise<UserAccount> => ipcRenderer.invoke(IPC.fileserverUsersSave, user),
      delete: (id: string): Promise<void> => ipcRenderer.invoke(IPC.fileserverUsersDelete, id),
    },
    shares: {
      list: (): Promise<ShareLink[]> => ipcRenderer.invoke(IPC.fileserverSharesList),
      create: (payload: {
        relativePath: string;
        permission: 'read' | 'upload' | 'download' | 'full';
        password?: string;
        expiresAt?: string | null;
        maxDownloads?: number | null;
      }): Promise<ShareLink> => ipcRenderer.invoke(IPC.fileserverSharesCreate, payload),
      revoke: (id: string): Promise<void> => ipcRenderer.invoke(IPC.fileserverSharesRevoke, id),
    },
    transfers: {
      active: (): Promise<ActiveTransfer[]> => ipcRenderer.invoke(IPC.fileserverTransfersActive),
      cancel: (id: string): Promise<boolean> =>
        ipcRenderer.invoke(IPC.fileserverTransfersCancel, id),
      history: (): Promise<TransferHistoryEntry[]> =>
        ipcRenderer.invoke(IPC.fileserverTransfersHistory),
      clearHistory: (): Promise<void> =>
        ipcRenderer.invoke(IPC.fileserverTransfersClearHistory),
    },
    logs: {
      get: (): Promise<ServerLogEntry[]> => ipcRenderer.invoke(IPC.fileserverLogsGet),
      clear: (): Promise<void> => ipcRenderer.invoke(IPC.fileserverLogsClear),
    },
    generateQr: (url: string): Promise<string> =>
      ipcRenderer.invoke(IPC.fileserverQrGenerate, url),
    onStatusChanged: (listener: (status: ServerStatus) => void): (() => void) =>
      subscribe(IPC.fileserverStatusChanged, listener),
    onTransfersUpdated: (listener: (transfers: ActiveTransfer[]) => void): (() => void) =>
      subscribe(IPC.fileserverTransfersUpdated, listener),
    onLogAdded: (listener: (log: ServerLogEntry) => void): (() => void) =>
      subscribe(IPC.fileserverLogAdded, listener),
  },
};

export type SmaranApi = typeof api;

contextBridge.exposeInMainWorld('smaran', api);
