/**
 * Kingdom API service for Kingshot Atlas.
 * Handles all kingdom-related API calls with caching and fallback support.
 */
import { Kingdom, KingdomProfile, KVKRecord, FilterOptions, SortOptions, PaginatedResponse } from '../types';
import { logger } from '../utils/logger';
import { loadCache, saveCache, clearCache, CacheData } from './cache';
import { enrichKingdom, toKingdomProfile } from './transformers';
import { applyFiltersAndSort, paginate } from './filters';
import { kingdomsSupabaseService } from './kingdomsSupabaseService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Get kingdoms from Supabase (single source of truth)
const getSupabaseKingdoms = async (): Promise<Kingdom[]> => {
  try {
    return await kingdomsSupabaseService.getAllKingdoms();
  } catch (err) {
    logger.warn('Failed to get kingdoms from Supabase:', err);
    return [];
  }
};

class KingdomService {
  private cache: CacheData | null = null;

  constructor() {
    // Clear stale cache on initialization
    clearCache();
  }

  /**
   * Clear the cache.
   */
  clearCache(): void {
    clearCache();
    this.cache = null;
  }

  /**
   * Fetch with fallback to local data.
   */
  private async fetchWithFallback<T>(endpoint: string, fallbackData: T): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using local data:`, error);
      return fallbackData;
    }
  }

  /**
   * Get kingdoms with optional filtering and sorting.
   */
  async getKingdoms(
    filters?: FilterOptions,
    sort?: SortOptions,
    useCache: boolean = true
  ): Promise<Kingdom[]> {
    // Check cache first
    if (useCache) {
      const cached = this.cache || loadCache();
      if (cached) {
        logger.log('Using cached kingdom data');
        return applyFiltersAndSort(cached.kingdoms, filters, sort);
      }
    }

    const params = new URLSearchParams();
    if (filters) {
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.minKvKs) params.append('min_kvks', filters.minKvKs.toString());
      if (filters.minPrepWinRate) params.append('min_prep_win_rate', filters.minPrepWinRate.toString());
      if (filters.minBattleWinRate) params.append('min_battle_win_rate', filters.minBattleWinRate.toString());
    }
    if (sort) {
      params.append('sort', sort.sortBy);
      params.append('order', sort.order);
    }
    params.append('page_size', '100');
    
    const queryString = params.toString();
    const endpoint = `/api/v1/kingdoms${queryString ? '?' + queryString : ''}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      const kingdoms = data.items || data;
      const enriched = kingdoms.map((k: Kingdom) => enrichKingdom(k));
      this.cache = saveCache(enriched);
      return enriched;
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using Supabase fallback:`, error);
      const supabaseKingdoms = await getSupabaseKingdoms();
      return applyFiltersAndSort(supabaseKingdoms, filters, sort);
    }
  }

  /**
   * Get kingdoms with pagination.
   */
  async getKingdomsPaginated(
    page: number = 1,
    pageSize: number = 50,
    filters?: FilterOptions,
    sort?: SortOptions
  ): Promise<PaginatedResponse<Kingdom>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    
    if (filters) {
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.minKvKs) params.append('min_kvks', filters.minKvKs.toString());
      if (filters.minPrepWinRate) params.append('min_prep_wr', filters.minPrepWinRate.toString());
      if (filters.minBattleWinRate) params.append('min_battle_wr', filters.minBattleWinRate.toString());
    }
    if (sort) {
      params.append('sort', sort.sortBy);
      params.append('order', sort.order);
    }
    
    const endpoint = `/api/v1/kingdoms?${params.toString()}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data: PaginatedResponse<Kingdom> = await response.json();
      return {
        ...data,
        items: data.items.map((k: Kingdom) => enrichKingdom(k))
      };
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using Supabase fallback:`, error);
      const supabaseKingdoms = await getSupabaseKingdoms();
      const filtered = applyFiltersAndSort(supabaseKingdoms, filters, sort);
      const { items, total, totalPages } = paginate(filtered, page, pageSize);
      return { items, total, page, page_size: pageSize, total_pages: totalPages };
    }
  }

  /**
   * Get a single kingdom profile.
   */
  async getKingdomProfile(kingdomNumber: number): Promise<KingdomProfile | null> {
    const endpoint = `/api/v1/kingdoms/${kingdomNumber}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        if (response.status === 404) {
          // API returned 404 - try Supabase fallback before giving up
          const supabaseKingdoms = await getSupabaseKingdoms();
          const kingdom = supabaseKingdoms.find(k => k.kingdom_number === kingdomNumber);
          if (kingdom) {
            logger.log(`Kingdom ${kingdomNumber} not in API, using Supabase`);
            return toKingdomProfile(kingdom);
          }
          return null;
        }
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using Supabase fallback:`, error);
      const supabaseKingdoms = await getSupabaseKingdoms();
      const kingdom = supabaseKingdoms.find(k => k.kingdom_number === kingdomNumber);
      if (!kingdom) return null;
      return toKingdomProfile(kingdom);
    }
  }

  /**
   * Get leaderboard data.
   */
  async getLeaderboard(limit: number = 50): Promise<Kingdom[]> {
    const supabaseKingdoms = await getSupabaseKingdoms();
    const sortedKingdoms = [...supabaseKingdoms]
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, limit);
    return this.fetchWithFallback(`/api/v1/leaderboard?limit=${limit}`, sortedKingdoms);
  }

  /**
   * Compare multiple kingdoms.
   */
  async compareKingdoms(kingdomNumbers: number[]): Promise<KingdomProfile[]> {
    const endpoint = `/api/v1/compare?kingdoms=${kingdomNumbers.join(',')}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.kingdoms && Array.isArray(data.kingdoms)) {
        return data.kingdoms.map((item: { kingdom: KingdomProfile; recent_kvks?: KVKRecord[] }) => ({
          ...item.kingdom,
          recent_kvks: item.recent_kvks || []
        }));
      }
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using fallback:`, error);
      const profiles: KingdomProfile[] = [];
      
      for (const number of kingdomNumbers) {
        const profile = await this.getKingdomProfile(number);
        if (profile) profiles.push(profile);
      }
      
      return profiles;
    }
  }

  /**
   * Search kingdoms by query.
   */
  async searchKingdoms(query: string): Promise<Kingdom[]> {
    const endpoint = `/api/v1/kingdoms?search=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      return data.items || data;
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using Supabase fallback:`, error);
      const supabaseKingdoms = await getSupabaseKingdoms();
      return supabaseKingdoms.filter(k => 
        k.kingdom_number.toString().includes(query)
      );
    }
  }
}

export const kingdomService = new KingdomService();
