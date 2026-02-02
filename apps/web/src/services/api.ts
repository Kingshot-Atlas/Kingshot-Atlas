import { Kingdom, KingdomProfile, KVKRecord, FilterOptions, SortOptions, getPowerTier, PaginatedResponse } from '../types';
import { logger } from '../utils/logger';
import { kvkCorrectionService } from './kvkCorrectionService';
import { kvkHistoryService } from './kvkHistoryService';
import { kingdomsSupabaseService } from './kingdomsSupabaseService';

// ADR-011: Supabase is the SINGLE SOURCE OF TRUTH for kingdom data
// JSON fallback removed to prevent stale data from being displayed
// If Supabase is unavailable, show error state rather than incorrect data

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CACHE_KEY = 'kingshot_kingdom_cache';
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_RETRIES = 2;

// ADR-011: Supabase is the SINGLE SOURCE OF TRUTH
// These flags track data loading status
export let supabaseDataLoaded = false;
export let supabaseKingdomsLoaded = false;
export let dataLoadError: string | null = null;

// Promise that resolves when initial data load is complete
let preloadPromise: Promise<void> | null = null;

const preloadSupabaseData = async () => {
  try {
    // Fetch corrections first
    await kvkCorrectionService.fetchCorrectionsFromSupabase();
    
    // Load kingdoms from Supabase kingdoms table (SINGLE SOURCE OF TRUTH)
    const supabaseKingdoms = await kingdomsSupabaseService.getAllKingdoms();
    if (supabaseKingdoms.length > 0) {
      realKingdoms = supabaseKingdoms;
      supabaseKingdomsLoaded = true;
      supabaseDataLoaded = true;
      dataLoadError = null;
      logger.info(`Loaded ${supabaseKingdoms.length} kingdoms from Supabase kingdoms table (SOURCE OF TRUTH)`);
    } else {
      // No fallback - Supabase is empty, this is an error state
      dataLoadError = 'Kingdom data unavailable. Please try again later.';
      logger.error('Supabase kingdoms table is empty - no data to display');
    }
  } catch (err) {
    // No fallback - show error state instead of stale data
    dataLoadError = 'Failed to load kingdom data. Please check your connection.';
    logger.error('Supabase preload failed:', err);
  }
};

// Start preloading immediately and store the promise
preloadPromise = preloadSupabaseData();

// ADR-011: Kingdom data comes exclusively from Supabase
// This array is populated by preloadSupabaseData() on module load
let realKingdoms: Kingdom[] = [];

class ApiService {
  constructor() {
    // Clear stale cache on initialization
    this.clearCache();
  }

  clearCache(): void {
    localStorage.removeItem(CACHE_KEY);
  }

  /**
   * Reload kingdom data from Supabase (single source of truth)
   * Call this after approving/rejecting submissions or applying corrections
   */
  reloadData(): void {
    // Trigger async reload from Supabase
    this.reloadWithSupabaseData();
  }

  /**
   * Reload with fresh Supabase data
   * Call this after KvK submissions are approved or corrections are applied
   */
  async reloadWithSupabaseData(): Promise<void> {
    try {
      // Invalidate all caches
      kvkHistoryService.invalidateCache();
      kingdomsSupabaseService.invalidateCache();
      
      // Reload from Supabase kingdoms table (SINGLE SOURCE OF TRUTH)
      const supabaseKingdoms = await kingdomsSupabaseService.getAllKingdoms();
      if (supabaseKingdoms.length > 0) {
        realKingdoms = supabaseKingdoms;
        supabaseKingdomsLoaded = true;
        supabaseDataLoaded = true;
        dataLoadError = null;
        logger.info(`Reloaded ${supabaseKingdoms.length} kingdoms from Supabase`);
      } else {
        // ADR-011: No fallback - if Supabase is empty, this is an error
        dataLoadError = 'Kingdom data unavailable after reload.';
        logger.error('Supabase kingdoms table empty after reload');
      }
      this.clearCache();
    } catch (err) {
      dataLoadError = 'Failed to reload kingdom data.';
      logger.error('Failed to reload Supabase data:', err);
    }
  }

