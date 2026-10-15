import type { SmaranApi } from './app';
import type { SmaranLogoApi } from './trayart';
import type { SmaranMenuApi } from './menu';
import type { SmaranNotificationApi } from './notification';
import type { SmaranSetupApi } from './setup';
import type { SmaranLicenseApi } from './license';

declare global {
  interface Window {
    smaran: SmaranApi;
    smaranNotification: SmaranNotificationApi;
    smaranMenu: SmaranMenuApi;
    smaranLogo: SmaranLogoApi;
    smaranSetup: SmaranSetupApi;
    smaranLicense: SmaranLicenseApi;
  }
}

export {};
