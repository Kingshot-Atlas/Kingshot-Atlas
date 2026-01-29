/**
 * Production-safe logger utility for Kingshot Atlas.
 * 
 * Only logs in development mode. In production, all logs are silently ignored.
 * This prevents console pollution and potential information leakage in production.
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]): void => {
    if (isDev) console.log(...args);
  },
  
  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(...args);
  },
  
  error: (...args: unknown[]): void => {
    // Errors are always logged (they should be caught by Sentry in production)
    console.error(...args);
  },
  
  info: (...args: unknown[]): void => {
    if (isDev) console.info(...args);
  },
  
  debug: (...args: unknown[]): void => {
    if (isDev) console.debug(...args);
  },
};

export default logger;
