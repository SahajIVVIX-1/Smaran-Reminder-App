// No imports here: the sandboxed setup preload bundles this file.

/** What the setup window shows. Sent from main as the install runs. */
/** 'license': waiting for a license image before installing. */
export type SetupPhase = 'license' | 'preparing' | 'copying' | 'finishing' | 'done' | 'error';

export interface SetupProgress {
  phase: SetupPhase;
  /** 0..1 across the whole install. */
  progress: number;
  /** Plain-English problem: in the 'error' phase, or why a license image was refused. */
  error?: string;
  /** Who the license is for, once one is accepted. */
  licensee?: string;
}

export interface SetupInit {
  version: string;
  dark: boolean;
  /** Where Smaran is being installed, shown in small print. */
  target: string;
}
