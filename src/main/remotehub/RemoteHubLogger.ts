import crypto from 'node:crypto';
import type { RemoteHubLogEntry } from '@shared/remotehub';

const SENSITIVE_PATTERNS = [
  /(["']?password["']?\s*[:=]\s*["'])([^"']+)(["'])/gi,
  /(["']?passphrase["']?\s*[:=]\s*["'])([^"']+)(["'])/gi,
  /(["']?token["']?\s*[:=]\s*["'])([^"']+)(["'])/gi,
  /(["']?secret["']?\s*[:=]\s*["'])([^"']+)(["'])/gi,
  /(["']?authorization["']?\s*[:=]\s*["']Bearer\s+)([^"']+)(["'])/gi,
  /(srt:\/\/[^:]+:[^@]+@)/gi,
];

export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let redacted = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '$1***REDACTED***$3');
  }
  return redacted;
}

export class RemoteHubLogger {
  private readonly logs: RemoteHubLogEntry[] = [];
  private readonly maxEntries = 500;
  private readonly listeners: Array<(entry: RemoteHubLogEntry) => void> = [];

  log(
    level: RemoteHubLogEntry['level'],
    category: RemoteHubLogEntry['category'],
    message: string,
    details?: Record<string, string | number | boolean | undefined>,
  ): RemoteHubLogEntry {
    const entry: RemoteHubLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message: redactSecrets(message),
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxEntries) {
      this.logs.length = this.maxEntries;
    }

    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {
        // ignore listener errors
      }
    });

    return entry;
  }

  info(
    category: RemoteHubLogEntry['category'],
    message: string,
    details?: Record<string, string | number | boolean | undefined>,
  ): RemoteHubLogEntry {
    return this.log('info', category, message, details);
  }

  warn(
    category: RemoteHubLogEntry['category'],
    message: string,
    details?: Record<string, string | number | boolean | undefined>,
  ): RemoteHubLogEntry {
    return this.log('warn', category, message, details);
  }

  error(
    category: RemoteHubLogEntry['category'],
    message: string,
    details?: Record<string, string | number | boolean | undefined>,
  ): RemoteHubLogEntry {
    return this.log('error', category, message, details);
  }

  security(
    category: RemoteHubLogEntry['category'],
    message: string,
    details?: Record<string, string | number | boolean | undefined>,
  ): RemoteHubLogEntry {
    return this.log('security', category, message, details);
  }

  getLogs(): RemoteHubLogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs.length = 0;
  }

  onLog(listener: (entry: RemoteHubLogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }
}
