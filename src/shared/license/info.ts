// No runtime imports here: sandboxed preloads bundle this file.

export type LicenseStatus = 'valid' | 'expired' | 'not-yet-valid' | 'missing' | 'invalid';

export interface LicenseDetails {
  id: string;
  name: string;
  years: number;
  /** ISO times. */
  issued: string;
  expires: string;
  issuer: string;
  /** The public IP address the license was issued from. */
  ip: string;
}

/** What the License page and the license screen show. */
export interface LicenseInfo {
  status: LicenseStatus;
  /** Plain English, for anything but 'valid'. */
  message: string | null;
  license: LicenseDetails | null;
  /** When this license was imported on this PC (ISO). */
  importedAt: string | null;
}

export type LicenseImportResult =
  { ok: true; info: LicenseInfo } | { ok: false; error: string } | { ok: false; canceled: true };
