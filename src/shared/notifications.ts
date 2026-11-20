import { z } from 'zod';
import { IdSchema } from './schema';

export const EVENT_CATEGORIES = [
  'reminders',
  'automations',
  'fileserver',
  'security',
  'system',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_SEVERITIES = ['info', 'success', 'warning', 'critical'] as const;

export type EventSeverity = (typeof EVENT_SEVERITIES)[number];

export const AppNotificationSchema = z.object({
  id: IdSchema,
  category: z.enum(EVENT_CATEGORIES),
  title: z.string().min(1).max(300),
  description: z.string().max(2000),
  timestamp: z.iso.datetime({ offset: true }),
  severity: z.enum(EVENT_SEVERITIES),
  read: z.boolean().default(false),
  source: z.string().max(100),
  entityId: IdSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AppNotification = z.infer<typeof AppNotificationSchema>;
