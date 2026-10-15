import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import type { Browser } from '@shared/ipc';

/** Where Windows lists installed browsers (Settings › Default apps reads the same keys). */
const ROOTS = [
  'HKCU\\SOFTWARE\\Clients\\StartMenuInternet',
  'HKLM\\SOFTWARE\\Clients\\StartMenuInternet',
  'HKLM\\SOFTWARE\\WOW6432Node\\Clients\\StartMenuInternet',
];

function query(root: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', root, '/s'], { windowsHide: true }, (error, stdout) =>
      resolve(error ? '' : stdout),
    );
  });
}

const expand = (s: string) =>
  s.replace(/%([^%]+)%/g, (all, name: string) => process.env[name] ?? all);

/** The exe in a command line like `"C:\Program Files\…\chrome.exe" --flag "%1"`. */
export function exeFromCommand(command: string): string | null {
  const text = expand(command.trim());
  const quoted = /^"([^"]+)"/.exec(text);
  if (quoted?.[1]) return quoted[1];
  const bare = /^(.+?\.exe)\b/i.exec(text);
  return bare?.[1] ?? null;
}

/**
 * Parses `reg query <root> /s` output into browsers. Each browser is a subkey whose default value
 * is its display name, with the exe in `shell\open\command`. The default value's name is localized
 * ("(Default)", "(Standard)"…), so any name in brackets counts.
 */
export function parseRegistry(output: string, root: string): Browser[] {
  const defaults = new Map<string, string>();
  let key = '';
  for (const line of output.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      key = line.trim();
      continue;
    }
    const value = /^\s+(\(.*\))\s+REG_(?:EXPAND_)?SZ\s+(.*)$/.exec(line);
    if (value?.[2] && key) defaults.set(key.toLowerCase(), value[2].trim());
  }
  const prefix = root.replace(/^HKCU/, 'HKEY_CURRENT_USER').replace(/^HKLM/, 'HKEY_LOCAL_MACHINE');
  const found: Browser[] = [];
  for (const [k, command] of defaults) {
    const match = new RegExp(
      `^${prefix.replace(/\\/g, '\\\\')}\\\\([^\\\\]+)\\\\shell\\\\open\\\\command$`,
      'i',
    ).exec(k);
    if (!match?.[1]) continue;
    const path = exeFromCommand(command);
    if (!path) continue;
    const name = defaults.get(`${prefix}\\${match[1]}`.toLowerCase()) ?? match[1];
    found.push({ name, path });
  }
  return found;
}

/** Browsers installed on this PC, by name. Missing exes and duplicates are left out. */
export async function detectBrowsers(): Promise<Browser[]> {
  const lists = await Promise.all(
    ROOTS.map(async (root) => parseRegistry(await query(root), root)),
  );
  const seen = new Set<string>();
  const out: Browser[] = [];
  for (const b of lists.flat()) {
    const id = b.path.toLowerCase();
    if (seen.has(id) || !fs.existsSync(b.path)) continue;
    seen.add(id);
    out.push(b);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