  private enrichKingdom(kingdom: Kingdom): Kingdom {
    // Look up the authoritative data from realKingdoms (loaded from Supabase)
    // This ensures we always have correct dominations/invasions/streaks even if API doesn't provide them
    const localData = realKingdoms.find(k => k.kingdom_number === kingdom.kingdom_number);
    
    return {
      ...kingdom,
      power_tier: kingdom.power_tier || getPowerTier(kingdom.overall_score),
      // Use Supabase data as source of truth for these calculated fields
      dominations: kingdom.dominations ?? localData?.dominations ?? 0,
      invasions: kingdom.invasions ?? localData?.invasions ?? 0,
      prep_streak: kingdom.prep_streak ?? localData?.prep_streak ?? 0,
      battle_streak: kingdom.battle_streak ?? localData?.battle_streak ?? 0
    };
  }

  private async fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchWithRetry<T>(endpoint: string, retries: number = MAX_RETRIES): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries && (error as Error).name !== 'AbortError') {
          // Exponential backoff: 100ms, 200ms, 400ms...
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        }
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }

  private async fetchWithFallback<T>(endpoint: string, fallbackData: T): Promise<T> {
    try {
      return await this.fetchWithRetry<T>(endpoint);
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using fallback data:`, error);
      return fallbackData;
    }
  }

  async getKingdoms(filters?: FilterOptions, sort?: SortOptions, _useCache: boolean = true): Promise<Kingdom[]> {
    // Wait for initial Supabase data load to complete
    // This ensures we always serve fresh data from Supabase, not stale local JSON
    if (preloadPromise) {
      await preloadPromise;
    }
    
    // Return data from Supabase (source of truth) with filters/sort applied
    return this.applyFiltersAndSort(realKingdoms, filters, sort);
  }

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
    
    const queryString = params.toString();
    const endpoint = `/api/v1/kingdoms?${queryString}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data: PaginatedResponse<Kingdom> = await response.json();
      return {
        ...data,
        items: data.items.map((k: Kingdom) => this.enrichKingdom(k))
      };
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using local data:`, error);
      // Fallback to local data with manual pagination
      const filtered = this.applyFiltersAndSort(realKingdoms, filters, sort);
      const total = filtered.length;
      const totalPages = Math.ceil(total / pageSize);
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { items, total, page, page_size: pageSize, total_pages: totalPages };
    }
  }

  private applyFiltersAndSort(kingdoms: Kingdom[], filters?: FilterOptions, sort?: SortOptions): Kingdom[] {
    let result = [...kingdoms];
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        result = result.filter(k => k.most_recent_status === filters.status);
      }
      if (filters.minKvKs) result = result.filter(k => k.total_kvks >= filters.minKvKs!);
      if (filters.minPrepWinRate) result = result.filter(k => k.prep_win_rate >= filters.minPrepWinRate!);
      if (filters.minBattleWinRate) result = result.filter(k => k.battle_win_rate >= filters.minBattleWinRate!);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: number, bVal: number;
        switch (sort.sortBy) {
          case 'overall_score': aVal = a.overall_score; bVal = b.overall_score; break;
          case 'kingdom_number': aVal = a.kingdom_number; bVal = b.kingdom_number; break;
          case 'prep_win_rate': aVal = a.prep_win_rate; bVal = b.prep_win_rate; break;
          case 'battle_win_rate': aVal = a.battle_win_rate; bVal = b.battle_win_rate; break;
          case 'total_kvks': aVal = a.total_kvks; bVal = b.total_kvks; break;
          default: aVal = a.overall_score; bVal = b.overall_score;
        }
        return sort.order === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }
    return result;
  }

  async getKingdomProfile(kingdomNumber: number): Promise<KingdomProfile | null> {
    // Wait for initial Supabase data load to complete
    if (preloadPromise) {
      await preloadPromise;
    }
    
    // PRIORITY 1: Use Supabase data (single source of truth)
    // realKingdoms is loaded from Supabase kingdoms table at startup
    if (supabaseKingdomsLoaded) {
      const kingdom = realKingdoms.find(k => k.kingdom_number === kingdomNumber);
      if (kingdom) {
        logger.log(`Kingdom ${kingdomNumber} loaded from Supabase (source of truth)`);
        const profile: KingdomProfile = {
          ...kingdom,
          rank: kingdom.rank,
          recent_kvks: kingdom.recent_kvks || []
        };
        return profile;
      }
    }
    
    // FALLBACK: Try API if Supabase data not available
    const endpoint = `/api/v1/kingdoms/${kingdomNumber}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        if (response.status === 404) {
          // API returned 404 - try local data fallback before giving up
          const kingdom = realKingdoms.find(k => k.kingdom_number === kingdomNumber);
          if (kingdom) {
            logger.log(`Kingdom ${kingdomNumber} not in API, using local data`);
            const profile: KingdomProfile = {
              ...kingdom,
              rank: kingdom.rank,
              recent_kvks: kingdom.recent_kvks || []
            };
            return profile;
          }
          return null;
        }
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      // Enrich the data to ensure all fields are present
      return this.enrichKingdom(data) as KingdomProfile;
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using local data:`, error);
      const kingdom = realKingdoms.find(k => k.kingdom_number === kingdomNumber);
      if (!kingdom) return null;
      
      // realKingdoms already has all fields from Supabase
      const profile: KingdomProfile = {
        ...kingdom,
        rank: kingdom.rank,
        recent_kvks: kingdom.recent_kvks || []
      };
      
      return profile;
    }
  }

  async getLeaderboard(limit: number = 50): Promise<Kingdom[]> {
    // Wait for initial Supabase data load to complete
    if (preloadPromise) {
      await preloadPromise;
    }
    const sortedKingdoms = [...realKingdoms].sort((a, b) => b.overall_score - a.overall_score).slice(0, limit);
    return this.fetchWithFallback(`/api/v1/leaderboard?limit=${limit}`, sortedKingdoms);
  }

  async compareKingdoms(kingdomNumbers: number[]): Promise<KingdomProfile[]> {
    const endpoint = `/api/v1/compare?kingdoms=${kingdomNumbers.join(',')}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      // Handle the actual API response structure
      if (data.kingdoms && Array.isArray(data.kingdoms)) {
        return data.kingdoms.map((item: { kingdom: Kingdom; recent_kvks?: KVKRecord[] }) => this.enrichKingdom({
          ...item.kingdom,
          recent_kvks: item.recent_kvks || []
        }) as KingdomProfile);
      }
      // Fallback: if it's already an array, enrich each item
      if (Array.isArray(data)) {
        return data.map((k: Kingdom) => this.enrichKingdom(k) as KingdomProfile);
      }
      return [];
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using fallback:`, error);
      // Fallback: call individual kingdom profiles (already enriched)
      const profiles: KingdomProfile[] = [];
      
      for (const number of kingdomNumbers) {
        const profile = await this.getKingdomProfile(number);
        if (profile) profiles.push(profile);
      }
      
      return profiles;
    }
  }

  async searchKingdoms(query: string): Promise<Kingdom[]> {
    // Wait for initial Supabase data load to complete
    if (preloadPromise) {
      await preloadPromise;
    }
    
    // Use the main kingdoms endpoint with search parameter
    const endpoint = `/api/v1/kingdoms?search=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      // Handle both paginated and legacy array responses
      return data.items || data;
    } catch (error) {
      logger.warn(`API call failed for ${endpoint}, using local data:`, error);
      const filtered = realKingdoms.filter(k => 
        k.kingdom_number.toString().includes(query)
      );
      return filtered;
    }
  }
}

export const apiService = new ApiService();
