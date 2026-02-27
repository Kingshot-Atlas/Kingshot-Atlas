import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

vi.mock('../../services/statusService', () => ({
  statusService: { fetchAllSubmissions: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/reviewService', () => ({
  reviewService: { getAggregateRating: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

import { kingdomProfileKeys } from '../useKingdomProfileQueries';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

// ============================================================================
// QUERY KEYS
// ============================================================================

describe('kingdomProfileKeys', () => {
  it('generates fund key', () => {
    expect(kingdomProfileKeys.fund(172)).toEqual(['kingdom-fund', 172]);
  });

  it('generates fundTransactions key', () => {
    expect(kingdomProfileKeys.fundTransactions(231)).toEqual(['kingdom-fund-transactions', 231]);
  });

  it('generates pendingSubmissions key', () => {
    expect(kingdomProfileKeys.pendingSubmissions(100)).toEqual(['kingdom-pending-submissions', 100]);
  });

  it('generates editor key', () => {
    expect(kingdomProfileKeys.editor(42)).toEqual(['kingdom-editor', 42]);
  });

  it('generates aggregateRating key', () => {
    expect(kingdomProfileKeys.aggregateRating(999)).toEqual(['kingdom-aggregate-rating', 999]);
  });

  it('creates unique keys for different kingdoms', () => {
    expect(kingdomProfileKeys.fund(1)).not.toEqual(kingdomProfileKeys.fund(2));
  });
});

// ============================================================================
// HOOK BEHAVIOR — useKingdomFund
// ============================================================================

describe('useKingdomFund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when kingdomNumber is undefined', async () => {
    const { useKingdomFund } = await import('../useKingdomProfileQueries');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useKingdomFund(undefined), { wrapper });

    // Should not be loading since disabled
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns null when supabase is not configured', async () => {
    const { useKingdomFund } = await import('../useKingdomProfileQueries');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useKingdomFund(172), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });
});

// ============================================================================
// HOOK BEHAVIOR — useFundTransactions
// ============================================================================

describe('useFundTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when kingdomNumber is undefined', async () => {
    const { useFundTransactions } = await import('../useKingdomProfileQueries');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFundTransactions(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns empty array when supabase is not configured', async () => {
    const { useFundTransactions } = await import('../useKingdomProfileQueries');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFundTransactions(172), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});
