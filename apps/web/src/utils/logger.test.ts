import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test both dev and prod behavior, so we use dynamic imports
// with vi.stubEnv to control NODE_ENV per test suite.

describe('logger — development mode', () => {
  let logger: typeof import('./logger').logger;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    // Force re-evaluation of the module
    vi.resetModules();
    const mod = await import('./logger');
    logger = mod.logger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('calls console.log in dev', () => {
    logger.log('test message');
    expect(console.log).toHaveBeenCalledWith('test message');
  });

  it('calls console.warn in dev', () => {
    logger.warn('warning');
    expect(console.warn).toHaveBeenCalledWith('warning');
  });

  it('calls console.error in dev', () => {
    logger.error('error');
    expect(console.error).toHaveBeenCalledWith('error');
  });

  it('calls console.info in dev', () => {
    logger.info('info');
    expect(console.info).toHaveBeenCalledWith('info');
  });

  it('calls console.debug in dev', () => {
    logger.debug('debug');
    expect(console.debug).toHaveBeenCalledWith('debug');
  });

  it('passes multiple arguments', () => {
    logger.log('a', 'b', 123);
    expect(console.log).toHaveBeenCalledWith('a', 'b', 123);
  });
});

describe('logger — production mode', () => {
  let logger: typeof import('./logger').logger;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.resetModules();
    const mod = await import('./logger');
    logger = mod.logger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('suppresses console.log in production', () => {
    logger.log('test');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('suppresses console.warn in production', () => {
    logger.warn('test');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('suppresses console.info in production', () => {
    logger.info('test');
    expect(console.info).not.toHaveBeenCalled();
  });

  it('suppresses console.debug in production', () => {
    logger.debug('test');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('still logs errors in production (for Sentry)', () => {
    logger.error('critical error');
    expect(console.error).toHaveBeenCalledWith('critical error');
  });
});
