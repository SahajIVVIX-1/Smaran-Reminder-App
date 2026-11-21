import { z } from 'zod';
import { IPC } from '@shared/channels';
import { RemoteHubSettingsSchema } from '@shared/remotehub';
import { registerSafeHandle } from '../ipc/security';
import type { RemoteHubManager } from './RemoteHubManager';

const APP_ROLE = ['app'] as const;

export function registerRemoteHubIpc(manager: RemoteHubManager): void {
  registerSafeHandle(IPC.remotehubOverview, [...APP_ROLE], () => manager.getOverview());
  registerSafeHandle(IPC.remotehubStart, [...APP_ROLE], () => manager.start());
  registerSafeHandle(IPC.remotehubStop, [...APP_ROLE], () => manager.stop());
  registerSafeHandle(IPC.remotehubRestart, [...APP_ROLE], () => manager.restart());

  registerSafeHandle(IPC.remotehubSettingsGet, [...APP_ROLE], () => manager.getSettings());
  registerSafeHandle(IPC.remotehubSettingsSave, [...APP_ROLE], (_event, patch: unknown) => {
    const validated = RemoteHubSettingsSchema.partial().parse(patch);
    return manager.updateSettings(validated);
  });

  registerSafeHandle(IPC.remotehubAdminCreate, [...APP_ROLE], (_event, payload: unknown) => {
    const schema = z.object({
      username: z.string().min(3),
      password: z.string().min(8),
      displayName: z.string().min(1),
    });
    const parsed = schema.parse(payload);
    return manager.createAdmin(parsed.username, parsed.password, parsed.displayName);
  });

  registerSafeHandle(IPC.remotehubUsersList, [...APP_ROLE], () => manager.listUsers());
  registerSafeHandle(IPC.remotehubUserCreate, [...APP_ROLE], (_event, payload: unknown) => {
    const schema = z.object({
      username: z.string().min(3),
      password: z.string().min(8),
      displayName: z.string().min(1),
      role: z.enum(['owner', 'operator', 'viewer']),
    });
    const parsed = schema.parse(payload);
    return manager.createUser(parsed.username, parsed.password, parsed.displayName, parsed.role);
  });

  registerSafeHandle(IPC.remotehubUserUpdate, [...APP_ROLE], (_event, payload: unknown) => {
    const schema = z.object({
      id: z.string(),
      patch: z.object({
        displayName: z.string().optional(),
        role: z.enum(['owner', 'operator', 'viewer']).optional(),
        enabled: z.boolean().optional(),
        password: z.string().min(8).optional(),
      }),
    });
    const parsed = schema.parse(payload);
    return manager.updateUser(parsed.id, parsed.patch);
  });

  registerSafeHandle(IPC.remotehubUserDelete, [...APP_ROLE], (_event, id: unknown) => {
    const safeId = z.string().parse(id);
    return manager.deleteUser(safeId);
  });

  registerSafeHandle(IPC.remotehubDevicesList, [...APP_ROLE], () => manager.listDevices());
  registerSafeHandle(IPC.remotehubDevicePairRequest, [...APP_ROLE], () =>
    manager.generatePairingCode(),
  );
  registerSafeHandle(IPC.remotehubDeviceRevoke, [...APP_ROLE], (_event, id: unknown) => {
    const safeId = z.string().parse(id);
    return manager.revokeDevice(safeId);
  });

  registerSafeHandle(IPC.remotehubSourcesList, [...APP_ROLE], () => manager.getAvailableSources());
  registerSafeHandle(IPC.remotehubStreamsList, [...APP_ROLE], () => manager.listStreams());
  registerSafeHandle(IPC.remotehubStreamStart, [...APP_ROLE], (_event, payload: unknown) => {
    const schema = z.object({
      sourceId: z.string(),
      name: z.string().optional(),
      resolution: z.string().optional(),
      fps: z.number().int().optional(),
      bitrateKbps: z.number().int().optional(),
      enableSrt: z.boolean().optional(),
      srtMode: z.enum(['caller', 'listener']).optional(),
      srtPort: z.number().int().optional(),
      srtLatencyMs: z.number().int().optional(),
      srtPassphrase: z.string().optional(),
    });
    const parsed = schema.parse(payload);
    return manager.startStream(parsed);
  });

  registerSafeHandle(IPC.remotehubStreamStop, [...APP_ROLE], (_event, streamId: unknown) => {
    const safeId = z.string().parse(streamId);
    return manager.stopStream(safeId);
  });

  registerSafeHandle(IPC.remotehubStreamSrtUpdate, [...APP_ROLE], (_event, payload: unknown) => {
    const schema = z.object({
      streamId: z.string(),
      params: z.object({
        mode: z.enum(['caller', 'listener']).optional(),
        port: z.number().int().optional(),
        latencyMs: z.number().int().optional(),
        passphrase: z.string().optional(),
      }),
    });
    const parsed = schema.parse(payload);
    return manager.updateStreamSrt(parsed.streamId, parsed.params);
  });

  registerSafeHandle(IPC.remotehubControlApprove, [...APP_ROLE], (_event, sessionId: unknown) => {
    const safeId = z.string().parse(sessionId);
    return manager.approveRemoteControl(safeId);
  });

  registerSafeHandle(IPC.remotehubControlRevoke, [...APP_ROLE], () =>
    manager.revokeRemoteControl(),
  );

  registerSafeHandle(IPC.remotehubLogsGet, [...APP_ROLE], () => manager.getLogs());
  registerSafeHandle(IPC.remotehubLogsClear, [...APP_ROLE], () => manager.clearLogs());
}
