import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import type { RemoteHubUser, UserRole } from '@shared/remotehub';
import { readValidatedJson, writeAtomicFile } from '../store/atomicFile';

interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  salt: string;
  hash: string;
  enabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
  loginCount: number;
}

interface UserSession {
  token: string;
  userId: string;
  role: UserRole;
  expiresAt: number;
  ip?: string;
}

interface FailedAttempt {
  count: number;
  lockedUntil: number;
}

const StoredUsersSchema = z.array(
  z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    role: z.enum(['owner', 'operator', 'viewer']),
    salt: z.string(),
    hash: z.string(),
    enabled: z.boolean().default(true),
    createdAt: z.string(),
    lastLoginAt: z.string().optional(),
    loginCount: z.number().int().default(0),
  }),
);

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const computedHash = crypto.scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (computedHash.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(computedHash, expectedBuf);
  } catch {
    return false;
  }
}

export class RemoteHubUserStore {
  private users: StoredUser[] = [];
  private readonly sessions = new Map<string, UserSession>();
  private readonly failedAttempts = new Map<string, FailedAttempt>();
  private readonly usersFilePath: string;

  constructor(dataDir: string) {
    this.usersFilePath = path.join(dataDir, 'remotehub-users.json');
    this.users = this.load();
  }

  private load(): StoredUser[] {
    const result = readValidatedJson<StoredUser[]>(this.usersFilePath, StoredUsersSchema, [], {
      onRecovered: (msg) => console.log(`[RemoteHubUserStore] ${msg}`),
      onCorrupt: (err, p) =>
        console.warn(`[RemoteHubUserStore] Corrupt users preserved to ${p}:`, err),
    });
    return result.data;
  }

  private persist(): void {
    writeAtomicFile(this.usersFilePath, JSON.stringify(this.users, null, 2), { backup: true });
  }

  hasOwner(): boolean {
    return this.users.some((u) => u.role === 'owner' && u.enabled);
  }

  createOwner(username: string, pass: string, displayName: string): RemoteHubUser {
    if (this.hasOwner()) {
      throw new Error('An administrator owner account has already been initialized.');
    }
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (!pass || pass.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(pass, salt);

    const owner: StoredUser = {
      id: crypto.randomUUID(),
      username: cleanUser,
      displayName: displayName.trim() || 'Administrator',
      role: 'owner',
      salt,
      hash,
      enabled: true,
      createdAt: new Date().toISOString(),
      loginCount: 0,
    };

    this.users.push(owner);
    this.persist();

    return this.toPublicUser(owner);
  }

  authenticate(
    username: string,
    pass: string,
    ip?: string,
    sessionTimeoutMinutes = 120,
  ): { ok: boolean; user?: RemoteHubUser; sessionToken?: string; error?: string } {
    const cleanUser = username.trim().toLowerCase();
    const rateLimitKey = `${ip || 'local'}:${cleanUser}`;
    const now = Date.now();

    // Rate limiting check
    const attempt = this.failedAttempts.get(rateLimitKey);
    if (attempt && attempt.lockedUntil > now) {
      const remainingSec = Math.ceil((attempt.lockedUntil - now) / 1000);
      return {
        ok: false,
        error: `Too many failed login attempts. Account temporarily locked for ${remainingSec}s.`,
      };
    }

    const user = this.users.find((u) => u.username === cleanUser);
    if (!user || !user.enabled) {
      this.recordFailedAttempt(rateLimitKey);
      return { ok: false, error: 'Invalid username or password.' };
    }

    const valid = verifyPassword(pass, user.salt, user.hash);
    if (!valid) {
      this.recordFailedAttempt(rateLimitKey);
      return { ok: false, error: 'Invalid username or password.' };
    }

    // Reset failed attempts on success
    this.failedAttempts.delete(rateLimitKey);

    // Update user stats
    user.lastLoginAt = new Date().toISOString();
    user.loginCount++;
    this.persist();

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, {
      token,
      userId: user.id,
      role: user.role,
      expiresAt: now + sessionTimeoutMinutes * 60_000,
      ip,
    });

    return {
      ok: true,
      user: this.toPublicUser(user),
      sessionToken: token,
    };
  }

