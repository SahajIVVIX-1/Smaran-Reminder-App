# Windows Authenticode Code Signing & SmartScreen Guide

This guide documents the complete process for acquiring, configuring, and verifying Windows Authenticode Code Signing certificates for Smaran distribution executables (`Smaran.exe`, `Smaran-Setup-<version>.exe`, and `Smaran-<version>-portable.exe`).

---

## 1. Why Code Signing is Required

When Windows users download and execute unsigned binaries from the internet:
1. **Windows SmartScreen** blocks execution with a blue dialog:
   > *"Windows protected your PC – Microsoft Defender SmartScreen prevented an unrecognized app from starting. Publisher: Unknown Publisher"*
2. **User Account Control (UAC)** displays an unverified warning with an orange/yellow shield and "Publisher: Unknown".
3. **Antivirus / EDR** heuristic scanners inspect unsigned executables with significantly higher suspicion, leading to extraction delays or false positives.

A valid Authenticode digital signature establishes:
- **Publisher Authenticity:** Cryptographically proves the software originates from the verified organization or individual.
- **Binary Integrity:** Guarantees the binary has not been modified or corrupted since being signed.
- **SmartScreen Reputation:** Building reputation with Microsoft SmartScreen eliminates the warning dialog for all users.

---

## 2. Certificate Types: OV vs. EV

| Feature | Standard Organization Validation (OV) | Extended Validation (EV) |
|---|---|---|
| **Identity Verification** | Organization or Individual Identity Check | Rigorous Organization & Legal Entity Check |
| **Private Key Storage** | Hardware Token (FIPS 140-2 Level 2) or Cloud HSM (e.g. Azure Trusted Signing, DigiCert ONE) | Hardware Token (FIPS 140-2 Level 2) or Cloud HSM |
| **SmartScreen Reputation** | Builds reputation over time based on download volume | Instant or rapid SmartScreen reputation |
| **Kernel Mode Drivers** | No | Yes (WHQL portal) |
| **Recommended Providers** | DigiCert, Sectigo, SSL.com, GlobalSign | DigiCert, Sectigo, SSL.com, Azure Trusted Signing |

> [!NOTE]
> Since June 2023, the CA/Browser Forum mandates that **all** code signing private keys (both OV and EV) must be stored on compliant hardware security modules (HSM) or secure cloud signing services. Traditional software `.pfx` files without hardware backing are no longer issued by public CAs.

---

## 3. Recommended Cloud Signing Solutions

For modern CI/CD pipelines and automated releases, **Cloud Signing** eliminates physical USB dongles:

### Option A: Microsoft Azure Trusted Signing (Formerly Azure Code Signing)
- Integrated directly with Microsoft's Identity and Azure subscription.
- Lowest cost (~$10/month subscription) with immediate SmartScreen trust.
- Works with standard tools via `signtool.exe` and Azure Trusted Signing dlib plugin (`Azure.CodeSigning.Dlib`).

### Option B: SSL.com eSigner / DigiCert ONE / Sectigo Cloud
- Cloud-hosted HSM key storage with remote signing APIs.
- Compatible with electron-builder and GitHub Actions.

---

## 4. Configuring electron-builder for Signing

`electron-builder` supports automated signing on Windows through environment variables:

### Local PFX / Software Certificate (for internal testing or test certs):
Set the following environment variables before running `npm run build:win`:
```powershell
$env:WIN_CSC_LINK = "C:\path\to\certificate.pfx"
$env:WIN_CSC_KEY_PASSWORD = "your-certificate-password"
```

### In GitHub Actions / CI/CD:
1. Export your base64-encoded certificate string:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Out-File cert_base64.txt
   ```
2. Add secrets to GitHub repository:
   - `WIN_CSC_LINK`: The base64 string.
   - `WIN_CSC_KEY_PASSWORD`: The private key password.
3. In `electron-builder.yml`:
   ```yaml
   win:
     signingHashAlgorithms:
       - sha256
     rfc3161TimeStampServer: http://timestamp.digicert.com
   ```

---

## 5. Verifying Signatures

After packaging, run the built-in verification script:
```bash
node scripts/verify-signatures.mjs
```

Or verify manually via PowerShell:
```powershell
Get-AuthenticodeSignature release/3.3.13/win-unpacked/Smaran.exe | Format-List
```

Or verify with Windows SDK `signtool`:
```cmd
signtool verify /pa /v release\3.3.13\win-unpacked\Smaran.exe
```

A properly signed executable will output:
- **Status:** `Valid`
- **SignerCertificate:** Subject containing publisher name (e.g. `CN=SahajS...`)
- **TimeStamperCertificate:** RFC 3161 timestamp server (e.g. `DigiCert Timestamp Responder`)
