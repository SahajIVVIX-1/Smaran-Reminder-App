import type { SmaranApi } from './app';
import type { SmaranLogoApi } from './trayart';
import type { SmaranMenuApi } from './menu';
import type { SmaranNotificationApi } from './notification';

declare global {
  interface Window {
    smaran: SmaranApi;
    smaranNotification: SmaranNotificationApi;
    smaranMenu: SmaranMenuApi;
    smaranLogo: SmaranLogoApi;
  }
}

export {};
