import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { kingdomKeys } from '../useKingdoms';

// Mock dependencies
vi.mock('../../services/api', () => ({
  apiService: {
    getKingdoms: vi.fn().mockResolvedValue([]),
    getKingdomProfile: vi.fn().mockResolvedValue(null),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    compareKingdoms: vi.fn().mockResolvedValue([]),
    searchKingdoms: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../contexts/FavoritesContext', () => ({
  useFavoritesContext: vi.fn().mockReturnValue({
    favorites: [1, 2, 3],
    toggleFavorite: vi.fn(),
    isFavorite: vi.fn((n: number) => [1, 2, 3].includes(n)),
  }),
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

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

describe('kingdomKeys', () => {
  it('generates correct base key', () => {
    expect(kingdomKeys.all).toEqual(['kingdoms']);
  });

  it('generates list keys', () => {
    expect(kingdomKeys.lists()).toEqual(['kingdoms', 'list']);
  });

  it('generates list keys with filters and sort', () => {
    const filters = { tier: 'S' as const };
    const sort = { sortBy: 'overall_score' as const, order: 'desc' as const };
    const key = kingdomKeys.list(filters, sort);
    expect(key[0]).toBe('kingdoms');
    expect(key[1]).toBe('list');
    expect(key[2]).toEqual({ filters, sort });
  });

  it('generates detail keys', () => {
    expect(kingdomKeys.details()).toEqual(['kingdoms', 'detail']);
    expect(kingdomKeys.detail(231)).toEqual(['kingdoms', 'detail', 231]);
  });

  it('generates leaderboard keys', () => {
    expect(kingdomKeys.leaderboard(50)).toEqual(['kingdoms', 'leaderboard', 50]);
    expect(kingdomKeys.leaderboard(10)).toEqual(['kingdoms', 'leaderboard', 10]);
  });

  it('generates compare keys', () => {
    expect(kingdomKeys.compare([1, 2, 3])).toEqual(['kingdoms', 'compare', [1, 2, 3]]);
  });

  it('creates unique keys for different filters', () => {
    const key1 = kingdomKeys.list({ tier: 'S' as const });
    const key2 = kingdomKeys.list({ tier: 'A' as const });
    expect(key1).not.toEqual(key2);
  });
});

// ============================================================================
// HOOK BEHAVIOR
// ============================================================================

describe('useKingdoms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches kingdoms list', async () => {
    const { apiService } = await import('../../services/api');
    (apiService.getKingdoms as ReturnType<typeof vi.fn>).mockResolvedValue([
      { kingdom_number: 1, name: 'K1' },
      { kingdom_number: 2, name: 'K2' },
    ]);

    const { useKingdoms } = await import('../useKingdoms');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useKingdoms(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
  });
});

describe('useKingdomProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when kingdomNumber is undefined', async () => {
    const { apiService } = await import('../../services/api');
    const { useKingdomProfile } = await import('../useKingdoms');
    const { wrapper } = createWrapper();

    renderHook(() => useKingdomProfile(undefined), { wrapper });

    // Should not call the API when disabled
    expect(apiService.getKingdomProfile).not.toHaveBeenCalled();
  });

  it('fetches when kingdomNumber is provided', async () => {
    const { apiService } = await import('../../services/api');
    (apiService.getKingdomProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      kingdom_number: 231,
      overall_score: 82.39,
    });

    const { useKingdomProfile } = await import('../useKingdoms');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useKingdomProfile(231), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('kingdom_number', 231);
  });
});

describe('useCompareKingdoms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch with fewer than 2 kingdoms', async () => {
    const { apiService } = await import('../../services/api');
    const { useCompareKingdoms } = await import('../useKingdoms');
    const { wrapper } = createWrapper();

    renderHook(() => useCompareKingdoms([1]), { wrapper });

    expect(apiService.compareKingdoms).not.toHaveBeenCalled();
  });
});

describe('useSearchKingdoms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch with empty query', async () => {
    const { apiService } = await import('../../services/api');
    const { useSearchKingdoms } = await import('../useKingdoms');
    const { wrapper } = createWrapper();

    renderHook(() => useSearchKingdoms(''), { wrapper });

    expect(apiService.searchKingdoms).not.toHaveBeenCalled();
  });
});

describe('useFavorites', () => {
  it('returns favorites and toggle function', async () => {
    const { useFavorites } = await import('../useKingdoms');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFavorites(), { wrapper });

    expect(result.current.getFavorites()).toEqual([1, 2, 3]);
    expect(result.current.isFavorite(1)).toBe(true);
    expect(result.current.isFavorite(999)).toBe(false);
    expect(typeof result.current.toggleFavorite).toBe('function');
  });
});
