import { z } from 'zod';
import { IdSchema, StyleFieldsSchema, type Id, type StyleFields } from './schema';

export { IPC, type IpcChannel } from './channels';

/** config:save result. `error` is plain English, ready to show. */
export type SaveResult = { ok: true } | { ok: false; error: string };

// ---------- payloads (validated in main with these schemas) ----------

/** Test an existing message, or an unsaved text + style from the settings preview. */
export const PopupTestSchema = z.union([
  z.object({ messageId: IdSchema }),
  z.object({ text: z.string().min(1), style: StyleFieldsSchema }),
]);
export type PopupTestRequest = z.infer<typeof PopupTestSchema>;

export const ScheduleRunNowSchema = z.object({ scheduleId: IdSchema });

/** Pause for `minutes`, or until resumed when omitted. */
export const PauseSchema = z.object({ minutes: z.number().int().min(1).max(525_600).optional() });

export const BackupFormatSchema = z.object({ format: z.enum(['json', 'csv']) });
export const BackupImportSchema = z.object({ format: z.enum(['json', 'csv', 'v1']) });
export type BackupResult =
  { ok: true; path?: string; detail?: string } | { ok: false; error: string };

export const DirtySchema = z.boolean();

export interface NextFire {
  scheduleId: Id;
  /** ISO time, or null if the schedule will not fire again. */
  at: string | null;
}

export interface AppInfo {
  version: string;
  dataFolder: string;
  portable: boolean;
  electron: string;
}

export const PopupMeasuredSchema = z.object({
  w: z.number().positive().max(10_000),
  h: z.number().positive().max(10_000),
});

export const PopupDragMoveSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export interface PopupInit {
  text: string;
  style: StyleFields;
}
