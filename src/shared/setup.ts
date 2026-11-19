// No imports here: the sandboxed setup preload bundles this file.

/**
 * What the setup window shows. Sent from main as the install (or uninstall) runs.
 * Install: 'license' (waiting for a license image) → 'preparing' → 'copying' → 'finishing' →
 * 'done'. Uninstall: 'confirm' → 'removing' → 'done'. Either can end in 'error'.
 */
export type SetupPhase =
  | 'license'
  | 'ready'
  | 'preparing'
  | 'copying'
  | 'finishing'
  | 'confirm'
  | 'removing'
  | 'done'
  | 'error';

export interface SetupProgress {
  phase: SetupPhase;
  /** 0..1 across the whole install or uninstall. */
  progress: number;
  /** Plain-English problem: in the 'error' phase, or why a license image was refused. */
  error?: string;
  /** Who the license is for, once one is accepted. */
  licensee?: string;
}

export interface SetupInit {
  mode: 'install' | 'uninstall';
  version: string;
  dark: boolean;
  /** Where Smaran is (being) installed, shown in small print. */
  target: string;
  /** Pre-loaded licensee name if valid license already exists on disk. */
  licensee?: string;
}
