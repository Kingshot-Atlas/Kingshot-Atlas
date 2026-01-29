import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilterOptions, SortOptions } from '../types';
import { apiService } from '../services/api';

// Query keys for consistent cache management
export const kingdomKeys = {
  all: ['kingdoms'] as const,
  lists: () => [...kingdomKeys.all, 'list'] as const,
  list: (filters?: FilterOptions, sort?: SortOptions) => [...kingdomKeys.lists(), { filters, sort }] as const,
  details: () => [...kingdomKeys.all, 'detail'] as const,
  detail: (id: number) => [...kingdomKeys.details(), id] as const,
  leaderboard: (limit: number) => [...kingdomKeys.all, 'leaderboard', limit] as const,
  compare: (ids: number[]) => [...kingdomKeys.all, 'compare', ids] as const,
};

/**
 * Hook for fetching all kingdoms with optional filters and sorting
 */
export function useKingdoms(filters?: FilterOptions, sort?: SortOptions) {
  return useQuery({
    queryKey: kingdomKeys.list(filters, sort),
    queryFn: () => apiService.getKingdoms(filters, sort),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching a single kingdom profile
 */
export function useKingdomProfile(kingdomNumber: number | undefined) {
  return useQuery({
    queryKey: kingdomKeys.detail(kingdomNumber!),
    queryFn: () => apiService.getKingdomProfile(kingdomNumber!),
    enabled: !!kingdomNumber,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching leaderboard data
 */
export function useLeaderboard(limit: number = 50) {
  return useQuery({
    queryKey: kingdomKeys.leaderboard(limit),
    queryFn: () => apiService.getLeaderboard(limit),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for comparing multiple kingdoms
 */
export function useCompareKingdoms(kingdomNumbers: number[]) {
  return useQuery({
    queryKey: kingdomKeys.compare(kingdomNumbers),
    queryFn: () => apiService.compareKingdoms(kingdomNumbers),
    enabled: kingdomNumbers.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for searching kingdoms
 */
export function useSearchKingdoms(query: string) {
  return useQuery({
    queryKey: [...kingdomKeys.all, 'search', query],
    queryFn: () => apiService.searchKingdoms(query),
    enabled: query.length > 0,
    staleTime: 60 * 1000, // 1 minute for search results
  });
}

/**
 * Hook for managing favorites with optimistic updates
 */
export function useFavorites() {
  const FAVORITES_KEY = 'kingshot_favorites';
  
  const getFavorites = (): number[] => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  };
  
  const saveFavorites = (favorites: number[]) => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  };
  
  const toggleFavorite = (kingdomNumber: number): { added: boolean; favorites: number[] } => {
    const current = getFavorites();
    const isFavorite = current.includes(kingdomNumber);
    
    const updated = isFavorite
      ? current.filter(k => k !== kingdomNumber)
      : [...current, kingdomNumber];
    
    saveFavorites(updated);
    return { added: !isFavorite, favorites: updated };
  };
  
  const isFavorite = (kingdomNumber: number): boolean => {
    return getFavorites().includes(kingdomNumber);
  };
  
  return {
    getFavorites,
    toggleFavorite,
    isFavorite,
  };
}

/**
 * Prefetch kingdom data for faster navigation
 */
export function usePrefetchKingdom() {
  const queryClient = useQueryClient();
  
  return (kingdomNumber: number) => {
    queryClient.prefetchQuery({
      queryKey: kingdomKeys.detail(kingdomNumber),
      queryFn: () => apiService.getKingdomProfile(kingdomNumber),
      staleTime: 5 * 60 * 1000,
    });
  };
}
