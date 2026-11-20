import * as path from 'node:path';
import { z } from 'zod';
import {
  FileServerSecurityEventSchema,
  type FileServerAuditFilter,
  type FileServerSecurityEvent,
} from '@shared/fileserver';
import { cleanupStaleTempFiles, readValidatedJson, writeAtomicFile } from '../store/atomicFile';

export const FILESERVER_AUDIT_FILE = 'fileserver-audit.json';
export const FILESERVER_AUDIT_LIMIT = 5000;

export class FileServerAuditStore {
  readonly filePath: string;
  private events: FileServerSecurityEvent[] = [];
  private readonly seenIds = new Set<string>();
  private readonly seenKeys = new Set<string>();

  constructor(readonly dataDir: string) {
    this.filePath = path.join(dataDir, FILESERVER_AUDIT_FILE);
    cleanupStaleTempFiles(dataDir, FILESERVER_AUDIT_FILE);
    this.load();
  }

  load(): void {
    const res = readValidatedJson(this.filePath, z.array(FileServerSecurityEventSchema), [], {
      onRecovered: (msg) => console.log(`[FileServerAuditStore] ${msg}`),
      onCorrupt: (err, corruptPath) =>
        console.warn(`[FileServerAuditStore] Corrupt audit log preserved to ${corruptPath}:`, err),
    });

    this.events = [];
    this.seenIds.clear();
    this.seenKeys.clear();

    for (const ev of res.data) {
      if (this.seenIds.has(ev.id)) continue;
      const key = `${ev.type}:${ev.username}:${ev.clientIp}:${ev.timestamp}`;
      if (this.seenKeys.has(key)) continue;

      this.seenIds.add(ev.id);
      this.seenKeys.add(key);
      this.events.push(ev);
    }

    if (this.events.length > FILESERVER_AUDIT_LIMIT) {
      this.events = this.events.slice(0, FILESERVER_AUDIT_LIMIT);
    }
  }

  private save(): void {
    try {
      writeAtomicFile(this.filePath, JSON.stringify(this.events, null, 2), {
        backup: true,
        maxRetries: 5,
      });
    } catch (err) {
      console.error('[FileServerAuditStore] Failed saving audit events:', err);
    }
  }

  add(event: FileServerSecurityEvent): boolean {
    if (!event.id) return false;
    if (this.seenIds.has(event.id)) {
      return false; // deduplicate by id
    }
    const key = `${event.type}:${event.username}:${event.clientIp}:${event.timestamp}`;
    if (this.seenKeys.has(key)) {
      return false; // deduplicate by composite event fingerprint
    }

    this.seenIds.add(event.id);
    this.seenKeys.add(key);
    this.events.unshift(event);

    if (this.events.length > FILESERVER_AUDIT_LIMIT) {
      const removed = this.events.pop();
      if (removed) {
        this.seenIds.delete(removed.id);
        this.seenKeys.delete(
          `${removed.type}:${removed.username}:${removed.clientIp}:${removed.timestamp}`,
        );
      }
    }

    this.save();
    return true;
  }

  getEvents(filter?: FileServerAuditFilter): FileServerSecurityEvent[] {
    let result = this.events;

    if (!filter) {
      return result.slice(0, 200);
    }

    if (filter.type) {
      result = result.filter((e) => e.type === filter.type);
    }

    if (filter.username) {
      const u = filter.username.toLowerCase();
      result = result.filter((e) => e.username.toLowerCase().includes(u));
    }

    if (filter.ip) {
      const ip = filter.ip.toLowerCase();
      result = result.filter((e) => e.clientIp.toLowerCase().includes(ip));
    }

    if (filter.fromDate) {
      const from = new Date(filter.fromDate).getTime();
      if (!Number.isNaN(from)) {
        result = result.filter((e) => new Date(e.timestamp).getTime() >= from);
      }
    }

    if (filter.toDate) {
      const to = new Date(filter.toDate).getTime();
      if (!Number.isNaN(to)) {
        result = result.filter((e) => new Date(e.timestamp).getTime() <= to);
      }
    }

    const limit = filter.limit && filter.limit > 0 ? filter.limit : 200;
    return result.slice(0, limit);
  }

  clear(): void {
    this.events = [];
    this.seenIds.clear();
    this.seenKeys.clear();
    this.save();
  }
}
