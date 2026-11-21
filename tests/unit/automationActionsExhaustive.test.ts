import { describe, expect, it } from 'vitest';
import { privateFlag } from '../../src/main/automations/actions';
import { ActionSchema, type PowerAction } from '@shared/schema';

describe('automationActionsExhaustive - Action Dispatcher & Browser Switches', () => {
  describe('privateFlag browser mapping', () => {
    it('returns --incognito for Chromium-based browsers', () => {
      expect(privateFlag('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')).toBe('--incognito');
      expect(privateFlag('brave.exe')).toBe('--incognito');
      expect(privateFlag('vivaldi.exe')).toBe('--incognito');
      expect(privateFlag('chromium.exe')).toBe('--incognito');
    });

    it('returns --inprivate for Microsoft Edge', () => {
      expect(privateFlag('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')).toBe('--inprivate');
    });

    it('returns -private-window for Mozilla Firefox', () => {
      expect(privateFlag('C:\\Program Files\\Mozilla Firefox\\firefox.exe')).toBe('-private-window');
    });

    it('returns --private for Opera and Opera Launcher', () => {
      expect(privateFlag('opera.exe')).toBe('--private');
      expect(privateFlag('launcher.exe')).toBe('--private');
    });

    it('returns null for unknown or generic executables', () => {
      expect(privateFlag('notepad.exe')).toBeNull();
      expect(privateFlag('custom-app.exe')).toBeNull();
    });
  });

  describe('Power action parameter integrity', () => {
    const powerActions: PowerAction[] = [
      'lock',
      'signOut',
      'sleep',
      'hibernate',
      'shutdown',
      'restart',
    ];

    it('validates all power actions in schema', () => {
      for (const act of powerActions) {
        const res = ActionSchema.safeParse({ kind: 'power', power: act });
        expect(res.success).toBe(true);
      }
    });
  });

  describe('Open and Link action sanitization', () => {
    it('accepts executable open actions with valid args', () => {
      const openApp = ActionSchema.safeParse({
        kind: 'open',
        what: 'app',
        path: 'C:\\Windows\\notepad.exe',
        args: 'test.txt',
        hidden: false,
      });
      expect(openApp.success).toBe(true);
    });

    it('rejects empty paths in open actions', () => {
      const emptyPath = ActionSchema.safeParse({
        kind: 'open',
        what: 'app',
        path: '',
        args: '',
        hidden: false,
      });
      expect(emptyPath.success).toBe(false);
    });

    it('validates link actions with browser overrides', () => {
      const validLink = ActionSchema.safeParse({
        kind: 'link',
        url: 'https://sahaj.si/docs',
        browser: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        private: true,
      });
      expect(validLink.success).toBe(true);
    });
  });
});
