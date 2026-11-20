import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import {
  checkPayload,
  containerFromImage,
  decodeContainer,
  fromBase64,
  LicenseError,
  toBase64,
  type Bitmap,
  type Container,
} from '@shared/license/core';
import type { LicenseDetails, LicenseInfo } from '@shared/license/info';
import { LICENSE_PUBLIC_KEY } from '@shared/license/publicKey';

export const LICENSE_FILE = 'license.json';
/** License images are small; refuse anything absurd before reading it. */
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** The clock may drift or change time zone; more than this backwards looks like tampering. */
const CLOCK_SLACK_MS = 2 * 86_400_000;

interface Stored {
  /** The signed container, base64. Verified again on every start. */
  container: string;
  importedAt: string;
  /** Latest time Smaran saw a valid license, to notice a clock set back. */
  lastSeen: string;
}

export interface LicenseStoreOptions {
  now?: () => Date;
  /** Base64url Ed25519 public key; the bundled one by default. */
  publicKey?: string;
  /** Decodes images other than PNG (Electron's nativeImage in the app). */
  decodeOther?: (bytes: Uint8Array) => Bitmap | null;
}

const inflate = (d: Uint8Array) => new Uint8Array(inflateSync(d));

function details(c: Container): LicenseDetails {
  const { id, name, years, issued, expires, issuer, ip } = c.payload;
  return { id, name, years, issued, expires, issuer, ip };
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The license on this PC: imports license images, checks their signature with the bundled public
 * key, and keeps the verified license in license.json in the data folder, so no internet is needed.
 */
export class LicenseStore {
  private readonly now: () => Date;
  private readonly key: KeyObject;
  private readonly decodeOther?: (bytes: Uint8Array) => Bitmap | null;

  constructor(
    readonly dir: string,
    options: LicenseStoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.decodeOther = options.decodeOther;
    this.key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: options.publicKey ?? LICENSE_PUBLIC_KEY },
      format: 'jwk',
    });
  }

  get filePath(): string {
    return join(this.dir, LICENSE_FILE);
  }

  /** Reads and re-verifies the stored license. Never throws. */
  info(): LicenseInfo {
    let stored: Stored;
    try {
      stored = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Stored;
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      return {
        status: missing ? 'missing' : 'invalid',
        message: missing
          ? 'No license yet. Import your Smaran license image to start.'
          : 'This license isn’t valid. Import your license image again.',
        license: null,
        importedAt: null,
      };
    }
    try {
      const container = this.verify(fromBase64(String(stored.container)));
      const now = this.now();
      const lastSeen = Date.parse(stored.lastSeen);
      if (!Number.isNaN(lastSeen) && now.getTime() < lastSeen - CLOCK_SLACK_MS) {
        return {
          status: 'invalid',
          message:
            'This license isn’t valid.',
          license: details(container),
          importedAt: stored.importedAt ?? null,
        };
      }
      const info = this.describe(container, stored.importedAt ?? null);
      if (
        info.status === 'valid' &&
        (Number.isNaN(lastSeen) || now.getTime() - lastSeen > 60 * 60 * 1000)
      ) {
        try {
          this.write({ ...stored, lastSeen: now.toISOString() });
        } catch {
          // A transient disk write error updating lastSeen must never invalidate an otherwise cryptographically valid license
        }
      }
      return info;
    } catch (error) {
      return {
        status: 'invalid',
        message:
          error instanceof LicenseError
            ? `${error.message} Import your license image again.`
            : 'This license isn’t valid. Import your license image again.',
        license: null,
        importedAt: null,
      };
    }
  }

  get valid(): boolean {
    return this.info().status === 'valid';
  }

  /**
   * Imports a license image (PNG, or JPG with its license comment). Saves it only if it is
   * genuine, for Smaran, and in date; otherwise throws a LicenseError and keeps the current one.
   */
  importFile(path: string): LicenseInfo {
    let size: number;
    try {
      size = fs.statSync(path).size;
    } catch {
      throw new LicenseError('no-license', 'That file couldn’t be opened.');
    }
    if (size > MAX_IMAGE_BYTES)
      throw new LicenseError('no-license', 'This image doesn’t contain a Smaran license.');
    return this.importBytes(new Uint8Array(fs.readFileSync(path)));
  }

  importBytes(bytes: Uint8Array): LicenseInfo {
    const raw = containerFromImage(bytes, inflate, this.decodeOther);
    const container = this.verify(raw);
    const importedAt = this.now().toISOString();
    const info = this.describe(container, importedAt);
    if (info.status !== 'valid')
      throw new LicenseError(
        info.status === 'expired' ? 'expired' : 'not-yet-valid',
        info.message ?? 'This license is not valid.',
      );
    this.write({ container: toBase64(raw), importedAt, lastSeen: importedAt });
    return info;
  }

  // ---------- internals ----------

  /** Decodes the container and checks its Ed25519 signature. */
  private verify(raw: Uint8Array): Container {
    const container = decodeContainer(raw);
    const ok = verify(
      null,
      Buffer.from(container.payloadBytes),
      this.key,
      Buffer.from(container.signature),
    );
    if (!ok)
      throw new LicenseError(
        'bad-signature',
        'This license isn’t valid.',
      );
    return container;
  }

  private describe(container: Container, importedAt: string | null): LicenseInfo {
    const state = checkPayload(container.payload, this.now());
    const license = details(container);
    if (state === 'expired')
      return {
        status: 'expired',
        message: `This license expired on ${fmt(license.expires)}. Import a renewed license to keep using Smaran.`,
        license,
        importedAt,
      };
    if (state === 'not-yet-valid')
      return {
        status: 'not-yet-valid',
        message: 'This license isn’t valid yet.',
        license,
        importedAt,
      };
    return { status: 'valid', message: null, license, importedAt };
  }

  private write(stored: Stored): void {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    try {
      fs.writeFileSync(tmp, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
      try {
        fs.renameSync(tmp, this.filePath);
      } catch {
        // Fallback on Windows if rename encounters temporary handle collision
        fs.copyFileSync(tmp, this.filePath);
        try {
          fs.rmSync(tmp, { force: true });
        } catch {
          // ignore
        }
      }
    } catch (err) {
      try {
        if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
      } catch {
        // ignore
      }
      throw err;
    }
  }
}
