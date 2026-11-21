import { createDefaultConfig, createReminder, createAutomation, defaultAction } from '../../src/shared/defaults';
import type { Config, HistoryEntry, Reminder, Automation } from '../../src/shared/schema';

/**
 * Creates a clean test configuration seeded with fast timeouts, disabled sound,
 * and onboarded flag set to true so tests don't get blocked by the welcome dialog.
 */
export function createTestConfig(modifier?: (c: Config) => void): Config {
  const config = createDefaultConfig();
  config.settings.onboarded = true;
  config.settings.startAtLogin = false;
  config.settings.holdWhenBusy = false;
  config.settings.notification.sound = false;
  config.settings.notification.hideAfterSec = 4;
  config.settings.notification.corner = 'bottom-right';

  if (modifier) {
    modifier(config);
  }
  return config;
}

/**
 * Factory for mock reminders using schema-compliant defaults.
 */
export function mockReminder(overrides: Partial<Reminder> = {}): Reminder {
  const base = createReminder({
    title: overrides.title || 'Test Reminder',
    note: overrides.note ?? 'Automated test note',
    rule: overrides.rule ?? { kind: 'daily', times: ['12:00'] },
    lines: overrides.lines ?? [],
  });

  return {
    ...base,
    ...overrides,
  };
}

/**
 * Factory for mock automations using schema-compliant defaults.
 */
export function mockAutomation(overrides: Partial<Automation> = {}): Automation {
  const base = createAutomation({
    name: overrides.name || 'Test Automation',
    trigger: overrides.trigger ?? { kind: 'schedule', rule: { kind: 'daily', times: ['14:00'] } },
    actions: [defaultAction('power')],
  });

  return {
    ...base,
    ...overrides,
  };
}

/**
 * Factory for mock history items using schema-compliant fields.
 */
export function mockHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  const now = new Date().toISOString();
  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reminderId: overrides.reminderId || 'rem-test-1',
    title: overrides.title || 'Morning Meditation',
    dueAt: overrides.dueAt || now,
    at: overrides.at || now,
    outcome: overrides.outcome || 'done',
    category: overrides.category || 'reminders',
    severity: overrides.severity || 'success',
    detail: overrides.detail || '',
    ...overrides,
  };
}
