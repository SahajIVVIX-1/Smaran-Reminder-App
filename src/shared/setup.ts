// No imports here: the sandboxed setup preload bundles this file.

/** What the setup window shows. Sent from main as the install runs. */
export type SetupPhase = 'preparing' | 'copying' | 'finishing' | 'done' | 'error';

export interface SetupProgress {
  phase: SetupPhase;
  /** 0..1 across the whole install. */
  progress: number;
  /** Plain-English problem, only in the 'error' phase. */
  error?: string;
}

export interface SetupInit {
  version: string;
  dark: boolean;
  /** Where Smaran is being installed, shown in small print. */
  target: string;
}
