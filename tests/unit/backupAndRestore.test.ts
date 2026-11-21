import { describe, expect, it } from 'vitest';
import { exportJson, mergeReminders, parseBackupJson } from '../../src/main/store/backup';
import { createAutomation, createDefaultConfig, createReminder } from '../../src/shared/defaults';
import { SCHEMA_VERSION, type Config } from '../../src/shared/schema';

describe('backupAndRestore - Backup Serialization, Ingestion & Merging', () => {
  let idCounter = 1;
  const mockNewId = () => `id-gen-${idCounter++}`;
  const opts = {
    newId: mockNewId,
    now: new Date('2026-11-21T12:00:00Z'),
    primaryDisplayId: 1,
  };

  it('exports configuration to valid formatted JSON string with trailing newline', () => {
    const config = createDefaultConfig(mockNewId);
    const jsonStr = exportJson(config);
    expect(jsonStr.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe(SCHEMA_VERSION);
  });

  it('parses valid backup JSON successfully', () => {
    const config = createDefaultConfig(mockNewId);
    const raw = exportJson(config);
    const res = parseBackupJson(raw, opts);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.version).toBe(SCHEMA_VERSION);
    }
  });

  it('strips UTF-8 Byte Order Mark (BOM) before parsing', () => {
    const config = createDefaultConfig(mockNewId);
    const withBom = '\uFEFF' + exportJson(config);
    const res = parseBackupJson(withBom, opts);
    expect(res.ok).toBe(true);
  });

  it('rejects corrupt non-JSON text with clear user-facing error message', () => {
    const invalidText = '<html><body>502 Bad Gateway</body></html>';
    const res = parseBackupJson(invalidText, opts);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('not valid JSON');
    }
  });

  it('rejects backup created by newer version of Smaran', () => {
    const config = createDefaultConfig(mockNewId);
    const newerConfig = {
      ...config,
      version: SCHEMA_VERSION + 2,
    };
    const res = parseBackupJson(JSON.stringify(newerConfig), opts);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('newer version of Smaran');
    }
  });

  it('merges imported reminders without collisions and preserves original IDs when unique', () => {
    const base = createDefaultConfig(mockNewId);
    const r1 = {
      ...createReminder({ title: 'Existing 1', rule: { kind: 'daily', times: ['09:00'] } }, mockNewId),
      id: 'rem-1',
    };
    const r2 = {
      ...createReminder({ title: 'Imported Unique', rule: { kind: 'daily', times: ['14:00'] } }, mockNewId),
      id: 'rem-2',
    };

    const current: Config = {
      ...base,
      reminders: [r1],
      automations: [],
    };

    const imported: Config = {
      ...base,
      reminders: [r2],
      automations: [],
    };

    const merged = mergeReminders(current, imported, mockNewId);
    expect(merged.reminders.length).toBe(2);
    expect(merged.reminders.map((r) => r.id)).toEqual(['rem-1', 'rem-2']);
  });

  it('regenerates reminder ID when imported reminder collides with existing ID', () => {
    const base = createDefaultConfig(mockNewId);
    const r1 = {
      ...createReminder({ title: 'Original Reminder', rule: { kind: 'daily', times: ['09:00'] } }, mockNewId),
      id: 'rem-collision',
    };
    const r2 = {
      ...createReminder({ title: 'Imported Colliding', rule: { kind: 'daily', times: ['14:00'] } }, mockNewId),
      id: 'rem-collision',
    };

    const current: Config = {
      ...base,
      reminders: [r1],
      automations: [],
    };

    const imported: Config = {
      ...base,
      reminders: [r2],
      automations: [],
    };

    const merged = mergeReminders(current, imported, mockNewId);
    expect(merged.reminders.length).toBe(2);
    expect(merged.reminders[0]?.id).toBe('rem-collision');
    expect(merged.reminders[1]?.id).not.toBe('rem-collision');
    expect(merged.reminders[1]?.title).toBe('Imported Colliding');
  });

  it('merges automations alongside reminders', () => {
    const base = createDefaultConfig(mockNewId);
    const a1 = {
      ...createAutomation({
        name: 'Existing Auto',
        trigger: { kind: 'start', when: 'smaran', delaySec: 0 },
        actions: [],
      }, mockNewId),
      id: 'auto-1',
    };
    const a2 = {
      ...createAutomation({
        name: 'Imported Auto',
        trigger: { kind: 'event', event: 'lock', idleMin: 0 },
        actions: [],
      }, mockNewId),
      id: 'auto-1', // Colliding ID
    };

    const current: Config = {
      ...base,
      reminders: [],
      automations: [a1],
    };

    const imported: Config = {
      ...base,
      reminders: [],
      automations: [a2],
    };

    const merged = mergeReminders(current, imported, mockNewId);
    expect(merged.automations.length).toBe(2);
    expect(merged.automations[0]?.id).toBe('auto-1');
    expect(merged.automations[1]?.id).not.toBe('auto-1');
  });
});
