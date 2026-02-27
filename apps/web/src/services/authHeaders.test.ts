import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock fn is available when vi.mock factory runs (hoisted)
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}));

import { getAuthHeaders } from './authHeaders';

// ============================================================================
// SUCCESSFUL AUTH
// ============================================================================

describe('getAuthHeaders — authenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Authorization, X-User-Id, X-User-Email headers', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token-abc',
          user: { id: 'user-123', email: 'player@ks-atlas.com' },
        },
      },
    });

    const headers = await getAuthHeaders();
    expect(headers).toEqual({
      Authorization: 'Bearer test-token-abc',
      'X-User-Id': 'user-123',
      'X-User-Email': 'player@ks-atlas.com',
    });
  });

  it('handles missing email gracefully', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: 'user-123', email: undefined },
        },
      },
    });

    const headers = await getAuthHeaders();
    expect(headers['X-User-Email']).toBe('');
  });

  it('handles missing user.id gracefully', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: undefined, email: 'test@test.com' },
        },
      },
    });

    const headers = await getAuthHeaders();
    expect(headers['X-User-Id']).toBe('');
  });
});

// ============================================================================
// NO SESSION — requireAuth: true (default)
// ============================================================================

describe('getAuthHeaders — no session, requireAuth=true', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(getAuthHeaders()).rejects.toThrow('Please sign in again to continue.');
  });

  it('throws when session has no access_token', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: null, user: null } },
    });
    await expect(getAuthHeaders()).rejects.toThrow('Please sign in again to continue.');
  });
});

// ============================================================================
// NO SESSION — requireAuth: false
// ============================================================================

describe('getAuthHeaders — no session, requireAuth=false', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty object when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const headers = await getAuthHeaders({ requireAuth: false });
    expect(headers).toEqual({});
  });
});

// ============================================================================
// SUPABASE NOT CONFIGURED
// ============================================================================

describe('getAuthHeaders — supabase not configured', () => {
  it('throws when supabase is null and requireAuth=true', async () => {
    // Override the mock to return null supabase
    vi.doMock('../lib/supabase', () => ({ supabase: null }));
    vi.resetModules();
    const { getAuthHeaders: freshGetAuthHeaders } = await import('./authHeaders');
    await expect(freshGetAuthHeaders()).rejects.toThrow('Supabase not configured');
  });

  it('returns empty when supabase is null and requireAuth=false', async () => {
    vi.doMock('../lib/supabase', () => ({ supabase: null }));
    vi.resetModules();
    const { getAuthHeaders: freshGetAuthHeaders } = await import('./authHeaders');
    const headers = await freshGetAuthHeaders({ requireAuth: false });
    expect(headers).toEqual({});
  });
});
