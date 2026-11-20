import fs from 'node:fs';
import path from 'node:path';
import type { LogLevel, ServerLogEntry } from '@shared/fileserver';

export interface HfsLoggerOptions {
  maxSizeBytes?: number;
  maxFiles?: number;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_FILES = 3;

/**
 * Sanitizes and redacts sensitive information such as passwords, auth tokens, and cookies.
 */
export function redactSensitiveLog(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/(Authorization:\s*Basic\s+)[A-Za-z0-9+/=]+/gi, '$1[REDACTED]')
    .replace(/(Authorization:\s*Bearer\s+)[A-Za-z0-9._~+/-]+/gi, '$1[REDACTED]')
    .replace(/((?:password|pwd|pass)\s*[:=]\s*["']?)([^"'&,\s]+)(["']?)/gi, '$1[REDACTED]$3')
    .replace(/((?:token|secret|api_key|apikey)\s*[:=]\s*["']?)([^"'&,\s]+)(["']?)/gi, '$1[REDACTED]$3')
    .replace(/(cookie:\s*)[^\r\n]+/gi, '$1[REDACTED]');
}

export class HfsOperationalLogger {
  readonly logFilePath: string;
  readonly logDir: string;
  private readonly maxSizeBytes: number;
  private readonly maxFiles: number;
  private currentSizeBytes = 0;

  constructor(dataDir: string, options: HfsLoggerOptions = {}) {
    this.logDir = path.join(dataDir, 'logs');
    this.logFilePath = path.join(this.logDir, 'hfs.log');
    this.maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      if (fs.existsSync(this.logFilePath)) {
        const stat = fs.statSync(this.logFilePath);
        this.currentSizeBytes = stat.size;
      }
    } catch (err) {
      console.error('[HfsLogger] Initialization error:', err);
    }
  }

  log(level: LogLevel, message: string, ip?: string): ServerLogEntry {
    const redactedMsg = redactSensitiveLog(message);
    const timestamp = new Date().toISOString();
    const entry: ServerLogEntry = {
      id: crypto.randomUUID(),
      timestamp,
      level,
      message: redactedMsg,
      ip,
    };

    const line = `[${timestamp}] [${level.toUpperCase()}]${ip ? ` [${ip}]` : ''} ${redactedMsg}\n`;
    this.writeLine(line);
    return entry;
  }

  private writeLine(line: string): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      if (this.currentSizeBytes + line.length > this.maxSizeBytes) {
        this.rotate();
      }
      fs.appendFileSync(this.logFilePath, line, 'utf8');
      this.currentSizeBytes += Buffer.byteLength(line, 'utf8');
    } catch (err) {
      console.error('[HfsLogger] Failed to write operational log:', err);
    }
  }

  private rotate(): void {
    try {
      // Rotate: hfs.2.log deleted, hfs.1.log -> hfs.2.log, hfs.log -> hfs.1.log
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const src = i === 1 ? this.logFilePath : path.join(this.logDir, `hfs.${i - 1}.log`);
        const dest = path.join(this.logDir, `hfs.${i}.log`);
        if (fs.existsSync(src)) {
          if (fs.existsSync(dest)) {
            try {
              fs.unlinkSync(dest);
            } catch {
              // ignore
            }
          }
          try {
            fs.renameSync(src, dest);
          } catch {
            // ignore
          }
        }
      }
      this.currentSizeBytes = 0;
    } catch (err) {
      console.error('[HfsLogger] Rotation failed:', err);
    }
  }

  clear(): void {
    try {
      for (let i = 1; i <= this.maxFiles; i++) {
        const rotated = path.join(this.logDir, `hfs.${i}.log`);
        if (fs.existsSync(rotated)) {
          fs.unlinkSync(rotated);
        }
      }
      if (fs.existsSync(this.logFilePath)) {
        fs.writeFileSync(this.logFilePath, '', 'utf8');
      }
      this.currentSizeBytes = 0;
    } catch (err) {
      console.error('[HfsLogger] Clear failed:', err);
    }
  }
}