  private recordFailedAttempt(key: string): void {
    const attempt = this.failedAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
    attempt.count++;
    if (attempt.count >= 5) {
      attempt.lockedUntil = Date.now() + 15 * 60_000; // 15 min lockout
    }
    this.failedAttempts.set(key, attempt);
  }

  validateSession(token: string): { valid: boolean; user?: RemoteHubUser } {
    if (!token) return { valid: false };
    const session = this.sessions.get(token);
    if (!session) return { valid: false };

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false };
    }

    const user = this.users.find((u) => u.id === session.userId);
    if (!user || !user.enabled) {
      this.sessions.delete(token);
      return { valid: false };
    }

    return { valid: true, user: this.toPublicUser(user) };
  }

  revokeSession(token: string): void {
    this.sessions.delete(token);
  }

  revokeAllUserSessions(userId: string): void {
    for (const [token, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(token);
      }
    }
  }

  createUser(username: string, pass: string, displayName: string, role: UserRole): RemoteHubUser {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (this.users.some((u) => u.username === cleanUser)) {
      throw new Error(`Username "${cleanUser}" already exists.`);
    }
    if (!pass || pass.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(pass, salt);

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      username: cleanUser,
      displayName: displayName.trim() || cleanUser,
      role,
      salt,
      hash,
      enabled: true,
      createdAt: new Date().toISOString(),
      loginCount: 0,
    };

    this.users.push(newUser);
    this.persist();

    return this.toPublicUser(newUser);
  }

  updateUser(
    id: string,
    patch: { displayName?: string; role?: UserRole; enabled?: boolean; password?: string },
  ): RemoteHubUser {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found.');

    if (patch.displayName !== undefined) {
      user.displayName = patch.displayName.trim() || user.username;
    }
    if (patch.role !== undefined) {
      // Prevent demoting the last owner
      if (user.role === 'owner' && patch.role !== 'owner') {
        const ownerCount = this.users.filter((u) => u.role === 'owner' && u.enabled).length;
        if (ownerCount <= 1) {
          throw new Error('Cannot change role: At least one active Owner account is required.');
        }
      }
      user.role = patch.role;
    }
    if (patch.enabled !== undefined) {
      if (user.role === 'owner' && !patch.enabled) {
        const activeOwners = this.users.filter((u) => u.role === 'owner' && u.enabled).length;
        if (activeOwners <= 1) {
          throw new Error('Cannot disable the last active Owner account.');
        }
      }
      user.enabled = patch.enabled;
      if (!patch.enabled) {
        this.revokeAllUserSessions(user.id);
      }
    }
    if (patch.password) {
      if (patch.password.length < 8) {
        throw new Error('New password must be at least 8 characters.');
      }
      user.salt = crypto.randomBytes(16).toString('hex');
      user.hash = hashPassword(patch.password, user.salt);
      this.revokeAllUserSessions(user.id);
    }

    this.persist();
    return this.toPublicUser(user);
  }

  deleteUser(id: string): boolean {
    const user = this.users.find((u) => u.id === id);
    if (!user) return false;

    if (user.role === 'owner') {
      const activeOwners = this.users.filter((u) => u.role === 'owner' && u.enabled).length;
      if (activeOwners <= 1) {
        throw new Error('Cannot delete the last Owner account.');
      }
    }

    this.revokeAllUserSessions(id);
    this.users = this.users.filter((u) => u.id !== id);
    this.persist();
    return true;
  }

  listUsers(): RemoteHubUser[] {
    return this.users.map((u) => this.toPublicUser(u));
  }

  getUser(id: string): RemoteHubUser | undefined {
    const u = this.users.find((user) => user.id === id);
    return u ? this.toPublicUser(u) : undefined;
  }

  private toPublicUser(u: StoredUser): RemoteHubUser {
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      enabled: u.enabled,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      loginCount: u.loginCount,
    };
  }
}
