import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/defaults';
import { SettingsSchema } from '@shared/schema';

describe('Screen Border Light settings & schema', () => {
  it('has valid default settings for screen border light with high brightness', () => {
    expect(DEFAULT_SETTINGS.notification.borderLight).toBe(true);
    expect(DEFAULT_SETTINGS.notification.borderLightThickness).toBe(4);
    expect(DEFAULT_SETTINGS.notification.borderLightBrightness).toBe(150);
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
      expect(parsed.data.notification.borderLightThickness).toBe(4);
      expect(parsed.data.notification.borderLightBrightness).toBe(150);
    }
  });
});
