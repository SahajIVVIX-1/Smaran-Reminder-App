import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/store/migrations/index';
import { SCHEMA_VERSION } from '../../src/shared/schema';

describe('migrationsPipeline - Schema Evolution Across Smaran Generations', () => {
  const opts = {
    newId: () => 'test-id-1234',
    now: new Date('2026-11-21T12:00:00Z'),
    primaryDisplayId: 1,
  };

  it('rejects future schema versions greater than SCHEMA_VERSION', () => {
    const future = { version: SCHEMA_VERSION + 1, reminders: [] };
    const res = migrate(future, opts);
    expect(res.kind).toBe('newer');
    if (res.kind === 'newer') {
      expect(res.version).toBe(SCHEMA_VERSION + 1);
    }
  });

  it('treats version equal to SCHEMA_VERSION as current', () => {
    const current = { version: SCHEMA_VERSION, reminders: [] };
    const res = migrate(current, opts);
    expect(res.kind).toBe('current');
    if (res.kind === 'current') {
      expect(res.raw).toBe(current);
    }
  });

  it('migrates v5 (Smaran 2.13) up to current version (v6)', () => {
    const v5Data = {
      version: 5,
      reminders: [],
      sound: { enabled: true, pack: 'classic', volume: 0.8 },
      look: { theme: 'slate', font: 'system', animateLogo: true },
    };

    const res = migrate(v5Data, opts);
    expect(res.kind).toBe('migrated');
    if (res.kind === 'migrated') {
      expect(res.from).toBe('Smaran 2.13');
      expect(res.quiet).toBe(true);
      const data = res.raw as any;
      expect(data.version).toBe(6);
      expect(data.automations).toBeDefined();
    }
  });

  it('migrates v4 (Smaran 2.12) sequentially through v5 to v6', () => {
    const v4Data = {
      version: 4,
      reminders: [],
      sound: { enabled: true, pack: 'classic', volume: 0.8 },
    };

    const res = migrate(v4Data, opts);
    expect(res.kind).toBe('migrated');
    if (res.kind === 'migrated') {
      expect(res.from).toBe('Smaran 2.12');
      const data = res.raw as any;
      expect(data.version).toBe(6);
      expect(data.automations).toBeDefined();
    }
  });

  it('migrates v3 (Smaran 2.7) through all migration steps up to v6', () => {
    const v3Data = {
      version: 3,
      reminders: [],
    };

    const res = migrate(v3Data, opts);
    expect(res.kind).toBe('migrated');
    if (res.kind === 'migrated') {
      expect(res.from).toBe('Smaran 2.7');
      const data = res.raw as any;
      expect(data.version).toBe(6);
    }
  });

  it('migrates v2 (Smaran 2.1) cleanly up to v6', () => {
    const v2Data = {
      version: 2,
      reminders: [],
    };

    const res = migrate(v2Data, opts);
    expect(res.kind).toBe('migrated');
    if (res.kind === 'migrated') {
      expect(res.from).toBe('Smaran 2.1');
      const data = res.raw as any;
      expect(data.version).toBe(6);
    }
  });

  it('recognizes legacy Python v1 format and migrates to current schema', () => {
    // V1 Python settings shape
    const v1Settings = {
      messages: [{ text: 'Drink water', time: '10:00' }],
      general: { theme: 'dark' },
    };

    const res = migrate(v1Settings, opts);
    expect(res.kind).toBe('migrated');
    if (res.kind === 'migrated') {
      expect(res.from).toBe('Smaran v1');
      const data = res.raw as any;
      expect(data.version).toBe(6); // migrates fully up to current SCHEMA_VERSION
    }
  });
});
