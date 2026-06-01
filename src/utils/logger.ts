// src/utils/logger.ts
// Structured logger. Suppresses debug/info in production builds.
// Replace the hook-point comments with Sentry / Datadog / etc. as needed.

const IS_DEV = import.meta.env.DEV;
const BRAND = import.meta.env.VITE_BRAND || 'kiosk';

function ts(): string {
  return new Date().toISOString();
}

function fmt(level: string, msg: string): string {
  return `[${ts()}][${BRAND}][${level}] ${msg}`;
}

export const logger = {
  debug(msg: string, data?: unknown): void {
    if (IS_DEV) console.debug(fmt('DEBUG', msg), ...(data !== undefined ? [data] : []));
  },

  info(msg: string, data?: unknown): void {
    if (IS_DEV) console.info(fmt('INFO', msg), ...(data !== undefined ? [data] : []));
  },

  warn(msg: string, data?: unknown): void {
    console.warn(fmt('WARN', msg), ...(data !== undefined ? [data] : []));
    // Hook: reportWarn(msg, data);
  },

  error(msg: string, err?: unknown): void {
    console.error(fmt('ERROR', msg), ...(err !== undefined ? [err] : []));
    // Hook: reportError(msg, err);  ← wire Sentry.captureException here
  },
};
