// Inspects output binaries and reports Authenticode signature status.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version, productName } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const binaries = [
  join(root, 'release', version, 'win-unpacked', `${productName}.exe`),
  join(root, 'release', version, 'installer', `${productName}-Setup-${version}.exe`),
  join(root, 'release', version, 'portable', `${productName}-${version}-portable.exe`),
];

console.log('='.repeat(72));
console.log(` Authenticode Signature Verification Report – ${productName} v${version}`);
console.log('='.repeat(72));

let allSigned = true;

for (const binary of binaries) {
  if (!existsSync(binary)) {
    console.log(`[-] File not found: ${binary}`);
    continue;
  }

  try {
    const psCmd = `
      $sig = Get-AuthenticodeSignature -FilePath '${binary.replace(/'/g, "''")}';
      [PSCustomObject]@{
        Status = $sig.Status.ToString()
        StatusMessage = $sig.StatusMessage
        Signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { 'None' }
        Issuer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Issuer } else { 'None' }
        Thumbprint = if ($sig.SignerCertificate) { $sig.SignerCertificate.Thumbprint } else { 'None' }
        TimeStamper = if ($sig.TimeStamperCertificate) { $sig.TimeStamperCertificate.Subject } else { 'None' }
      } | ConvertTo-Json -Compress
    `;

    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
      encoding: 'utf8',
      windowsHide: true,
    });

    const info = JSON.parse(out.trim());
    const isSigned = info.Status === 'Valid';

    if (!isSigned) {
      allSigned = false;
      console.log(`\n[!] ${binary}`);
      console.log(`    Status:      ${info.Status} (${info.StatusMessage || 'Not signed'})`);
      console.log(`    Signer:      ${info.Signer}`);
    } else {
      console.log(`\n[+] ${binary}`);
      console.log(`    Status:      VALID Authenticode Signature`);
      console.log(`    Signer:      ${info.Signer}`);
      console.log(`    Issuer:      ${info.Issuer}`);
      console.log(`    Thumbprint:  ${info.Thumbprint}`);
      console.log(`    TimeStamper: ${info.TimeStamper}`);
    }
  } catch (err) {
    allSigned = false;
    console.log(`\n[!] Error checking signature for ${binary}: ${err.message}`);
  }
}

console.log('\n' + '-'.repeat(72));

if (allSigned) {
  console.log('[SUCCESS] All distribution binaries are signed with valid Authenticode certificates.');
} else {
  console.log('[ADVISORY] One or more executables do NOT have a valid Authenticode signature.');
  console.log('           Windows SmartScreen will display "Unknown Publisher" until signed');
  console.log('           with a trusted OV/EV Code Signing Certificate.');
  console.log('           See docs/WINDOWS_SIGNING_GUIDE.md for setup instructions.');
}
console.log('='.repeat(72) + '\n');
