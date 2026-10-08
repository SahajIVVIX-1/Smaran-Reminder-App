import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { csvToMessages, messagesToCsv, parseCsv } from '@shared/csv';
import { createDefaultConfig } from '@shared/defaults';
import { ConfigSchema, type Message } from '@shared/schema';
import { exportJson, mergeConfigs, parseBackupJson } from '../../src/main/store/backup';

let n = 0;
const opts = () => ({
  newId: () => `new-${++n}`,
  now: new Date('2026-10-08T09:00:00Z'),
  primaryDisplayId: 1,
});

describe('JSON backup', () => {
  it('export → import round-trips byte for byte, ids kept', () => {
    const config = createDefaultConfig();
    config.messages[0]!.tags = ['a', 'b'];
    const exported = exportJson(config);
    const imported = parseBackupJson(exported, opts());
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(exportJson(imported.config)).toBe(exported);
    expect(imported.config.messages[0]?.id).toBe(config.messages[0]?.id);
  });

  it('accepts a byte-order mark', () => {
    const result = parseBackupJson(`\uFEFF${exportJson(createDefaultConfig())}`, opts());
    expect(result.ok).toBe(true);
  });

  it('explains what is wrong with a bad file', () => {
    const notJson = parseBackupJson('nope', opts());
    expect(!notJson.ok && notJson.error).toContain('not valid JSON');
    const invalid = parseBackupJson('{"version":1,"styles":[]}', opts());
    expect(!invalid.ok && invalid.error).toContain('not a valid Smaran backup');
    const newer = parseBackupJson('{"version":42}', opts());
    expect(!newer.ok && newer.error).toContain('newer version of Smaran (format 42)');
  });

  it('reads a v1 settings file too', () => {
    const v1 = readFileSync(
      join(__dirname, '..', 'fixtures', 'v1', 'smaran_settings.default.json'),
      'utf8',
    );
    const result = parseBackupJson(v1, opts());
    expect(result.ok && result.config.messages).toHaveLength(3);
  });
});

describe('mergeConfigs', () => {
  it('adds styles, messages and schedules, keeping the current default style', () => {
    const current = createDefaultConfig();
    const imported = createDefaultConfig();
    const merged = mergeConfigs(current, imported, () => crypto.randomUUID());
    expect(ConfigSchema.safeParse(merged).success).toBe(true);
    expect(merged.messages).toHaveLength(2);
    expect(merged.styles.filter((s) => s.isDefault).map((s) => s.id)).toEqual([
      current.styles[0]?.id,
    ]);
    expect(Object.keys(merged.runtime)).toHaveLength(2);
  });

  it('gives colliding ids new ones and rewires references', () => {
    const current = createDefaultConfig();
    const imported = structuredClone(current); // every id collides
    const schedule = imported.schedules[0]!;
    schedule.picker = { mode: 'fixed', messageId: imported.messages[0]!.id };
    imported.runtime[schedule.id] = {
      ...imported.runtime[schedule.id]!,
      lastMessageId: imported.messages[0]!.id,
      shuffleBag: [imported.messages[0]!.id],
    };
    const merged = mergeConfigs(current, imported, () => crypto.randomUUID());
    expect(ConfigSchema.safeParse(merged).success).toBe(true);
    const added = merged.messages[1]!;
    expect(added.id).not.toBe(current.messages[0]?.id);
    expect(added.styleId).toBe(merged.styles[1]?.id);
    const newSchedule = merged.schedules[1]!;
    expect(newSchedule.picker.messageId).toBe(added.id);
    expect(merged.runtime[newSchedule.id]).toMatchObject({
      lastMessageId: added.id,
      shuffleBag: [added.id],
    });
  });

  it('keeps a missing runtime missing and a null last message null', () => {
    const current = createDefaultConfig();
    const imported = createDefaultConfig();
    imported.runtime = {};
    const merged = mergeConfigs(current, imported, () => crypto.randomUUID());
    expect(merged.runtime[imported.schedules[0]!.id]?.lastMessageId).toBeNull();
  });
});

describe('CSV', () => {
  const style = 'style-1';
  const message = (text: string, tags: string[] = [], enabled = true): Message => ({
    id: text,
    text,
    tags,
    enabled,
    styleId: style,
    overrides: {},
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  });

  it('round-trips text with commas, quotes, line breaks, tags and enabled', () => {
    const messages = [
      message('Plain'),
      message('Comma, "quoted"\nand a new line', ['a', 'b'], false),
      message(' leading space'),
    ];
    const csv = messagesToCsv(messages);
    expect(csv.startsWith('text,tags,enabled\r\n')).toBe(true);
    const back = csvToMessages(csv, { styleId: style, newId: () => 'x', now: new Date() });
    expect(back.messages.map((m) => [m.text, m.tags, m.enabled])).toEqual([
      ['Plain', [], true],
      ['Comma, "quoted"\nand a new line', ['a', 'b'], false],
      ['leading space', [], true],
    ]);
  });

  it('reads files without a header, skips blank and GLOBAL rows', () => {
    const csv = 'Drink water,health;water,yes\n\nGLOBAL,,\n ,x,\nStretch\r\nOff,,0\n';
    const back = csvToMessages(csv, { styleId: style, newId: () => 'x', now: new Date() });
    expect(back.messages.map((m) => [m.text, m.tags, m.enabled, m.styleId])).toEqual([
      ['Drink water', ['health', 'water'], true, style],
      ['Stretch', [], true, style],
      ['Off', [], false, style],
    ]);
    expect(back.skipped).toBe(2);
  });

  it('finds columns by header name in any order and tolerates missing columns', () => {
    const csv = '\uFEFFenabled,text\nfalse,Hello';
    const back = csvToMessages(csv, { styleId: style, newId: () => 'x', now: new Date() });
    expect(back.messages.map((m) => [m.text, m.tags, m.enabled])).toEqual([['Hello', [], false]]);
  });

  it('parseCsv handles a last line without a newline and doubled quotes', () => {
    expect(parseCsv('a,"b ""c"""\nd,e')).toEqual([
      ['a', 'b "c"'],
      ['d', 'e'],
    ]);
    expect(parseCsv('x,\n')).toEqual([['x', '']]);
  });
});

describe('edge cases', () => {
  const opts2 = { styleId: 's', newId: () => 'x', now: new Date() };

  it('an empty CSV gives no messages', () => {
    expect(csvToMessages('', opts2)).toEqual({ messages: [], skipped: 0 });
  });

  it('short rows are read as missing cells', () => {
    const back = csvToMessages('tags,text,enabled\nonly-tags\nt,Hello', opts2);
    expect(back.messages.map((m) => [m.text, m.enabled])).toEqual([['Hello', true]]);
    expect(back.skipped).toBe(1);
  });

  it('merging keeps references to messages whose ids did not collide', () => {
    const current = createDefaultConfig();
    const imported = createDefaultConfig();
    imported.schedules[0]!.picker = { mode: 'fixed', messageId: imported.messages[0]!.id };
    const merged = mergeConfigs(current, imported, () => crypto.randomUUID());
    expect(merged.schedules[1]?.picker.messageId).toBe(imported.messages[0]!.id);
  });
});

it('a CSV without an enabled column imports messages as enabled', () => {
  const back = csvToMessages('text,tags\nHi,a', {
    styleId: 's',
    newId: () => 'x',
    now: new Date(),
  });
  expect(back.messages.map((m) => [m.text, m.tags, m.enabled])).toEqual([['Hi', ['a'], true]]);
});
