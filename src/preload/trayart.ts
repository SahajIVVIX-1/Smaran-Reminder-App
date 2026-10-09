import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '@shared/channels';
import type { LogoFrame, LogoPlay } from '@shared/logoArt';

// Sandboxed preloads may only require 'electron', so the channel names are repeated here;
// `satisfies` keeps them in step with IPC.
const CH = {
  logoPlay: 'logo:play',
  logoFrame: 'logo:frame',
} as const satisfies Partial<typeof IPC>;

const api = {
  onPlay: (listener: (play: LogoPlay) => void): void => {
    ipcRenderer.on(CH.logoPlay, (_event, play: LogoPlay) => listener(play));
  },
  frame: (frame: LogoFrame): void => ipcRenderer.send(CH.logoFrame, frame),
};

export type SmaranLogoApi = typeof api;

contextBridge.exposeInMainWorld('smaranLogo', api);
