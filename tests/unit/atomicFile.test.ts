import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  cleanupStaleTempFiles,
  readValidatedJson,
  writeAtomicFile,
} from '../../src/main/store/atomicFile';

describe('atomicFile utility', () => {
  const makeTempDir = () => {
    const dir = path.join(os.tmpdir(), `smaran_atomic_test_${Date.now()}_${Math.random()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  it('performs atomic writes with fsync and backup creation', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'test.json');

    // 1. Initial write
    writeAtomicFile(filePath, JSON.stringify({ hello: 'world' }));
    expect(fs.existsSync(filePath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual({ hello: 'world' });

    // 2. Second write creates .bak
    writeAtomicFile(filePath, JSON.stringify({ hello: 'updated' }), { backup: true });
    const bakPath = `${filePath}.bak`;
    expect(fs.existsSync(bakPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(bakPath, 'utf8'))).toEqual({ hello: 'world' });
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual({ hello: 'updated' });

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('recovers from malformed JSON via .bak and preserves corrupt file', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'data.json');
    const schema = z.object({ count: z.number() });

    // Write valid initial state
    writeAtomicFile(filePath, JSON.stringify({ count: 42 }));
    // Update to create backup
    writeAtomicFile(filePath, JSON.stringify({ count: 100 }), { backup: true });

    // Corrupt main file
    fs.writeFileSync(filePath, '{ corrupt broken json !!!', 'utf8');

    let corruptCalled = false;
    let recoveredCalled = false;
    const res = readValidatedJson(
      filePath,
      schema,
      { count: 0 },
      {
        onCorrupt: () => {
          corruptCalled = true;
        },
        onRecovered: () => {
          recoveredCalled = true;
        },
      },
    );

    expect(corruptCalled).toBe(true);
    expect(recoveredCalled).toBe(true);
    expect(res.recoveredFromBackup).toBe(true);
    expect(res.corruptSaved).toBe(true);
    expect(res.data).toEqual({ count: 42 });

    // Verify .corrupt file was created
    const files = fs.readdirSync(dir);
    const hasCorrupt = files.some((f) => f.includes('data.json.corrupt.'));
    expect(hasCorrupt).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('falls back when both main file and backup are missing or invalid', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'missing.json');
    const schema = z.array(z.string());

    const res = readValidatedJson(filePath, schema, ['fallback']);
    expect(res.data).toEqual(['fallback']);
    expect(res.recoveredFromBackup).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('cleans up abandoned temporary files older than threshold', () => {
    const dir = makeTempDir();
    const now = Date.now();

    const staleTmp = path.join(dir, 'store.json.tmp.1234.1.old');
    const freshTmp = path.join(dir, 'store.json.tmp.1234.2.new');
    const normalFile = path.join(dir, 'store.json');

    fs.writeFileSync(staleTmp, 'stale', 'utf8');
    fs.writeFileSync(freshTmp, 'fresh', 'utf8');
    fs.writeFileSync(normalFile, '{}', 'utf8');

    // Artificial mtime for staleTmp: 10 minutes ago
    const tenMinAgo = (now - 10 * 60 * 1000) / 1000;
    fs.utimesSync(staleTmp, tenMinAgo, tenMinAgo);

    const cleaned = cleanupStaleTempFiles(dir, 'store.json', 5 * 60 * 1000);
    expect(cleaned).toBe(1);
    expect(fs.existsSync(staleTmp)).toBe(false);
    expect(fs.existsSync(freshTmp)).toBe(true);
    expect(fs.existsSync(normalFile)).toBe(true);

    // Missing directory returns 0
    expect(cleanupStaleTempFiles(path.join(dir, 'missing_sub'), 'store.json')).toBe(0);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('handles Buffer writes and backup disabled', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'buffer.txt');

    writeAtomicFile(filePath, Buffer.from('binary-content'), { backup: false });
    expect(fs.readFileSync(filePath, 'utf8')).toBe('binary-content');
    expect(fs.existsSync(`${filePath}.bak`)).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('falls back when main file is corrupted and backup is also corrupted', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'both_bad.json');
    const bakPath = `${filePath}.bak`;
    const schema = z.object({ ok: z.boolean() });

    fs.writeFileSync(filePath, '{ bad json 1', 'utf8');
    fs.writeFileSync(bakPath, '{ bad json 2', 'utf8');

    const res = readValidatedJson(filePath, schema, { ok: false });
    expect(res.data).toEqual({ ok: false });
    expect(res.recoveredFromBackup).toBe(false);
    expect(res.corruptSaved).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
