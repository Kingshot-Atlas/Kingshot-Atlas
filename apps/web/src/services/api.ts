import { Kingdom, KingdomProfile, KVKRecord, FilterOptions, SortOptions, getPowerTier, PaginatedResponse } from '../types';
import kingdomData from '../data/kingdoms.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
const CACHE_KEY = 'kingshot_kingdom_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  kingdoms: Kingdom[];
  timestamp: number;
}

// Load real kingdom data from JSON
const loadKingdomData = (): Kingdom[] => {
  const kvksByKingdom: Record<number, KVKRecord[]> = {};
  
  // Group KvK records by kingdom
  for (const kvk of kingdomData.kvk_records) {
    const kNum = kvk.kingdom_number;
    if (!kvksByKingdom[kNum]) kvksByKingdom[kNum] = [];
    kvksByKingdom[kNum]!.push({
      id: kNum * 100 + kvk.kvk_number,
      kingdom_number: kNum,
      kvk_number: kvk.kvk_number,
      opponent_kingdom: kvk.opponent_kingdom || 0,
      prep_result: kvk.prep_result === 'W' ? 'Win' : 'Loss',
      battle_result: kvk.battle_result === 'W' ? 'Win' : 'Loss',
      overall_result: kvk.overall_result,
      date_or_order_index: kvk.date_or_order_index,
      created_at: kvk.date_or_order_index
    });
  }
  
  // Sort each kingdom's KvKs by kvk_number descending (most recent first)
  for (const kNum in kvksByKingdom) {
    kvksByKingdom[kNum]?.sort((a, b) => b.kvk_number - a.kvk_number);
  }
  
  // Build kingdom objects
  const kingdoms = kingdomData.kingdoms.map((k: any) => {
    const recentKvks = kvksByKingdom[k.kingdom_number] || [];
    
    return {
      kingdom_number: k.kingdom_number,
      total_kvks: k.total_kvks,
      prep_wins: k.prep_wins,
      prep_losses: k.prep_losses,
      prep_win_rate: k.prep_win_rate,
      prep_streak: k.prep_streak,
      battle_wins: k.battle_wins,
      battle_losses: k.battle_losses,
      battle_win_rate: k.battle_win_rate,
      battle_streak: k.battle_streak,
      // Use full history values from JSON data
      dominations: k.dominations ?? 0,
      defeats: k.defeats ?? 0,
      most_recent_status: 'Unannounced', // All statuses are Unannounced per user request
      overall_score: k.overall_score,
      power_tier: getPowerTier(k.overall_score),
      last_updated: new Date().toISOString(),
      recent_kvks: recentKvks
    } as Kingdom;
  });
  
  // Sort by overall_score descending to calculate ranks
  const sorted = [...kingdoms].sort((a, b) => b.overall_score - a.overall_score);
  
  // Assign ranks based on sorted position
  sorted.forEach((k, index) => {
    k.rank = index + 1;
  });
  
  return kingdoms;
};

const realKingdoms: Kingdom[] = loadKingdomData();

class ApiService {
  private cache: CacheData | null = null;

  constructor() {
    // Clear stale cache on initialization to fix any corrupted data
    this.clearCache();
  }

  clearCache(): void {
    localStorage.removeItem(CACHE_KEY);
    this.cache = null;
  }

