import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  cleanupStaleTempFiles,
  readValidatedJson,
  writeAtomicFile,
} from '../../src/main/store/atomicFile';

describe('atomicFileResilience - Atomic Disk Persistence & Crash Recovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran_atomic_test_'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const SampleSchema = z.object({
    id: z.string(),
    count: z.number(),
    items: z.array(z.string()),
  });
  type Sample = z.infer<typeof SampleSchema>;

  const defaultSample: Sample = { id: 'default', count: 0, items: [] };

  it('atomically creates target file and automatic .bak copy', () => {
    const targetFile = path.join(tmpDir, 'data.json');
    const backupFile = path.join(tmpDir, 'data.json.bak');

    // First write: creates data.json
    writeAtomicFile(targetFile, JSON.stringify({ id: 'v1', count: 1, items: ['a'] }));
    expect(fs.existsSync(targetFile)).toBe(true);

    // Second write: backs up v1 to data.json.bak, then writes v2
    writeAtomicFile(targetFile, JSON.stringify({ id: 'v2', count: 2, items: ['b'] }));
    expect(fs.existsSync(backupFile)).toBe(true);

    const mainContent = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    const bakContent = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    expect(mainContent.id).toBe('v2');
    expect(bakContent.id).toBe('v1');
  });

  it('preserves corrupt main file and restores cleanly from valid backup', () => {
    const targetFile = path.join(tmpDir, 'config.json');
    const backupFile = path.join(tmpDir, 'config.json.bak');

    const validData: Sample = { id: 'valid-root', count: 42, items: ['alpha', 'beta'] };
    fs.writeFileSync(backupFile, JSON.stringify(validData), 'utf8');

    // Corrupt the main file with truncated half-written JSON
    fs.writeFileSync(targetFile, '{"id":"corrupt", "count": ', 'utf8');

    let corruptCallbackCalled = false;
    let recoveredCallbackCalled = false;

    const res = readValidatedJson(targetFile, SampleSchema, defaultSample, {
      onCorrupt: () => {
        corruptCallbackCalled = true;
      },
      onRecovered: () => {
        recoveredCallbackCalled = true;
      },
    });

    expect(corruptCallbackCalled).toBe(true);
    expect(recoveredCallbackCalled).toBe(true);
    expect(res.recoveredFromBackup).toBe(true);
    expect(res.data).toEqual(validData);

    // Verify a .corrupt.<timestamp> forensics file was preserved
    const files = fs.readdirSync(tmpDir);
    const corruptFiles = files.filter((f) => f.includes('config.json.corrupt.'));
    expect(corruptFiles.length).toBe(1);

    // Verify the main file was self-healed on disk with recovered data
    const healedContent = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    expect(healedContent).toEqual(validData);
  });

  it('falls back to default fallback data if both main and backup files are corrupt', () => {
    const targetFile = path.join(tmpDir, 'broken.json');
    const backupFile = path.join(tmpDir, 'broken.json.bak');

    fs.writeFileSync(targetFile, '{{{invalid json 1', 'utf8');
    fs.writeFileSync(backupFile, '{{{invalid json 2', 'utf8');

    const res = readValidatedJson(targetFile, SampleSchema, defaultSample);
    expect(res.recoveredFromBackup).toBe(false);
    expect(res.data).toEqual(defaultSample);
  });

  it('cleans up stale temp files left behind by interrupted processes', () => {
    const baseName = 'config.json';
    const stale1 = path.join(tmpDir, `${baseName}.tmp.1234.1000000000.abc`);
    const stale2 = path.join(tmpDir, `${baseName}.tmp.5678.1000000001.def`);
    const normal = path.join(tmpDir, `${baseName}.bak`);

    fs.writeFileSync(stale1, 'stale content 1', 'utf8');
    fs.writeFileSync(stale2, 'stale content 2', 'utf8');
    fs.writeFileSync(normal, 'backup content', 'utf8');

    expect(fs.existsSync(stale1)).toBe(true);
    expect(fs.existsSync(stale2)).toBe(true);

    // Passing maxAgeMs = 0 immediately cleans up abandoned temp files
    cleanupStaleTempFiles(tmpDir, baseName, 0);

    expect(fs.existsSync(stale1)).toBe(false);
    expect(fs.existsSync(stale2)).toBe(false);
    expect(fs.existsSync(normal)).toBe(true); // Normal backup untouched
  });

  it('creates parent directories recursively if they do not exist', () => {
    const deepFile = path.join(tmpDir, 'sub1', 'sub2', 'nested.json');
    writeAtomicFile(deepFile, JSON.stringify({ id: 'nested', count: 1, items: [] }));

    expect(fs.existsSync(deepFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(deepFile, 'utf8'));
    expect(content.id).toBe('nested');
  });
});
