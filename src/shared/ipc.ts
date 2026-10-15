import { z } from 'zod';
import type { CustomFont } from './fonts';
import { ColorSchema, IdSchema, type CardShape, type Id, type ReminderColor } from './schema';

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
  /** The dots beside the title: 'auto' (default) or an animation's key. */
  animation?: string;
  /** A sample from Settings: shows Done/Snooze, records nothing. */
  preview?: boolean;
  /**
   * An automation about to sign out, sleep, shut down…: counts down hideAfterSec without pausing
   * on hover and shows Run Now / Cancel. 'done' runs it now, 'dismiss' cancels it.
   */
  countdown?: boolean;
  /** The reminder's own card shape, instead of the one in Settings. */
  card?: CardShape;
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
  /** The card's shape from Settings: width (px), height (px, null = fit the content), radius. */
  card: { width: number; height: number | null; radius: number };
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

export type Route = 'today' | 'reminders' | 'automations' | 'history' | 'license' | 'settings';

// ---------- automations ----------

export const AutomationIdSchema = z.object({ id: IdSchema });

/** Which file picker to show for an automation step. */
export const PickSchema = z.object({ what: z.enum(['app', 'file', 'script', 'browser']) });
export type PickWhat = z.infer<typeof PickSchema>['what'];

export interface AutomationNext {
  automationId: Id;
  /** ISO time of its next scheduled run, or null if it has no time (events, sign-in). */
  at: string | null;
}

/** An automation that is running now: waiting between steps, or showing its Cancel card. */
export interface AutomationRun {
  automationId: Id;
  state: 'running' | 'waiting' | 'countdown';
  /** ISO time the wait or countdown ends. */
  until: string | null;
}

export interface Browser {
  name: string;
  path: string;
}
