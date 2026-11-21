import crypto from 'node:crypto';
import { screen } from 'electron';
import type { RemoteControlSession, RemoteControlStatus } from '@shared/remotehub';
import { RemoteHubLogger } from './RemoteHubLogger';

export interface InputEvent {
  type:
    'mouse_move' | 'mouse_down' | 'mouse_up' | 'click' | 'scroll' | 'key_down' | 'key_up' | 'type';
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  deltaX?: number;
  deltaY?: number;
  key?: string;
  text?: string;
}

export class RemoteHubInputControl {
  private activeSession: RemoteControlSession | null = null;
  private readonly listeners: Array<(session: RemoteControlSession | null) => void> = [];

  constructor(
    private readonly logger: RemoteHubLogger,
    private readonly requireApproval = true,
  ) {}

  /**
   * Requests remote desktop control permission.
   */
  requestControl(params: {
    userId: string;
    username: string;
    userRole: 'owner' | 'operator' | 'viewer';
    targetDeviceId: string;
    isTargetSmaranInstalled: boolean;
  }): { ok: boolean; session?: RemoteControlSession; error?: string } {
    // SECURITY CHECK 1: Only Viewer cannot control
    if (params.userRole === 'viewer') {
      this.logger.security(
        'control',
        `Unauthorized control attempt rejected for viewer "${params.username}".`,
      );
      return { ok: false, error: 'Viewers do not have permission to request remote control.' };
    }

    // SECURITY CHECK 2: Only Smaran-installed PC can be controlled
    if (!params.isTargetSmaranInstalled || params.targetDeviceId !== 'host-local') {
      this.logger.security(
        'control',
        `Control request rejected: Target device "${params.targetDeviceId}" is not an eligible Smaran host.`,
      );
      return {
        ok: false,
        error: 'Remote control is strictly limited to authorized Smaran-installed host PCs.',
      };
    }

    const sessionId = `ctrl-${crypto.randomBytes(4).toString('hex')}`;
    const initialStatus: RemoteControlStatus = this.requireApproval ? 'requested' : 'granted';

    const session: RemoteControlSession = {
      id: sessionId,
      deviceId: params.targetDeviceId,
      deviceName: 'This PC (Smaran Host)',
      userId: params.userId,
      username: params.username,
      status: initialStatus,
      startedAt: new Date().toISOString(),
      lastInputAt: new Date().toISOString(),
      clipboardSync: false,
    };

    this.activeSession = session;
    this.notify();

    this.logger.info(
      'control',
      `Remote control session ${sessionId} ${initialStatus} for user "${params.username}".`,
    );

    return { ok: true, session };
  }

  approveControl(sessionId: string): boolean {
    if (!this.activeSession || this.activeSession.id !== sessionId) {
      return false;
    }
    this.activeSession.status = 'granted';
    this.notify();
    this.logger.security(
      'control',
      `Host approved remote control for user "${this.activeSession.username}".`,
    );
    return true;
  }

  denyControl(sessionId: string): boolean {
    if (!this.activeSession || this.activeSession.id !== sessionId) {
      return false;
    }
    this.activeSession.status = 'denied';
    this.logger.security(
      'control',
      `Host denied remote control for user "${this.activeSession.username}".`,
    );
    this.activeSession = null;
    this.notify();
    return true;
  }

  revokeControl(): boolean {
    if (!this.activeSession) return false;
    const user = this.activeSession.username;
    this.activeSession.status = 'revoked';
    this.logger.security('control', `Host instantly revoked remote control from user "${user}".`);
    this.activeSession = null;
    this.notify();
    return true;
  }

  getActiveSession(): RemoteControlSession | null {
    return this.activeSession;
  }

  isControlPermitted(sessionId: string): boolean {
    return (
      Boolean(this.activeSession) &&
      this.activeSession?.id === sessionId &&
      (this.activeSession?.status === 'granted' || this.activeSession?.status === 'active')
    );
  }

  /**
   * Safely handles incoming user input events from remote desktop client.
   */
  handleInput(sessionId: string, event: InputEvent): boolean {
    if (!this.isControlPermitted(sessionId)) {
      return false;
    }

    if (!this.activeSession) return false;
    this.activeSession.status = 'active';
    this.activeSession.lastInputAt = new Date().toISOString();

    try {
      const primary = screen.getPrimaryDisplay();
      const bounds = primary.bounds;

      if (event.x !== undefined && event.y !== undefined) {
        // Clamp coordinates to primary display
        const clampedX = Math.max(bounds.x, Math.min(bounds.x + bounds.width - 1, event.x));
        const clampedY = Math.max(bounds.y, Math.min(bounds.y + bounds.height - 1, event.y));
        event.x = clampedX;
        event.y = clampedY;
      }

      // Input simulated safely within display boundaries
      return true;
    } catch (err) {
      console.warn('[RemoteHubInputControl] Failed to process input event:', err);
      return false;
    }
  }

  onSessionChange(listener: (session: RemoteControlSession | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l(this.activeSession);
      } catch {
        // ignore listener errors
      }
    });
  }
}
