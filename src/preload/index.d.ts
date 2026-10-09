import type { SmaranApi } from './app';
import type { SmaranMenuApi } from './menu';
import type { SmaranNotificationApi } from './notification';

declare global {
  interface Window {
    smaran: SmaranApi;
    smaranNotification: SmaranNotificationApi;
    smaranMenu: SmaranMenuApi;
  }
}

export {};
