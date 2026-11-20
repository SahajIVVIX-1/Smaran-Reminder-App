# Ed25519 Asymmetric Licensing & Machine Fingerprinting

## 1. Cryptographic Architecture

Smaran implements an enterprise-grade asymmetric licensing system based on the **Ed25519** elliptic curve signature algorithm:
- **Offline / Air-Gapped Verification:** The client application does not need to connect to an online licensing server. The public key is baked into the executable (`src/shared/license/publicKey.ts`), allowing instant offline cryptographic validation.
- **Tamper-Proof Signatures:** Any manual alteration of license metadata (name, expiration date, licensed edition, machine ID) immediately invalidates the cryptographic signature.

---

## 2. Hardware Fingerprint Generation

To bind licenses to specific physical workstations and prevent unauthorized key copying, `src/main/license/fingerprint.ts` computes a persistent machine hash:
1. Gathers hardware serials:
   - Primary motherboard BIOS UUID via Windows WMI (`wmic csproduct get uuid`).
   - CPU processor ID.
   - Primary physical drive volume serial number.
2. Concatenates hardware identifiers and hashes them using SHA-256.
3. Produces a formatted machine fingerprint string: `SMARAN-XXXX-XXXX-XXXX-XXXX`.

---

## 3. License Payload & Verification Pipeline

A valid license token (`.smaranlic` or JSON) contains:
```json
{
  "licenseId": "LIC-98421",
  "holder": "Sahaj",
  "tier": "enterprise",
  "issuedAt": "2026-11-20T00:00:00Z",
  "expiresAt": "2028-11-20T00:00:00Z",
  "machineId": "SMARAN-A8F2-99C1-4D02-11FE",
  "signature": "3a8f... (64-byte Ed25519 signature)"
}
```

### Verification Steps
1. The client verifies that `new Date() <= new Date(license.expiresAt)`.
2. Verifies that `license.machineId === currentMachineId` (or matches a universal floating key format).
3. Verifies the cryptographic signature over the canonical JSON payload using `crypto.verify(null, payloadBuffer, publicKey, signatureBuffer)`.
4. If verified, unlocks all features and saves the validated token to `%APPDATA%\Smaran\license.json`.

---

## 4. Key Generation Utilities (`scripts/`)

- `scripts/license-keygen.mjs`: Generates a new Ed25519 private/public keypair.
- `scripts/license-sign.mjs`: Signs a license request payload using the private key.
- `scripts/make-permanent-license.mjs`: Creates a permanent perpetual license file for a specific target machine fingerprint.
