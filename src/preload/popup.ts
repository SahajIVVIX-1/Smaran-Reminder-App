import { contextBridge } from 'electron';

// Popup bridge. Phase 3 adds popup:init, popup:measured and popup:done here.
const api = {};

export type SmaranPopupApi = typeof api;

contextBridge.exposeInMainWorld('smaranPopup', api);
