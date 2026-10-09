import { z } from 'zod';
import type { CustomFont } from './fonts';
import { ColorSchema, IdSchema, type Id, type ReminderColor } from './schema';

export { IPC, type IpcChannel } from './channels';

/** config:save result. `error` is plain English, ready to show. */
export type SaveResult = { ok: true } | { ok: false; error: string };

/** What a notification card shows. */
export interface NotificationRequest {
  key: string;
  /** Null for summaries ("3 more were missed"), which have no Done/Snooze. */
  reminderId: Id | null;
  title: string;
  body: string;
  color: ReminderColor;
  important: boolean;
  /** Small caption: "Missed at 09:00", "Delayed from 22:30", "Again · 1 of 2", "Snoozed". */
  label: string;
  /** Seconds before it hides itself; null = stays until the user acts. */
  hideAfterSec: number | null;
  sound: boolean;
  /** A sample from Settings: shows Done/Snooze, records nothing. */
  preview?: boolean;
}

/** What the card tells main. 'expired' = it hid itself without an answer. */
export type NotificationAction =
  | { kind: 'done' }
  | { kind: 'dismiss' }
  | { kind: 'snooze'; minutes: number | 'tomorrow' }
  | { kind: 'expired' };

export const NotificationActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('done') }),
  z.object({ kind: z.literal('dismiss') }),
  z.object({ kind: z.literal('expired') }),
  z.object({
    kind: z.literal('snooze'),
    minutes: z.union([z.number().int().min(1).max(1440), z.literal('tomorrow')]),
  }),
]);

/** Notification look, sent with every card. */
export interface NotificationLook {
  theme: 'light' | 'dark';
  size: 'compact' | 'comfortable' | 'large';
  /** Font family chosen in Settings, and any font files the user added. */
  font: string;
  faces: CustomFont[];
}

export interface NotificationInit {
  request: NotificationRequest;
  look: NotificationLook;
}

export const NotifyTestSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000),
  color: ColorSchema,
  important: z.boolean(),
});
export type NotifyTestRequest = z.infer<typeof NotifyTestSchema>;

export const ShowNowSchema = z.object({ reminderId: IdSchema });

/** Pause for `minutes`, or until resumed when omitted. */
export const PauseSchema = z.object({ minutes: z.number().int().min(1).max(525_600).optional() });

export const BackupImportSchema = z.object({ mode: z.enum(['replace', 'add']) });
export type BackupResult =
  { ok: true; path?: string; detail?: string } | { ok: false; error: string };

export const MeasuredSchema = z.object({
  w: z.number().positive().max(10_000),
  h: z.number().positive().max(10_000),
});

export const EditCommandSchema = z.enum(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']);
export type EditCommand = z.infer<typeof EditCommandSchema>;

export const ShapeSchema = z.object({ h: z.number().positive().max(10_000) });

export const ThemeSchema = z.object({ dark: z.boolean() });

export interface NextFire {
  reminderId: Id;
  /** ISO time, or null if it will not come up again. */
  at: string | null;
}

export interface AppInfo {
  version: string;
  dataFolder: string;
  portable: boolean;
  electron: string;
  /** The window has Windows 11's acrylic backdrop, so the page can be translucent. */
  glass: boolean;
}

export type FontsAddResult =
  { ok: true; added: string[]; skipped: string[] } | { ok: false; error: string };

export type Route = 'today' | 'reminders' | 'history' | 'settings';
