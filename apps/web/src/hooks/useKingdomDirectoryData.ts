import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Kingdom, FilterOptions, SortOptions, getPowerTier } from '../types';
import { addRanksToKingdoms } from '../utils/rankCalculation';
import { apiService } from '../services/api';
import { useToast } from '../components/Toast';
import { logger } from '../utils/logger';
import { usePreferences } from '../hooks/useUrlState';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { countActiveFilters, DEFAULT_FILTERS, getOutcomeValue } from '../utils/kingdomStats';
import { useTranslation } from 'react-i18next';
import { parseTransferGroupValue } from '../config/transferGroups';

/**
 * Custom hook that manages all kingdom directory data logic:
 * - Data fetching
 * - Search with debounce
 * - Filtering & sorting
 * - Pagination (display count + load more)
 * - Favorites filtering
 * - Transfer group filtering
 *
 * Extracted from KingdomDirectory.tsx to reduce component complexity.
 */
export function useKingdomDirectoryData() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { loadPreferences, savePreferences } = usePreferences();
  const { favorites } = useFavoritesContext();

  // ─── Data fetching ───────────────────────────────────────────────
  const [allKingdoms, setAllKingdoms] = useState<Kingdom[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Search ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ─── Filters & Sort ──────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    minKvKs: 0,
    maxKvKs: 99,
    minPrepWinRate: 0,
    minBattleWinRate: 0,
    tier: 'all',
    minAtlasScore: 0
  });

  const [sort, _setSort] = useState<SortOptions>(() => {
    const prefs = loadPreferences();
    return {
      sortBy: (prefs.sortBy as SortOptions['sortBy']) || 'overall_score',
      order: (prefs.sortOrder as 'asc' | 'desc') || 'desc'
    };
  });

  const setSort = useCallback((newSort: SortOptions) => {
    _setSort(newSort);
    savePreferences({ sortBy: newSort.sortBy, sortOrder: newSort.order });
  }, [savePreferences]);

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => searchParams.get('favorites') === 'true');
  const [transferGroupFilter, _setTransferGroupFilter] = useState<string>(() => {
    return localStorage.getItem('kingshot_transferGroup') || 'all';
  });

  const setTransferGroupFilter = useCallback((val: string) => {
    _setTransferGroupFilter(val);
    localStorage.setItem('kingshot_transferGroup', val);
  }, []);

  // ─── Pagination ──────────────────────────────────────────────────
  const [displayCount, setDisplayCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

  // ─── Recently viewed ─────────────────────────────────────────────
  const [recentlyViewed, setRecentlyViewed] = useState<number[]>(() => {
    const saved = localStorage.getItem('kingshot_recently_viewed');
    return saved ? JSON.parse(saved) : [];
  });

  // ─── Effects ─────────────────────────────────────────────────────

  // Sync showFavoritesOnly with URL query param (header heart badge toggle)
  useEffect(() => {
    const favParam = searchParams.get('favorites') === 'true';
    setShowFavoritesOnly(favParam);
  }, [searchParams]);

  // Debounced search - 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync search query to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    } else {
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  // Fetch kingdoms when sort changes
  useEffect(() => {
    const loadKingdoms = async () => {
      setLoading(true);
      try {
        const data = await apiService.getKingdoms(undefined, sort);
        setAllKingdoms(data);
      } catch (error) {
        logger.error('Failed to load kingdoms:', error);
        showToast('Failed to load kingdoms', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadKingdoms();
  }, [sort, showToast]);

  // ─── Derived data ────────────────────────────────────────────────

  const filteredKingdoms = useMemo(() => {
    let result = [...allKingdoms];
    
    if (showFavoritesOnly) {
      result = result.filter(k => favorites.includes(k.kingdom_number));
    }
    
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.trim();
      result = result.filter(k => k.kingdom_number.toString().includes(query));
    }
    
    if (filters.minKvKs && filters.minKvKs > 0) {
      result = result.filter(k => k.total_kvks >= filters.minKvKs!);
    }
    if (filters.maxKvKs && filters.maxKvKs < 99) {
      result = result.filter(k => k.total_kvks <= filters.maxKvKs!);
    }
    if (filters.minPrepWinRate && filters.minPrepWinRate > 0) {
      result = result.filter(k => k.prep_win_rate >= filters.minPrepWinRate!);
    }
    if (filters.minBattleWinRate && filters.minBattleWinRate > 0) {
      result = result.filter(k => k.battle_win_rate >= filters.minBattleWinRate!);
    }
    if (filters.tier && filters.tier !== 'all') {
      result = result.filter(k => (k.power_tier || getPowerTier(k.overall_score)) === filters.tier);
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter(k => k.most_recent_status === filters.status);
    }

    // Transfer group filter
    const tgRange = parseTransferGroupValue(transferGroupFilter);
    if (tgRange) {
      const [min, max] = tgRange;
      result = result.filter(k => k.kingdom_number >= min && k.kingdom_number <= max);
    }
    
    return result;
  }, [allKingdoms, debouncedSearch, filters, showFavoritesOnly, favorites, transferGroupFilter]);

  // Add rank based on overall_score order (all kingdoms, not just filtered)
  // Also apply frontend sorting for calculated fields
  const rankedKingdoms = useMemo(() => {
    const ranked = addRanksToKingdoms(filteredKingdoms, allKingdoms);
    
    // For calculated fields (comebacks, reversals), sort in frontend
    if (['comebacks', 'reversals', 'dominations', 'invasions'].includes(sort.sortBy)) {
      return [...ranked].sort((a, b) => {
        const aVal = getOutcomeValue(a, sort.sortBy);
        const bVal = getOutcomeValue(b, sort.sortBy);
        return sort.order === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }
    
    return ranked;
  }, [allKingdoms, filteredKingdoms, sort.sortBy, sort.order]);

  const displayedKingdoms = useMemo(() => rankedKingdoms.slice(0, displayCount), [rankedKingdoms, displayCount]);

  // ─── Actions ─────────────────────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    // Brief delay for visual feedback
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + 15, filteredKingdoms.length));
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, filteredKingdoms.length]);

  const hasAnyFilter = countActiveFilters(filters) > 0 || transferGroupFilter !== 'all' || sort.sortBy !== 'overall_score' || sort.order !== 'desc' || debouncedSearch.trim() !== '' || showFavoritesOnly;

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSort({ sortBy: 'overall_score', order: 'desc' });
    setTransferGroupFilter('all');
    setSearchQuery('');
    setShowFavoritesOnly(false);
    localStorage.removeItem('kingshot_rankings_kvkFilter');
    localStorage.removeItem('kingshot_rankings_displayCount');
    showToast(t('home.filtersCleared', 'All filters cleared'), 'info');
  }, [setSort, setTransferGroupFilter, showToast, t]);

  return {
    // Data
    allKingdoms,
    loading,
    filteredKingdoms,
    rankedKingdoms,
    displayedKingdoms,

    // Search
    searchQuery,
    setSearchQuery,
    debouncedSearch,

    // Filters & Sort
    filters,
    setFilters,
    sort,
    setSort,
    showFavoritesOnly,
    setShowFavoritesOnly,
    transferGroupFilter,
    setTransferGroupFilter,
    hasAnyFilter,
    clearAllFilters,

    // Pagination
    displayCount,
    setDisplayCount,
    loadingMore,
    handleLoadMore,

    // User data
    recentlyViewed,
    setRecentlyViewed,
  };
}
