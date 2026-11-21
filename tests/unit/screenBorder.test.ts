import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/defaults';
import { FileServerSettingsSchema } from '@shared/fileserver';
import { PerimeterRect } from '@shared/perimeter';
import { DEFAULT_AUTOMATION_SETTINGS, SettingsSchema } from '@shared/schema';

describe('Screen Border Light settings & schema', () => {
  it('has valid default settings for screen border light with high brightness and 2px thickness', () => {
    expect(DEFAULT_SETTINGS.notification.borderLight).toBe(true);
    expect(DEFAULT_SETTINGS.notification.borderLightThickness).toBe(2);
    expect(DEFAULT_SETTINGS.notification.borderLightBrightness).toBe(150);
  });

  it('defaults automation and fileserver border light to false (opt-in only)', () => {
    expect(DEFAULT_AUTOMATION_SETTINGS.borderLight).toBe(false);
    expect(FileServerSettingsSchema.parse({}).borderLight).toBe(false);
  });

  it('validates window minimize and close tray behavior in settings schema', () => {
    expect(DEFAULT_SETTINGS.minimizeToTray).toBe(false);
    expect(DEFAULT_SETTINGS.closeToTray).toBe(true);

    const parsed = SettingsSchema.parse({
      ...DEFAULT_SETTINGS,
      minimizeToTray: true,
      closeToTray: false,
    });
    expect(parsed.minimizeToTray).toBe(true);
    expect(parsed.closeToTray).toBe(false);
  });

  it('validates thickness within limits (1px to 24px)', () => {
    const valid = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLightThickness: 1,
      },
    });
    expect(valid.success).toBe(true);

    const thick = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLightThickness: 24,
      },
    });
    expect(thick.success).toBe(true);

    const tooThin = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLightThickness: 0,
      },
    });
    expect(tooThin.success).toBe(false);

    const tooThick = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLightThickness: 25,
      },
    });
    expect(tooThick.success).toBe(false);
  });

  it('validates brightness within limits (50% to 200%)', () => {
    const standard = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLightBrightness: 100,
      },
    });
    expect(standard.success).toBe(true);

    const maxBright = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLightBrightness: 200,
      },
    });
    expect(maxBright.success).toBe(true);

    const tooLow = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLightBrightness: 49,
      },
    });
    expect(tooLow.success).toBe(false);

    const tooHigh = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLightBrightness: 201,
      },
    });
    expect(tooHigh.success).toBe(false);
  });

  it('fills default thickness and brightness for older configs that omit them', () => {
    const raw = {
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        borderLight: true,
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (raw.notification as any).borderLightThickness;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (raw.notification as any).borderLightBrightness;

    const parsed = SettingsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.notification.borderLightThickness).toBe(2);
      expect(parsed.data.notification.borderLightBrightness).toBe(150);
    }
  });

  it('decomposes perimeter ranges into continuous straight edge segments without cuts', () => {
    const p = new PerimeterRect();
    p.update(1920, 1080, 4);

    expect(p.totalLength).toBeGreaterThan(0);
    expect(p.totalLength).toBe(p.w * 2 + p.h * 2);

    // Test a beam that wraps across the top-right corner
    const trCornerDist = p.k1; // Top-Right corner position
    const segments = p.getSegments(trCornerDist - 100, trCornerDist + 100);

    expect(segments.length).toBe(2);
    // Segment 1 ends at TR corner
    expect(segments[0]?.pEnd.x).toBeCloseTo(p.v1.x);
    expect(segments[0]?.pEnd.y).toBeCloseTo(p.v1.y);
    // Segment 2 starts at TR corner
    expect(segments[1]?.pStart.x).toBeCloseTo(p.v1.x);
    expect(segments[1]?.pStart.y).toBeCloseTo(p.v1.y);

    // Verify all progress parameters are valid and strictly non-decreasing
    expect(segments[0]?.uStart).toBeCloseTo(0);
    expect(segments[0]?.uEnd).toBeCloseTo(0.5);
    expect(segments[1]?.uStart).toBeCloseTo(0.5);
    expect(segments[1]?.uEnd).toBeCloseTo(1.0);
  });
});
