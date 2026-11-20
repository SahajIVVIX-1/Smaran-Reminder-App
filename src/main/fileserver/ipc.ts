import { z } from 'zod';
import { IPC } from '@shared/channels';
import {
  FileServerSettingsSchema,
  MountDrivePayloadSchema,
  SetAdminCredentialsPayloadSchema,
} from '@shared/fileserver';
import type { FileServerManager } from './FileServerManager';
import { registerSafeHandle } from '../ipc/security';
import { safeOpenExternal } from '../security/navigationSecurity';

const APP_ROLE = ['app'] as const;

export function registerFileServerIpc(manager: FileServerManager): void {
  registerSafeHandle(IPC.fileserverStatus, [...APP_ROLE], () => manager.getStatus());
  registerSafeHandle(IPC.fileserverStart, [...APP_ROLE], () => manager.start());
  registerSafeHandle(IPC.fileserverStop, [...APP_ROLE], () => manager.stop());
  registerSafeHandle(IPC.fileserverRestart, [...APP_ROLE], () => manager.restart());

  registerSafeHandle(IPC.fileserverSettingsGet, [...APP_ROLE], () => manager.getSettings());
  registerSafeHandle(IPC.fileserverSettingsSave, [...APP_ROLE], (_event, patch: unknown) => {
    const validated = FileServerSettingsSchema.partial().parse(patch);
    return manager.updateSettings(validated);
  });

  registerSafeHandle(IPC.fileserverPickRootDir, [...APP_ROLE], () => manager.pickRootDir());
  registerSafeHandle(IPC.fileserverOpenFolder, [...APP_ROLE], (_event, folderPath?: unknown) => {
    const safePath = folderPath ? z.string().parse(folderPath) : undefined;
    return manager.openFolder(safePath);
  });

  registerSafeHandle(IPC.fileserverLogsGet, [...APP_ROLE], () => manager.getLogs());
  registerSafeHandle(IPC.fileserverLogsClear, [...APP_ROLE], () => manager.clearLogs());
  registerSafeHandle(IPC.fileserverQrGenerate, [...APP_ROLE], (_event, url: unknown) => {
    const safeUrl = z.string().url().parse(url);
    return manager.generateQr(safeUrl);
  });

  registerSafeHandle(IPC.fileserverMountDrive, [...APP_ROLE], (_event, payload?: unknown) => {
    const safePayload = payload ? MountDrivePayloadSchema.parse(payload) : undefined;
    return manager.mountLocalDrive(safePayload);
  });

  registerSafeHandle(IPC.fileserverUnmountDrive, [...APP_ROLE], (_event, driveLetter?: unknown) => {
    const safeLetter = driveLetter ? z.string().parse(driveLetter) : undefined;
    return manager.unmountLocalDrive(safeLetter);
  });

  registerSafeHandle(IPC.fileserverAdminGet, [...APP_ROLE], () => manager.getAdminCredentials());
  registerSafeHandle(IPC.fileserverAdminSet, [...APP_ROLE], (_event, creds: unknown) => {
    const safeCreds = SetAdminCredentialsPayloadSchema.parse(creds);
    return manager.setAdminCredentials(safeCreds);
  });

  registerSafeHandle(IPC.fileserverResetDefaults, [...APP_ROLE], () => manager.resetDefaults());
  registerSafeHandle(IPC.fileserverEnableWebClient, [...APP_ROLE], () =>
    manager.enableWebClientService(),
  );
  registerSafeHandle(IPC.fileserverRestoreWebClient, [...APP_ROLE], () =>
    manager.restoreWebClientService(),
  );
  registerSafeHandle(IPC.fileserverExportMountScript, [...APP_ROLE], () =>
    manager.exportMountScript(),
  );

  registerSafeHandle(IPC.fileserverGetFirewallStatus, [...APP_ROLE], () =>
    manager.getFirewallStatus(),
  );
  registerSafeHandle(IPC.fileserverAuthorizeFirewall, [...APP_ROLE], () =>
    manager.authorizeFirewall(),
  );
  registerSafeHandle(IPC.fileserverRemoveFirewall, [...APP_ROLE], () => manager.removeFirewall());
  registerSafeHandle(IPC.fileserverGetDiagnostics, [...APP_ROLE], () => manager.getDiagnostics());
  registerSafeHandle(IPC.fileserverExportDiagnostics, [...APP_ROLE], () =>
    manager.exportDiagnostics(),
  );

  registerSafeHandle(IPC.fileserverOpenUrl, [...APP_ROLE], (_event, url: unknown) => {
    const safeUrl = z.string().url().parse(url);
    return safeOpenExternal(safeUrl);
  });

  registerSafeHandle(IPC.fileserverSessionsGet, [...APP_ROLE], () => manager.getSessions());
  registerSafeHandle(IPC.fileserverSessionDisconnect, [...APP_ROLE], (_event, payload: unknown) => {
    const safe = z.object({ id: z.string().min(1) }).parse(payload);
    return manager.disconnectSession(safe.id);
  });

  registerSafeHandle(
    IPC.fileserverSecurityEventsGet,
    [...APP_ROLE],
    (_event, filter?: unknown) => {
      const safeFilter = filter
        ? z
            .object({
              type: z.enum(['login', 'failedLogin', 'logout', 'adminActivity']).optional(),
              username: z.string().optional(),
              ip: z.string().optional(),
              fromDate: z.string().optional(),
              toDate: z.string().optional(),
              limit: z.number().int().positive().optional(),
            })
            .parse(filter)
        : undefined;
      return manager.getSecurityEvents(safeFilter);
    },
  );
}
