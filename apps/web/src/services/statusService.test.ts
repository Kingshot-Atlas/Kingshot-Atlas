import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

import {
  SessionExpiredError,
  DuplicateSubmissionError,
  NetworkError,
} from './statusService';

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

describe('statusService — Custom Errors', () => {
  it('SessionExpiredError has correct name and default message', () => {
    const err = new SessionExpiredError();
    expect(err.name).toBe('SessionExpiredError');
    expect(err.message).toContain('session has expired');
    expect(err instanceof Error).toBe(true);
  });

  it('SessionExpiredError accepts custom message', () => {
    const err = new SessionExpiredError('Custom session message');
    expect(err.message).toBe('Custom session message');
  });

  it('DuplicateSubmissionError has correct name and default message', () => {
    const err = new DuplicateSubmissionError();
    expect(err.name).toBe('DuplicateSubmissionError');
    expect(err.message).toContain('already submitted');
    expect(err instanceof Error).toBe(true);
  });

  it('DuplicateSubmissionError accepts custom message', () => {
    const err = new DuplicateSubmissionError('Already done');
    expect(err.message).toBe('Already done');
  });

  it('NetworkError has correct name and default message', () => {
    const err = new NetworkError();
    expect(err.name).toBe('NetworkError');
    expect(err.message).toContain('Network error');
    expect(err instanceof Error).toBe(true);
  });

  it('NetworkError accepts custom message', () => {
    const err = new NetworkError('Connection failed');
    expect(err.message).toBe('Connection failed');
  });
});

// ============================================================================
// SERVICE — Supabase guard
// ============================================================================

describe('statusService — Supabase guard', () => {
  it('throws when Supabase is not configured (fetchAllSubmissions)', async () => {
    const { statusService } = await import('./statusService');
    await expect(statusService.fetchAllSubmissions()).rejects.toThrow('Database unavailable');
  });

  it('throws when Supabase is not configured (submitStatusUpdate)', async () => {
    const { statusService } = await import('./statusService');
    await expect(
      statusService.submitStatusUpdate(172, 'Win', 'Loss', 'Correction', 'user-1')
    ).rejects.toThrow('Database unavailable');
  });
});
