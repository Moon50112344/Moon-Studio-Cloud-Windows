import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { sanitizeLogContent } from '../utils/credentials';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  vmId?: string;
  eventId?: number | string;
  metadata?: Record<string, unknown>;
}

export class ServerLogger extends EventEmitter {
  private logFilePath: string;
  private memoryBuffer: LogEntry[] = [];
  private maxBufferSize: number = 2000;
  private secretsToMask: Set<string> = new Set();

  constructor(logDir = path.resolve(process.cwd(), 'data/logs')) {
    super();
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {
      // ignore directory creation error
    }
    this.logFilePath = path.join(logDir, 'server.log');
  }

  public registerSecret(secret: string): void {
    if (secret && secret.length > 3) {
      this.secretsToMask.add(secret);
    }
  }

  public log(
    level: LogLevel,
    component: string,
    message: string,
    vmId?: string,
    metadata?: Record<string, unknown>,
    eventId?: number | string
  ): LogEntry {
    const rawMessage = typeof message === 'string' ? message : String(message);
    const sanitized = sanitizeLogContent(rawMessage, Array.from(this.secretsToMask));

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      component,
      message: sanitized,
      vmId,
      eventId,
      metadata,
    };

    // Store in ring buffer
    this.memoryBuffer.push(entry);
    if (this.memoryBuffer.length > this.maxBufferSize) {
      this.memoryBuffer.shift();
    }

    // Write to persistent log file
    const eventTag = entry.eventId ? ` [Event:${entry.eventId}]` : '';
    const vmTag = entry.vmId ? ` [VM:${entry.vmId}]` : '';
    const logLine = `[${entry.timestamp}] [${entry.level}] [${entry.component}]${vmTag}${eventTag} ${entry.message}${
      entry.metadata ? ' ' + JSON.stringify(entry.metadata) : ''
    }\n`;

    try {
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');
    } catch (err) {
      console.error('[ServerLogger] Failed to write log to disk:', err);
    }

    // Print to server console for container log observation
    const color =
      level === 'ERROR' ? '\x1b[31m' :
      level === 'WARN' ? '\x1b[33m' :
      level === 'DEBUG' ? '\x1b[36m' : '\x1b[32m';
    console.log(`${color}[${entry.level}]\x1b[0m [${entry.component}]${eventTag} ${entry.message}`);

    // Emit real-time event for SSE / WebSockets
    this.emit('log', entry);

    return entry;
  }

  public info(
    component: string,
    message: string,
    vmId?: string,
    metadata?: Record<string, unknown>,
    eventId?: number | string
  ): LogEntry {
    return this.log('INFO', component, message, vmId, metadata, eventId);
  }

  public warn(
    component: string,
    message: string,
    vmId?: string,
    metadata?: Record<string, unknown>,
    eventId?: number | string
  ): LogEntry {
    return this.log('WARN', component, message, vmId, metadata, eventId);
  }

  public error(
    component: string,
    message: string,
    vmId?: string,
    metadata?: Record<string, unknown>,
    eventId?: number | string
  ): LogEntry {
    return this.log('ERROR', component, message, vmId, metadata, eventId);
  }

  public debug(
    component: string,
    message: string,
    vmId?: string,
    metadata?: Record<string, unknown>,
    eventId?: number | string
  ): LogEntry {
    return this.log('DEBUG', component, message, vmId, metadata, eventId);
  }

  public getLogs(options?: {
    limit?: number;
    level?: LogLevel;
    component?: string;
    vmId?: string;
    since?: string;
  }): LogEntry[] {
    let list = [...this.memoryBuffer];
    if (options?.level) {
      list = list.filter((e) => e.level === options.level);
    }
    if (options?.component) {
      list = list.filter((e) => e.component.toLowerCase().includes(options.component!.toLowerCase()));
    }
    if (options?.vmId) {
      list = list.filter((e) => e.vmId === options.vmId);
    }
    if (options?.since) {
      const sinceDate = new Date(options.since).getTime();
      list = list.filter((e) => new Date(e.timestamp).getTime() > sinceDate);
    }
    const limit = options?.limit || 200;
    return list.slice(-limit);
  }

  public clear(): void {
    this.memoryBuffer = [];
    try {
      fs.writeFileSync(this.logFilePath, '', 'utf8');
    } catch {
      // ignore
    }
  }
}

export const serverLogger = new ServerLogger();
