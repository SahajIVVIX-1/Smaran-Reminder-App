import { execFile, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { basename, dirname, extname } from 'node:path';
import { shell } from 'electron';
import { baseName } from '@shared/automationSummary';
import type { Action, PowerAction } from '@shared/schema';
import { appEnv } from '../setup/winSystem';

/** Windows commands for each power action. */
const POWER: Record<PowerAction, [string, string[]]> = {
  lock: ['rundll32.exe', ['user32.dll,LockWorkStation']],
  signOut: ['shutdown.exe', ['/l']],
  shutdown: ['shutdown.exe', ['/s', '/t', '0']],
  restart: ['shutdown.exe', ['/r', '/t', '0']],
  hibernate: ['shutdown.exe', ['/h']],
  sleep: [
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)",
    ],
  ],
};

/** Private-window switches by browser exe name. */
const PRIVATE_FLAG: Record<string, string> = {
  'chrome.exe': '--incognito',
  'brave.exe': '--incognito',
  'vivaldi.exe': '--incognito',
  'chromium.exe': '--incognito',
  'msedge.exe': '--inprivate',
  'firefox.exe': '-private-window',
  'opera.exe': '--private',
  'launcher.exe': '--private', // Opera's launcher
};

export function privateFlag(browserPath: string): string | null {
  return PRIVATE_FLAG[basename(browserPath).toLowerCase()] ?? null;
}

function run(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error) =>
      error ? reject(new Error(`Windows refused (${error.message.split('\n')[0]})`)) : resolve(),
    );
  });
}

/** Starts a program on its own, so it keeps running whatever Smaran does. */
function launch(
  file: string,
  args: string[],
  options: { cwd?: string; hidden?: boolean } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(file, args, {
        cwd: options.cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: options.hidden ?? false,
        shell: false, // Strictly false: never execute commands through a shell to prevent command injection
        env: appEnv(),
      });
    } catch (error) {
      reject(new Error((error as Error).message));
      return;
    }
    child.once('error', (error) => reject(new Error(error.message)));
    // 'spawn' means it started; after that it is on its own.
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

/** Disallowed characters in executable file paths. */
export function validateExecutionPath(filePath: string): void {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Executable path is required.');
  }
  if (/[\0\r\n]/.test(filePath)) {
    throw new Error('Executable path contains invalid control characters.');
  }
}

/** Validates and splits arguments safely, preventing command injection attacks. */
export function validateExecutionArgs(argsLine: string, ext: string): string[] {
  if (!argsLine || !argsLine.trim()) return [];
  if (/[\0\r\n]/.test(argsLine)) {
    throw new Error('Command arguments contain invalid newline or null characters.');
  }

  // Batch files (.bat, .cmd) are especially susceptible to shell metacharacter chaining (&, |, <, >, ^)
  if (ext === '.bat' || ext === '.cmd') {
    if (/[&|<>^]/.test(argsLine)) {
      throw new Error('Batch file arguments contain unsafe shell metacharacters (&, |, <, >, ^).');
    }
  }

  return splitArgs(argsLine);
}

/**
 * Splits a command line the way most Windows programs read it: spaces separate arguments,
 * double quotes group them ("C:\My Files\a.txt" stays one argument).
 */
export function splitArgs(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  let started = false;
  for (const ch of line) {
    if (ch === '"') {
      quoted = !quoted;
      started = true;
    } else if (/\s/.test(ch) && !quoted) {
      if (started) out.push(current);
      current = '';
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (started) out.push(current);
  return out;
}

async function openPath(path: string, args: string, hidden: boolean): Promise<void> {
  validateExecutionPath(path);
  if (!fs.existsSync(path)) throw new Error(`${baseName(path)} was not found at ${path}`);
  const ext = extname(path).toLowerCase();
  const cwd = dirname(path);
  const validatedArgs = validateExecutionArgs(args, ext);

  if (ext === '.bat' || ext === '.cmd') {
    const cmdExe = process.env.ComSpec || 'cmd.exe';
    await launch(cmdExe, ['/d', '/c', path, ...validatedArgs], {
      cwd,
      hidden,
    });
    return;
  }
  if (ext === '.ps1') {
    await launch(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path, ...validatedArgs],
      { cwd, hidden },
    );
    return;
  }
  if ((ext === '.exe' || ext === '.com') && validatedArgs.length > 0) {
    await launch(path, validatedArgs, { cwd });
    return;
  }
  // Everything else (apps without arguments, shortcuts, PDFs, documents, folders) opens the way a
  // double-click would.
  const error = await shell.openPath(path);
  if (error) throw new Error(error);
}

async function openLink(url: string, browser: string, inPrivate: boolean): Promise<void> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http:// and https:// links can be opened');
  if (!browser) {
    await shell.openExternal(url);
    return;
  }
  if (!fs.existsSync(browser)) throw new Error(`The browser was not found at ${browser}`);
  const flag = inPrivate ? privateFlag(browser) : null;
  await launch(browser, flag ? [flag, url] : [url], { cwd: dirname(browser) });
}

/** Runs one action. Throws an Error whose message is plain English, ready for History. */
export async function runAction(action: Action): Promise<void> {
  switch (action.kind) {
    case 'power': {
      const [file, args] = POWER[action.power];
      await run(file, args);
      return;
    }
    case 'open':
      await openPath(action.path, action.args, action.hidden);
      return;
    case 'link':
      await openLink(action.url, action.browser, action.private);
      return;
  }
}
