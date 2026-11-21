import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/defaults';
import {
  ActionSchema,
  AutomationSettingsSchema,
  ReminderSchema,
  SettingsSchema,
  TriggerSchema,
} from '@shared/schema';

describe('schemaFuzzing - Boundary Fuzzing & Schema Robustness', () => {
  describe('ReminderSchema bounds and type safety', () => {
    const validBase = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Valid title',
      note: 'Valid note',
      lines: ['Line 1', 'Line 2'],
      lineOrder: 'inOrder' as const,
      enabled: true,
      rule: { kind: 'daily' as const, times: ['09:00'] },
      priority: 'normal' as const,
      hideAfterSec: 8,
      followUp: { enabled: true, everyMin: 10, times: 2 },
      color: 'clay' as const,
      sound: 'default' as const,
      animation: 'auto',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('rejects empty, whitespace-only, or overly long titles (> 200 chars)', () => {
      expect(ReminderSchema.safeParse({ ...validBase, title: '' }).success).toBe(false);
      expect(ReminderSchema.safeParse({ ...validBase, title: '   ' }).success).toBe(false);
      expect(ReminderSchema.safeParse({ ...validBase, title: 'a'.repeat(201) }).success).toBe(false);
      expect(ReminderSchema.safeParse({ ...validBase, title: 'a'.repeat(200) }).success).toBe(true);
    });

    it('rejects notes exceeding 2,000 characters', () => {
      expect(ReminderSchema.safeParse({ ...validBase, note: 'n'.repeat(2001) }).success).toBe(false);
      expect(ReminderSchema.safeParse({ ...validBase, note: 'n'.repeat(2000) }).success).toBe(true);
    });

    it('enforces followUp interval (1-240m) and retry times (1-20)', () => {
      expect(
        ReminderSchema.safeParse({
          ...validBase,
          followUp: { enabled: true, everyMin: 0, times: 2 },
        }).success,
      ).toBe(false);

      expect(
        ReminderSchema.safeParse({
          ...validBase,
          followUp: { enabled: true, everyMin: 241, times: 2 },
        }).success,
      ).toBe(false);

      expect(
        ReminderSchema.safeParse({
          ...validBase,
          followUp: { enabled: true, everyMin: 10, times: 0 },
        }).success,
      ).toBe(false);

      expect(
        ReminderSchema.safeParse({
          ...validBase,
          followUp: { enabled: true, everyMin: 10, times: 21 },
        }).success,
      ).toBe(false);
    });

    it('enforces hideAfterSec integer bounds (0-600) or null for permanent', () => {
      expect(ReminderSchema.safeParse({ ...validBase, hideAfterSec: null }).success).toBe(true);
      expect(ReminderSchema.safeParse({ ...validBase, hideAfterSec: 0 }).success).toBe(true);
      expect(ReminderSchema.safeParse({ ...validBase, hideAfterSec: 600 }).success).toBe(true);
      expect(ReminderSchema.safeParse({ ...validBase, hideAfterSec: -1 }).success).toBe(false);
      expect(ReminderSchema.safeParse({ ...validBase, hideAfterSec: 601 }).success).toBe(false);
    });
  });

  describe('SettingsSchema validation invariants', () => {
    it('rejects identical quietHours from and to times', () => {
      const invalid = SettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        quietHours: { enabled: true, from: '10:00', to: '10:00' },
      });
      expect(invalid.success).toBe(false);
    });

    it('accepts valid distinct quietHours from and to times', () => {
      const valid = SettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        quietHours: { enabled: true, from: '22:00', to: '07:00' },
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('ActionSchema validation', () => {
    it('validates power actions only from allowed power set', () => {
      expect(ActionSchema.safeParse({ kind: 'power', power: 'lock' }).success).toBe(true);
      expect(ActionSchema.safeParse({ kind: 'power', power: 'sleep' }).success).toBe(true);
      expect(ActionSchema.safeParse({ kind: 'power', power: 'explode' as any }).success).toBe(false);
    });

    it('strictly enforces http or https prefix for link actions', () => {
      expect(
        ActionSchema.safeParse({ kind: 'link', url: 'https://sahaj.si', browser: '', private: false })
          .success,
      ).toBe(true);

      expect(
        ActionSchema.safeParse({ kind: 'link', url: 'http://localhost:5901', browser: '', private: false })
          .success,
      ).toBe(true);

      // Rejects javascript:, file:, or raw text
      expect(
        ActionSchema.safeParse({ kind: 'link', url: 'javascript:alert(1)', browser: '', private: false })
          .success,
      ).toBe(false);

      expect(
        ActionSchema.safeParse({ kind: 'link', url: 'ftp://ftp.example.com', browser: '', private: false })
          .success,
      ).toBe(false);
    });
  });

  describe('TriggerSchema validation', () => {
    it('validates start triggers and bounds delaySec', () => {
      expect(
        TriggerSchema.safeParse({ kind: 'start', when: 'smaran', delaySec: 0 }).success,
      ).toBe(true);

      expect(
        TriggerSchema.safeParse({ kind: 'start', when: 'boot', delaySec: 3600 }).success,
      ).toBe(true);

      expect(
        TriggerSchema.safeParse({ kind: 'start', when: 'boot', delaySec: -1 }).success,
      ).toBe(false);

      expect(
        TriggerSchema.safeParse({ kind: 'start', when: 'boot', delaySec: 3601 }).success,
      ).toBe(false);
    });

    it('validates event triggers and bounds idleMin', () => {
      expect(
        TriggerSchema.safeParse({ kind: 'event', event: 'lock', idleMin: 5 }).success,
      ).toBe(true);

      expect(
        TriggerSchema.safeParse({ kind: 'event', event: 'idle', idleMin: 0 }).success,
      ).toBe(false);

      expect(
        TriggerSchema.safeParse({ kind: 'event', event: 'idle', idleMin: 241 }).success,
      ).toBe(false);
    });
  });
});
