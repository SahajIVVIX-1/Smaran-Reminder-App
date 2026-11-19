// Inspects output binaries and verifies Authenticode signature status independently.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version, productName } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const targets = [
  {
    key: 'app',
    name: 'Main Application Executable',
    path: join(root, 'release', version, 'win-unpacked', `${productName}.exe`),
  },
  {
    key: 'installer',
    name: 'Windows Installer Executable',
    path: join(root, 'release', version, 'installer', `${productName}-Setup-${version}.exe`),
  },
  {
    key: 'portable',
    name: 'Portable Windows Executable',
    path: join(root, 'release', version, 'portable', `${productName}-${version}-portable.exe`),
  },
];

console.log('='.repeat(76));
console.log(` Authenticode Signature Independent Verification – ${productName} v${version}`);
console.log('='.repeat(76));

let missingFiles = false;
let allSigned = true;
const results = [];

for (const target of targets) {
  console.log(`\n▶ Verifying: ${target.name}`);
  console.log(`  Path: ${target.path}`);

  if (!existsSync(target.path)) {
    console.error(`  [FAIL] Expected binary does not exist: ${target.path}`);
    missingFiles = true;
    allSigned = false;
    results.push({ ...target, exists: false, isSigned: false, status: 'Missing' });
    continue;
  }

  try {
    const psCmd = `
      $sig = Get-AuthenticodeSignature -FilePath '${target.path.replace(/'/g, "''")}';
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

    results.push({
      ...target,
      exists: true,
      isSigned,
      status: info.Status,
      statusMessage: info.StatusMessage,
      signer: info.Signer,
      issuer: info.Issuer,
      thumbprint: info.Thumbprint,
      timeStamper: info.TimeStamper,
    });

    if (isSigned) {
      console.log(`  [PASS] Authenticode Signature: VALID`);
      console.log(`         Signer:      ${info.Signer}`);
      console.log(`         Issuer:      ${info.Issuer}`);
      console.log(`         Thumbprint:  ${info.Thumbprint}`);
      console.log(`         TimeStamper: ${info.TimeStamper}`);
    } else {
      allSigned = false;
      console.log(`  [NOTE] Authenticode Signature: ${info.Status} (${info.StatusMessage || 'Not digitally signed'})`);
      console.log(`         Signer:      ${info.Signer}`);
    }
  } catch (err) {
    allSigned = false;
    console.error(`  [ERROR] Failed to query signature: ${err.message}`);
    results.push({ ...target, exists: true, isSigned: false, status: 'QueryError', error: err.message });
  }
}

console.log('\n' + '-'.repeat(76));
console.log(' Independent Verification Summary:');
for (const r of results) {
  const icon = !r.exists ? '✖ MISSING' : r.isSigned ? '✔ SIGNED' : '○ UNSIGNED';
  console.log(`  - ${r.name.padEnd(32)}: ${icon} [Status: ${r.status}]`);
}
console.log('-'.repeat(76));

// Missing binaries MUST cause verification failure
if (missingFiles) {
  console.error('\n[FATAL] Verification failed: One or more expected release executables are missing!');
  process.exit(1);
}

const requireSigned = process.argv.includes('--require-signed') || !!process.env.WIN_CSC_LINK || !!process.env.CSC_LINK;

if (allSigned) {
  console.log('[SUCCESS] All distribution executables possess verified Authenticode digital signatures.');
} else {
  console.log('[ADVISORY] Executables do not possess a verified commercial Authenticode certificate.');
  console.log('           Windows SmartScreen will show "Unknown Publisher" until signed');
  console.log('           with an OV/EV Code Signing certificate with reputation.');
  console.log('           See docs/WINDOWS_SIGNING_GUIDE.md for signing setup.');
  if (requireSigned) {
    console.error('\n[FATAL] Signing required but binaries are unsigned or have invalid signatures.');
    process.exit(1);
  }
}

console.log('='.repeat(76) + '\n');
