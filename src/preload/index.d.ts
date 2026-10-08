import type { SmaranApi } from './settings';
import type { SmaranPopupApi } from './popup';

declare global {
  interface Window {
    smaran: SmaranApi;
    smaranPopup: SmaranPopupApi;
  }
}

export {};
