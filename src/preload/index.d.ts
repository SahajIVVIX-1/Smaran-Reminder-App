import type { SmaranApi } from './app';
import type { SmaranNotificationApi } from './notification';

declare global {
  interface Window {
    smaran: SmaranApi;
    smaranNotification: SmaranNotificationApi;
  }
}

export {};
