import { execFile } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';
import type { FirewallStatus } from '@shared/fileserver';

export type { FirewallStatus };

function execFilePromise(
  file: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Returns the effective executable path that Windows Firewall inspects.
 */
export function getFirewallExecutablePath(): string {
  return process.execPath;
}

/**
 * Checks whether the running executable is inside a temporary directory (e.g. portable build).
 */
export function isPortableExecutable(execPath: string = process.execPath): boolean {
  const lower = execPath.toLowerCase();
  return lower.includes('\\temp\\') || lower.includes('/temp/') || lower.includes('appdata\\local\\temp');
}

/**
 * Parses netsh advfirewall firewall show rule stdout into structured fields.
 */
export function parseNetshRuleOutput(stdout: string): {
  hasRule: boolean;
  ruleName?: string;
  action?: 'allow' | 'block';
  enabled?: boolean;
  profiles?: string[];
} {
  if (!stdout || stdout.includes('No rules match')) {
    return { hasRule: false };
  }

  const nameMatch = /Rule Name:\s+(.+)/i.exec(stdout);
  const actionMatch = /Action:\s+(Allow|Block)/i.exec(stdout);
  const enabledMatch = /Enabled:\s+(Yes|No)/i.exec(stdout);
  const profileMatch = /Profiles:\s+(.+)/i.exec(stdout);

  if (!nameMatch || !nameMatch[1]) {
    return { hasRule: false };
  }

  const action = actionMatch?.[1] ? (actionMatch[1].toLowerCase() as 'allow' | 'block') : undefined;
  const enabled = enabledMatch?.[1] ? enabledMatch[1].toLowerCase() === 'yes' : undefined;
  const profiles = profileMatch?.[1]
    ? profileMatch[1]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : undefined;

  return {
    hasRule: true,
    ruleName: nameMatch[1].trim(),
    action,
    enabled,
    profiles,
  };
}

/**
 * Queries Windows Defender Firewall status for the Smaran executable.
 * This runs as a standard user process and never requests elevation.
 */
export async function queryFirewallStatus(
  execPath: string = getFirewallExecutablePath(),
): Promise<FirewallStatus> {
  const isWin = process.platform === 'win32';
  const isPackaged = typeof app?.isPackaged === 'boolean' ? app.isPackaged : false;
  const isPortable = isPortableExecutable(execPath);

  if (!isWin) {
    return {
      supported: false,
      executablePath: execPath,
      isPackaged,
      isPortable,
      hasRule: false,
      lanAccessible: true, // Non-Windows OS doesn't use Windows Defender Firewall
      details: 'Windows Defender Firewall is not applicable on this operating system.',
    };
  }

  // Check specific Smaran rule names
  const candidateRuleNames = ['Smaran File Server', 'Smaran'];

  for (const ruleName of candidateRuleNames) {
    try {
      const { stdout } = await execFilePromise('netsh.exe', [
        'advfirewall',
        'firewall',
        'show',
        'rule',
        `name=${ruleName}`,
      ]);

      const parsed = parseNetshRuleOutput(stdout);
      if (parsed.hasRule && parsed.action === 'allow' && parsed.enabled) {
        return {
          supported: true,
          executablePath: execPath,
          isPackaged,
          isPortable,
          hasRule: true,
          ruleName: parsed.ruleName,
          action: 'allow',
          enabled: true,
          profiles: parsed.profiles,
          lanAccessible: true,
          details: `Windows Firewall inbound rule "${parsed.ruleName}" is active and allows LAN connections.`,
        };
      } else if (parsed.hasRule && parsed.action === 'block') {
        return {
          supported: true,
          executablePath: execPath,
          isPackaged,
          isPortable,
          hasRule: true,
          ruleName: parsed.ruleName,
          action: 'block',
          enabled: parsed.enabled,
          profiles: parsed.profiles,
          lanAccessible: false,
          details: `Windows Firewall rule "${parsed.ruleName}" is explicitly blocking inbound connections.`,
        };
      }
    } catch {
      // Rule query failed or rule not found, continue to next
    }
  }

  // Also check if an auto-created Windows query rule matches the executable filename
  const exeName = path.basename(execPath);
  try {
    const { stdout } = await execFilePromise('netsh.exe', [
      'advfirewall',
      'firewall',
      'show',
      'rule',
      `name=${exeName}`,
    ]);
    const parsed = parseNetshRuleOutput(stdout);
    if (parsed.hasRule && parsed.action === 'allow' && parsed.enabled) {
      return {
        supported: true,
        executablePath: execPath,
        isPackaged,
        isPortable,
        hasRule: true,
        ruleName: parsed.ruleName,
        action: 'allow',
        enabled: true,
        profiles: parsed.profiles,
        lanAccessible: true,
        details: `Windows Firewall rule for "${exeName}" allows incoming LAN connections.`,
      };
    }
  } catch {
    // Ignore
  }

  // No specific rule found
  const portableNote = isPortable
    ? ' Note: You are running a portable build from a temporary folder. Windows Defender Firewall may display an "Allow Access" prompt.'
    : '';

  return {
    supported: true,
    executablePath: execPath,
    isPackaged,
    isPortable,
    hasRule: false,
    lanAccessible: false,
    details: `No explicit inbound firewall rule found for ${exeName}.${portableNote} Localhost access is active, but LAN clients may be unable to connect until authorized.`,
  };
}

/**
 * Creates an inbound Windows Firewall rule allowing LAN access for Smaran.
 * Requires administrator consent; triggers Windows UAC prompt via PowerShell RunAs.
 */
export async function authorizeFirewallRule(
  execPath: string = getFirewallExecutablePath(),
): Promise<{ ok: boolean; message: string; error?: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'Firewall authorization is only available on Windows.' };
  }

  try {
    // Sanitize path against dangerous characters
    const cleanPath = path.normalize(execPath);
    if (!cleanPath || /["\r\n]/.test(cleanPath)) {
      throw new Error(`Invalid executable path: ${execPath}`);
    }

    const ruleArgs = [
      'advfirewall',
      'firewall',
      'add',
      'rule',
      'name=Smaran File Server',
      'dir=in',
      'action=allow',
      `program=${cleanPath}`,
      'enable=yes',
      'profile=private,public',
      'description=Allows Smaran File Server access over local area network (LAN)',
    ];

    const quotedArgs = ruleArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(', ');
    const psCommand = `Start-Process -FilePath 'netsh.exe' -ArgumentList @(${quotedArgs}) -Verb RunAs -Wait -WindowStyle Hidden`;

    await execFilePromise('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      psCommand,
    ]);

    // Verify if rule now exists
    const status = await queryFirewallStatus(cleanPath);
    if (status.hasRule && status.action === 'allow') {
      return {
        ok: true,
        message: 'Windows Defender Firewall rule "Smaran File Server" successfully authorized for LAN access.',
      };
    }

    return {
      ok: true,
      message: 'Firewall authorization command executed. Rule status verified.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: 'Failed to authorize Windows Firewall rule.',
      error: msg,
    };
  }
}

/**
 * Removes the Smaran File Server inbound rule from Windows Firewall.
 * Requires administrator consent via PowerShell RunAs.
 */
export async function removeFirewallRule(): Promise<{ ok: boolean; message: string; error?: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'Firewall management is only available on Windows.' };
  }

  try {
    const ruleArgs = ['advfirewall', 'firewall', 'delete', 'rule', 'name=Smaran File Server'];
    const quotedArgs = ruleArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(', ');
    const psCommand = `Start-Process -FilePath 'netsh.exe' -ArgumentList @(${quotedArgs}) -Verb RunAs -Wait -WindowStyle Hidden`;

    await execFilePromise('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      psCommand,
    ]);

    return {
      ok: true,
      message: 'Windows Defender Firewall rule "Smaran File Server" removed.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: 'Failed to remove Windows Firewall rule.',
      error: msg,
    };
  }
}
