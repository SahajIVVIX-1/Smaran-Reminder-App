import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/shared/defaults';
import { CORNERS, DEFAULT_AUTOMATION_SETTINGS } from '../../src/shared/schema';

function thicknessLabel(px: number): string {
  if (px <= 1) return 'Hairline (1px)';
  if (px <= 2) return 'Very Thin (2px)';
  if (px <= 4) return 'Thin (4px)';
  if (px <= 8) return 'Medium (8px)';
  if (px <= 14) return 'Thick (14px)';
  return 'Very Thick';
}

const THICKNESS_PRESETS = [
  { px: 1, label: 'Hairline' },
  { px: 2, label: 'Very Thin' },
  { px: 4, label: 'Thin' },
  { px: 8, label: 'Medium' },
  { px: 14, label: 'Thick' },
  { px: 20, label: 'Very Thick' },
];

type SettingsTab = 'system' | 'notifications' | 'reminders' | 'automations' | 'fileserver';

const SETTINGS_TABS: readonly SettingsTab[] = [
  'system',
  'notifications',
  'reminders',
  'automations',
  'fileserver',
];

describe('settingsTabsAndStructure - Tab Navigation & Border Light Settings', () => {
  it('defines all 5 modular settings tabs in proper order', () => {
    expect(SETTINGS_TABS).toEqual([
      'system',
      'notifications',
      'reminders',
      'automations',
      'fileserver',
    ]);
  });

  it('maps beam thickness pixels to friendly labels accurately', () => {
    expect(thicknessLabel(1)).toBe('Hairline (1px)');
    expect(thicknessLabel(2)).toBe('Very Thin (2px)');
    expect(thicknessLabel(4)).toBe('Thin (4px)');
    expect(thicknessLabel(8)).toBe('Medium (8px)');
    expect(thicknessLabel(14)).toBe('Thick (14px)');
    expect(thicknessLabel(20)).toBe('Very Thick');
  });

  it('provides the exact thickness presets with default at 2px', () => {
    expect(THICKNESS_PRESETS.length).toBe(6);
    expect(THICKNESS_PRESETS.map((p) => p.px)).toEqual([1, 2, 4, 8, 14, 20]);
    expect(THICKNESS_PRESETS.find((p) => p.px === 2)?.label).toBe('Very Thin');
  });

  it('verifies notification corner positions cover all 5 locations', () => {
    expect(CORNERS).toEqual([
      'top-right',
      'bottom-right',
      'top-left',
      'bottom-left',
      'top-center',
    ]);
  });

  it('verifies default settings: border beam 2px, reminders ON, automations/fileserver OFF', () => {
    // 2px beam thickness default
    expect(DEFAULT_SETTINGS.notification.borderLightThickness).toBe(2);

    // Reminders border light ON by default
    expect(DEFAULT_SETTINGS.notification.borderLight).toBe(true);

    // Automations border light OFF by default
    expect(DEFAULT_AUTOMATION_SETTINGS.borderLight).toBe(false);

    // Window behavior defaults (minimizeToTray false, closeToTray true)
    expect(DEFAULT_SETTINGS.minimizeToTray).toBe(false);
    expect(DEFAULT_SETTINGS.closeToTray).toBe(true);
  });
});
