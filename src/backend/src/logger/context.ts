import { AsyncLocalStorage } from 'node:async_hooks';
import type { Logger } from 'pino';
import { logger as rootLogger } from './index.js';

export interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export const logContext = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(ctx: LogContext, fn: () => T): T {
  return logContext.run({ ...ctx }, fn);
}

export function getContext(): LogContext | undefined {
  return logContext.getStore();
}

export function getContextualLogger(
  bindings?: Record<string, unknown>
): Logger {
  const ctx = logContext.getStore();
  if (!ctx) {
    return bindings ? rootLogger.child(bindings) : rootLogger;
  }
  const merged: Record<string, unknown> = { ...ctx };
  if (bindings) {
    for (const [key, value] of Object.entries(bindings)) {
      merged[key] = value;
    }
  }
  return rootLogger.child(merged);
}
