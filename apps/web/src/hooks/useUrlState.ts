import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterOptions, SortOptions } from '../types';

const PREFERENCES_KEY = 'kingshot_preferences';

interface Preferences {
  viewMode: 'grid' | 'table';
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_PREFERENCES: Preferences = {
  viewMode: 'grid',
  sortBy: 'overall_score',
  sortOrder: 'desc'
};

export const useUrlState = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const getFiltersFromUrl = useCallback((): Partial<FilterOptions> => {
    const filters: Partial<FilterOptions> = {};
    
    const status = searchParams.get('status');
    if (status && status !== 'all') filters.status = status;
    
    const tier = searchParams.get('tier');
    if (tier && tier !== 'all') filters.tier = tier;
    
    const minKvKs = searchParams.get('minKvKs');
    if (minKvKs) filters.minKvKs = parseInt(minKvKs);
    
    const maxKvKs = searchParams.get('maxKvKs');
    if (maxKvKs && parseInt(maxKvKs) < 99) filters.maxKvKs = parseInt(maxKvKs);
    
    const minPrepWinRate = searchParams.get('minPrepWR');
    if (minPrepWinRate) filters.minPrepWinRate = parseFloat(minPrepWinRate);
    
    const minBattleWinRate = searchParams.get('minBattleWR');
    if (minBattleWinRate) filters.minBattleWinRate = parseFloat(minBattleWinRate);
    
    return filters;
  }, [searchParams]);

  const getSortFromUrl = useCallback((): Partial<SortOptions> => {
    const sort: Partial<SortOptions> = {};
    
    const sortBy = searchParams.get('sortBy');
    if (sortBy) sort.sortBy = sortBy as SortOptions['sortBy'];
    
    const order = searchParams.get('order');
    if (order === 'asc' || order === 'desc') sort.order = order;
    
    return sort;
  }, [searchParams]);

  const getSearchFromUrl = useCallback((): string => {
    return searchParams.get('q') || '';
  }, [searchParams]);

  const updateUrl = useCallback((
    filters: FilterOptions,
    sort: SortOptions,
    search: string
  ) => {
    const params = new URLSearchParams();
    
    // Only add non-default values to URL
    if (search) params.set('q', search);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.tier && filters.tier !== 'all') params.set('tier', filters.tier);
    if (filters.minKvKs && filters.minKvKs > 0) params.set('minKvKs', filters.minKvKs.toString());
    if (filters.maxKvKs && filters.maxKvKs < 99) params.set('maxKvKs', filters.maxKvKs.toString());
    if (filters.minPrepWinRate && filters.minPrepWinRate > 0) params.set('minPrepWR', filters.minPrepWinRate.toString());
    if (filters.minBattleWinRate && filters.minBattleWinRate > 0) params.set('minBattleWR', filters.minBattleWinRate.toString());
    if (sort.sortBy !== 'overall_score') params.set('sortBy', sort.sortBy);
    if (sort.order !== 'desc') params.set('order', sort.order);
    
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  return {
    getFiltersFromUrl,
    getSortFromUrl,
    getSearchFromUrl,
    updateUrl
  };
};

export const usePreferences = () => {
  const loadPreferences = useCallback((): Preferences => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load preferences:', e);
    }
    return DEFAULT_PREFERENCES;
  }, []);

  const savePreferences = useCallback((prefs: Partial<Preferences>) => {
    try {
      const current = loadPreferences();
      const updated = { ...current, ...prefs };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save preferences:', e);
    }
  }, [loadPreferences]);

  return { loadPreferences, savePreferences };
};
