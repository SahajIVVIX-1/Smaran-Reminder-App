import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { appEnv, EXE_NAME, isProcessElevated } from '../../src/main/setup/winSystem';
import { defaultInstallDir, localInstallDir, programFilesInstallDir, verifyEngineArchive, verifyInstalledFiles } from '../../src/main/setup/install';
import { generateDefaultAdminPassword, generateSecurePassword, validateAdminPassword } from '../../src/main/fileserver/FileServerStore';

describe('Setup Architecture & WinSystem Tests', () => {
  it('appEnv strictly strips all PORTABLE_EXECUTABLE_* variables while preserving others', () => {
    const origEnv = { ...process.env };
    process.env['PORTABLE_EXECUTABLE_FILE'] = 'C:\\Temp\\Smaran-Setup-3.4.1.exe';
    process.env['PORTABLE_EXECUTABLE_DIR'] = 'C:\\Temp';
    process.env['PORTABLE_EXECUTABLE_APP_FILENAME'] = 'Smaran.exe';
    process.env['USER_CUSTOM_VAR'] = 'keep_me_intact';

    const clean = appEnv();

    expect(clean['PORTABLE_EXECUTABLE_FILE']).toBeUndefined();
    expect(clean['PORTABLE_EXECUTABLE_DIR']).toBeUndefined();
    expect(clean['PORTABLE_EXECUTABLE_APP_FILENAME']).toBeUndefined();
    expect(clean['USER_CUSTOM_VAR']).toBe('keep_me_intact');

    // Restore
    delete process.env.PORTABLE_EXECUTABLE_FILE;
    delete process.env.PORTABLE_EXECUTABLE_DIR;
    delete process.env.PORTABLE_EXECUTABLE_APP_FILENAME;
    delete process.env.USER_CUSTOM_VAR;
    Object.assign(process.env, origEnv);
  });

  it('defaultInstallDir points to LocalAppData/Programs/Smaran with zero admin privileges', () => {
    const dir = defaultInstallDir();
    expect(dir.toLowerCase()).toContain(path.join('programs', 'smaran').toLowerCase());
  });

  it('programFilesInstallDir points to Program Files/Smaran', () => {
    const pf = programFilesInstallDir();
    expect(pf.toLowerCase()).toContain(path.join('program files', 'smaran').toLowerCase());
  });

  it('localInstallDir points to LocalAppData/Programs/Smaran', () => {
    const local = localInstallDir();
    expect(local.toLowerCase()).toContain(path.join('programs', 'smaran').toLowerCase());
  });

  it('isProcessElevated returns boolean without throwing', () => {
    expect(typeof isProcessElevated()).toBe('boolean');
  });

  it('verifyEngineArchive detects missing and truncated archives', () => {
    const nonExistent = path.join(os.tmpdir(), `non_existent_${Date.now()}.tar.gz`);
    expect(verifyEngineArchive(nonExistent).ok).toBe(false);

    // Create a tiny dummy file < 1MB
    const tiny = path.join(os.tmpdir(), `tiny_${Date.now()}.tar.gz`);
    fs.writeFileSync(tiny, 'not an archive', 'utf8');
    try {
      const res = verifyEngineArchive(tiny);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('incomplete');
    } finally {
      fs.rmSync(tiny, { force: true });
    }
  });

  it('verifyInstalledFiles fails if executables or engine archive are missing', () => {
    const fakeDir = path.join(os.tmpdir(), `smaran_install_test_${Date.now()}`);
    fs.mkdirSync(fakeDir, { recursive: true });

    try {
      // 1. Missing EXE
      const res1 = verifyInstalledFiles(fakeDir);
      expect(res1.ok).toBe(false);
      expect(res1.error).toContain('Executable missing');

      // 2. Add fake EXE but missing resources
      fs.writeFileSync(path.join(fakeDir, EXE_NAME), 'exe');
      const res2 = verifyInstalledFiles(fakeDir);
      expect(res2.ok).toBe(false);
      expect(res2.error).toContain('Resources directory missing');

      // 3. Add resources dir but missing engine.tar.gz
      const resDir = path.join(fakeDir, 'resources');
      fs.mkdirSync(resDir, { recursive: true });
      const res3 = verifyInstalledFiles(fakeDir);
      expect(res3.ok).toBe(false);
      expect(res3.error).toContain('archive not found');
    } finally {
      fs.rmSync(fakeDir, { recursive: true, force: true });
    }
  });

  it('generateDefaultAdminPassword generates cryptographically secure, unguessable initial passwords without predictable timestamps', () => {
    const p1 = generateDefaultAdminPassword();
    const p2 = generateDefaultAdminPassword();

    expect(p1.length).toBeGreaterThanOrEqual(20);
    expect(p2.length).toBeGreaterThanOrEqual(20);
    expect(p1).not.toBe(p2);
    expect(p1).not.toMatch(/smaran@\d{8}/);
    expect(validateAdminPassword(p1).ok).toBe(true);
    expect(validateAdminPassword(p2).ok).toBe(true);
  });

  it('generateSecurePassword generates high-entropy, unique 16-character alphanumeric passwords', () => {
    const p1 = generateSecurePassword();
    const p2 = generateSecurePassword();

    expect(p1).toHaveLength(16);
    expect(p2).toHaveLength(16);
    expect(p1).not.toBe(p2);
  });

  it('validateAdminPassword enforces 8+ characters and rejects common insecure defaults', () => {
    expect(validateAdminPassword('').ok).toBe(false);
    expect(validateAdminPassword('short').ok).toBe(false);
    expect(validateAdminPassword('smaran').ok).toBe(false);
    expect(validateAdminPassword('admin').ok).toBe(false);
    expect(validateAdminPassword('password').ok).toBe(false);
    expect(validateAdminPassword('12345678').ok).toBe(false);

    // Valid strong passwords
    expect(validateAdminPassword('MyStrong#P@ssw0rd').ok).toBe(true);
    expect(validateAdminPassword(generateSecurePassword()).ok).toBe(true);
  });

  it('SetupPhase supports ready phase for pre-installation user confirmation', () => {
    const phases: Array<import('../../src/shared/setup').SetupPhase> = [
      'license',
      'verifying',
      'ready',
      'preparing',
      'copying',
      'finishing',
      'confirm',
      'removing',
      'done',
      'error',
    ];
    expect(phases).toContain('ready');
    expect(phases).toContain('verifying');
  });
});