  private loadCache(): CacheData | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as CacheData;
        if (Date.now() - data.timestamp < CACHE_EXPIRY_MS) {
          return data;
        }
      }
    } catch (e) {
      console.warn('Failed to load cache:', e);
    }
    return null;
  }

  private saveCache(kingdoms: Kingdom[]): void {
    try {
      const data: CacheData = { kingdoms, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      this.cache = data;
    } catch (e) {
      console.warn('Failed to save cache:', e);
    }
  }

  private enrichKingdom(kingdom: Kingdom): Kingdom {
    // Look up the authoritative data from realKingdoms (loaded from JSON)
    // This ensures we always have correct dominations/defeats/streaks even if API doesn't provide them
    const localData = realKingdoms.find(k => k.kingdom_number === kingdom.kingdom_number);
    
    return {
      ...kingdom,
      power_tier: kingdom.power_tier || getPowerTier(kingdom.overall_score),
      // Use local data as source of truth for these calculated fields
      dominations: kingdom.dominations ?? localData?.dominations ?? 0,
      defeats: kingdom.defeats ?? localData?.defeats ?? 0,
      prep_streak: kingdom.prep_streak ?? localData?.prep_streak ?? 0,
      battle_streak: kingdom.battle_streak ?? localData?.battle_streak ?? 0
    };
  }

  private async fetchWithFallback<T>(endpoint: string, fallbackData: T): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`API call failed for ${endpoint}, using mock data:`, error);
      return fallbackData;
    }
  }

  async getKingdoms(filters?: FilterOptions, sort?: SortOptions, useCache: boolean = true): Promise<Kingdom[]> {
    // Check cache first
    if (useCache) {
      const cached = this.cache || this.loadCache();
      if (cached) {
        console.log('Using cached kingdom data');
        return this.applyFiltersAndSort(cached.kingdoms, filters, sort);
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
    // Fetch all kingdoms (no pagination limit for full list)
    params.append('page_size', '2000');
    
    const queryString = params.toString();
    const endpoint = `/api/kingdoms${queryString ? '?' + queryString : ''}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      // Handle both paginated and legacy array responses
      const kingdoms = data.items || data;
      const enriched = kingdoms.map((k: Kingdom) => this.enrichKingdom(k));
      this.saveCache(enriched);
      return enriched;
    } catch (error) {
      console.warn(`API call failed for ${endpoint}, using local data:`, error);
      return this.applyFiltersAndSort(realKingdoms, filters, sort);
    }
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
    const endpoint = `/api/kingdoms?${queryString}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data: PaginatedResponse<Kingdom> = await response.json();
      return {
        ...data,
        items: data.items.map((k: Kingdom) => this.enrichKingdom(k))
      };
    } catch (error) {
      console.warn(`API call failed for ${endpoint}, using local data:`, error);
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
    const endpoint = `/api/kingdoms/${kingdomNumber}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      // Enrich the data to ensure all fields are present
      return this.enrichKingdom(data) as KingdomProfile;
    } catch (error) {
      console.warn(`API call failed for ${endpoint}, using local data:`, error);
      const kingdom = realKingdoms.find(k => k.kingdom_number === kingdomNumber);
      if (!kingdom) return null;
      
      // realKingdoms already has all fields from loadKingdomData
      const profile: KingdomProfile = {
        ...kingdom,
        rank: kingdom.rank,
        recent_kvks: kingdom.recent_kvks || []
      };
      
      return profile;
    }
  }

  async getLeaderboard(limit: number = 50): Promise<Kingdom[]> {
    const sortedKingdoms = [...realKingdoms].sort((a, b) => b.overall_score - a.overall_score).slice(0, limit);
    return this.fetchWithFallback(`/api/leaderboard?limit=${limit}`, sortedKingdoms);
  }

  async compareKingdoms(kingdomNumbers: number[]): Promise<KingdomProfile[]> {
    const endpoint = `/api/compare?kingdoms=${kingdomNumbers.join(',')}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      // Handle the actual API response structure
      if (data.kingdoms && Array.isArray(data.kingdoms)) {
        return data.kingdoms.map((item: any) => this.enrichKingdom({
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
      console.warn(`API call failed for ${endpoint}, using fallback:`, error);
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
    // Use the main kingdoms endpoint with search parameter
    const endpoint = `/api/kingdoms?search=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      // Handle both paginated and legacy array responses
      return data.items || data;
    } catch (error) {
      console.warn(`API call failed for ${endpoint}, using local data:`, error);
      const filtered = realKingdoms.filter(k => 
        k.kingdom_number.toString().includes(query)
      );
      return filtered;
    }
  }
}

export const apiService = new ApiService();
