import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { adminKeys } from '../useAdminQueries';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

vi.mock('../../services/authHeaders', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/statusService', () => ({
  statusService: {
    fetchAllSubmissions: vi.fn().mockResolvedValue([]),
  },
}));

// Helper to create a fresh QueryClient + wrapper for each test
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

describe('adminKeys', () => {
  it('generates correct query key structures', () => {
    expect(adminKeys.all).toEqual(['admin']);
    expect(adminKeys.pendingCounts()).toEqual(['admin', 'pendingCounts']);
    expect(adminKeys.submissions('pending')).toEqual(['admin', 'submissions', 'pending']);
    expect(adminKeys.claims('all')).toEqual(['admin', 'claims', 'all']);
    expect(adminKeys.feedback('new')).toEqual(['admin', 'feedback', 'new']);
    expect(adminKeys.feedbackCounts()).toEqual(['admin', 'feedbackCounts']);
    expect(adminKeys.unreadEmails()).toEqual(['admin', 'unreadEmails']);
    expect(adminKeys.webhookEvents('failed')).toEqual(['admin', 'webhookEvents', 'failed']);
    expect(adminKeys.webhookStats()).toEqual(['admin', 'webhookStats']);
    expect(adminKeys.transferApplications('pending')).toEqual(['admin', 'transferApps', 'pending']);
    expect(adminKeys.transferAnalytics()).toEqual(['admin', 'transferAnalytics']);
  });

  it('creates unique keys for different filters', () => {
    const key1 = adminKeys.submissions('pending');
    const key2 = adminKeys.submissions('approved');
    expect(key1).not.toEqual(key2);
  });
});

describe('useAdminPendingCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch globally
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it('returns default counts when disabled', async () => {
    const { useAdminPendingCounts } = await import('../useAdminQueries');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAdminPendingCounts(false), { wrapper });

    // When disabled, should not fetch and data should be undefined
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it('fetches counts when enabled', async () => {
    const { useAdminPendingCounts } = await import('../useAdminQueries');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAdminPendingCounts(true), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return a counts object with expected keys
    expect(result.current.data).toHaveProperty('submissions');
    expect(result.current.data).toHaveProperty('claims');
    expect(result.current.data).toHaveProperty('corrections');
    expect(result.current.data).toHaveProperty('transfers');
    expect(result.current.data).toHaveProperty('kvkErrors');
    expect(result.current.data).toHaveProperty('feedback');
  });
});

describe('useInvalidateAdmin', () => {
  it('provides invalidation functions', async () => {
    const { useInvalidateAdmin } = await import('../useAdminQueries');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInvalidateAdmin(), { wrapper });

    expect(typeof result.current.invalidatePendingCounts).toBe('function');
    expect(typeof result.current.invalidateSubmissions).toBe('function');
    expect(typeof result.current.invalidateFeedback).toBe('function');
    expect(typeof result.current.invalidateAll).toBe('function');
  });
});
