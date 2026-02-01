import { Kingdom, KingdomProfile, KVKRecord, FilterOptions, SortOptions, getPowerTier, PaginatedResponse, RawKingdomData, KingdomDataFile } from '../types';
import { logger } from '../utils/logger';
import { statusService } from './statusService';
import { correctionService } from './correctionService';
import { kvkCorrectionService } from './kvkCorrectionService';
import { kvkHistoryService, KvKHistoryRecord } from './kvkHistoryService';
import { kingdomsSupabaseService } from './kingdomsSupabaseService';
import kingdomData from '../data/kingdoms.json';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CACHE_KEY = 'kingshot_kingdom_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_RETRIES = 2;

// Cache for Supabase KvK data
let supabaseKvkData: Map<number, KvKHistoryRecord[]> | null = null;

// Preload data from Supabase on module load
// These flags are used to check data source status
export let supabaseDataLoaded = false;
export let supabaseKingdomsLoaded = false;

// Promise that resolves when initial data load is complete
let preloadPromise: Promise<void> | null = null;

const preloadSupabaseData = async () => {
  try {
    // Fetch corrections first
    await kvkCorrectionService.fetchCorrectionsFromSupabase();
    
    // PRIORITY 1: Load kingdoms from Supabase kingdoms table (SINGLE SOURCE OF TRUTH)
    const supabaseKingdoms = await kingdomsSupabaseService.getAllKingdoms();
    if (supabaseKingdoms.length > 0) {
      realKingdoms = supabaseKingdoms;
      supabaseKingdomsLoaded = true;
      logger.info(`Loaded ${supabaseKingdoms.length} kingdoms from Supabase kingdoms table (SOURCE OF TRUTH)`);
    } else {
      // FALLBACK: Load from local JSON if Supabase is empty/unavailable
      logger.warn('Supabase kingdoms table empty, falling back to local JSON');
      supabaseKvkData = await kvkHistoryService.getAllRecords();
      if (supabaseKvkData.size > 0) {
        logger.info(`Loaded ${supabaseKvkData.size} kingdoms from Supabase kvk_history`);
        realKingdoms = loadKingdomData();
        supabaseDataLoaded = true;
        logger.info('Rebuilt kingdom data with Supabase KvK records');
      }
    }
  } catch (err) {
    // Silent fail - will use local JSON fallback
    logger.warn('Supabase preload failed, using local data');
  }
};

// Start preloading immediately and store the promise
preloadPromise = preloadSupabaseData();

interface CacheData {
  kingdoms: Kingdom[];
  timestamp: number;
}

// Helper to calculate overall result from prep and battle outcomes
const calculateOverallResult = (prepResult: string, battleResult: string): string => {
  const prepWin = prepResult === 'Win';
  const battleWin = battleResult === 'Win';
  
  if (prepWin && battleWin) return 'Win';        // Domination
  if (!prepWin && battleWin) return 'Battle';    // Comeback
  if (prepWin && !battleWin) return 'Preparation'; // Reversal
  return 'Loss';                                  // Invasion
};

// Load real kingdom data from JSON with Supabase KvK overlay
const loadKingdomData = (): Kingdom[] => {
  const kvksByKingdom: Record<number, KVKRecord[]> = {};
  
  // Get approved KvK corrections for applying to records
  const kvkCorrections = kvkCorrectionService.getAllAppliedCorrections();
  
  // PRIORITY 1: Use Supabase data as PRIMARY source (most up-to-date)
  // This ensures new submissions are immediately reflected
  if (supabaseKvkData && supabaseKvkData.size > 0) {
    logger.info(`Loading KvK data from Supabase (${supabaseKvkData.size} kingdoms)`);
    for (const [kNum, records] of supabaseKvkData) {
      if (!kvksByKingdom[kNum]) kvksByKingdom[kNum] = [];
      
      for (const r of records) {
        // Check for corrections
        const correctionKey = `${kNum}-${r.kvk_number}`;
        const correction = kvkCorrections.get(correctionKey);
        
        const prepResult = correction 
          ? (correction.corrected_prep_result === 'W' ? 'Win' : 'Loss')
          : (r.prep_result === 'W' ? 'Win' : 'Loss');
        const battleResult = correction
          ? (correction.corrected_battle_result === 'W' ? 'Win' : 'Loss')
          : (r.battle_result === 'W' ? 'Win' : 'Loss');
        const overallResult = correction
          ? calculateOverallResult(prepResult, battleResult)
          : r.overall_result;
        
        kvksByKingdom[kNum]!.push({
          id: kNum * 100 + r.kvk_number,
          kingdom_number: kNum,
          kvk_number: r.kvk_number,
          opponent_kingdom: r.opponent_kingdom || 0,
          prep_result: prepResult,
          battle_result: battleResult,
          overall_result: overallResult,
          date_or_order_index: r.kvk_date || String(r.order_index),
          created_at: r.kvk_date || String(r.order_index)
        });
      }
    }
  }
  
  // PRIORITY 2: Fill gaps with local JSON data (for kingdoms not in Supabase)
  // This is fallback only - Supabase is source of truth
  for (const kvk of kingdomData.kvk_records) {
    const kNum = kvk.kingdom_number;
    
    // Skip if this kingdom already has Supabase data
    if (kvksByKingdom[kNum] && kvksByKingdom[kNum].length > 0) {
      continue;
    }
    
    if (!kvksByKingdom[kNum]) kvksByKingdom[kNum] = [];
    
    // Check if there's a correction for this KvK record
    const correctionKey = `${kNum}-${kvk.kvk_number}`;
    const correction = kvkCorrections.get(correctionKey);
    
    const prepResult = correction 
      ? (correction.corrected_prep_result === 'W' ? 'Win' : 'Loss')
      : (kvk.prep_result === 'W' ? 'Win' : 'Loss');
    const battleResult = correction
      ? (correction.corrected_battle_result === 'W' ? 'Win' : 'Loss')
      : (kvk.battle_result === 'W' ? 'Win' : 'Loss');
    const overallResult = correction
      ? calculateOverallResult(prepResult, battleResult)
      : kvk.overall_result;
    
    kvksByKingdom[kNum]!.push({
      id: kNum * 100 + kvk.kvk_number,
      kingdom_number: kNum,
      kvk_number: kvk.kvk_number,
      opponent_kingdom: kvk.opponent_kingdom || 0,
      prep_result: prepResult,
      battle_result: battleResult,
      overall_result: overallResult,
      date_or_order_index: kvk.date_or_order_index,
      created_at: kvk.date_or_order_index
    });
  }
  
  
  // Sort each kingdom's KvKs by kvk_number descending (most recent first)
  for (const kNum in kvksByKingdom) {
    kvksByKingdom[kNum]?.sort((a, b) => b.kvk_number - a.kvk_number);
  }
  
  // Get approved status overrides from statusService
  const statusOverrides = statusService.getAllApprovedStatusOverrides();
  
  // Get approved data corrections
  const dataCorrections = correctionService.getAllApprovedCorrections();
  
  // Build kingdom objects
  const kingdoms = (kingdomData as KingdomDataFile).kingdoms.map((k: RawKingdomData) => {
    const recentKvks = kvksByKingdom[k.kingdom_number] || [];
    // Use approved status override if available, otherwise default to 'Unannounced'
    const approvedStatus = statusOverrides.get(k.kingdom_number);
    
    // Get any approved corrections for this kingdom
    const corrections = dataCorrections.get(k.kingdom_number);
    
    // ALWAYS calculate stats from actual KvK records (merged local + Supabase data)
    // recentKvks is the source of truth - it contains both local JSON and Supabase submissions
    let totalKvks: number;
    let prepWins: number;
    let prepLosses: number;
    let battleWins: number;
    let battleLosses: number;
    let dominations: number;
    let defeats: number;
    
    if (recentKvks.length > 0) {
      // Calculate from actual KvK records (source of truth)
      totalKvks = recentKvks.length;
      prepWins = recentKvks.filter(r => r.prep_result === 'Win').length;
      prepLosses = recentKvks.filter(r => r.prep_result === 'Loss').length;
      battleWins = recentKvks.filter(r => r.battle_result === 'Win').length;
      battleLosses = recentKvks.filter(r => r.battle_result === 'Loss').length;
      // Domination = won both prep AND battle
      dominations = recentKvks.filter(r => r.prep_result === 'Win' && r.battle_result === 'Win').length;
      // Defeat/Invasion = lost both prep AND battle
      defeats = recentKvks.filter(r => r.prep_result === 'Loss' && r.battle_result === 'Loss').length;
    } else {
      // Fallback to JSON values if no KvK records
      totalKvks = k.total_kvks;
      prepWins = k.prep_wins;
      prepLosses = k.prep_losses;
      battleWins = k.battle_wins;
      battleLosses = k.battle_losses;
      dominations = k.dominations ?? 0;
      defeats = k.defeats ?? 0;
    }
    
    // Calculate win rates
    const prepWinRate = totalKvks > 0 ? prepWins / totalKvks : 0;
    const battleWinRate = totalKvks > 0 ? battleWins / totalKvks : 0;
    
    // Calculate streaks from KvK records (sorted by kvk_number descending)
    let prepStreak = 0;
    let battleStreak = 0;
    if (recentKvks.length > 0) {
      // Prep streak - count consecutive wins from most recent
      for (const kvk of recentKvks) {
        if (kvk.prep_result === 'Win') prepStreak++;
        else break;
      }
      // If no wins at start, count losses as negative streak
      if (prepStreak === 0) {
        for (const kvk of recentKvks) {
          if (kvk.prep_result === 'Loss') prepStreak--;
          else break;
        }
      }
      // Battle streak
      for (const kvk of recentKvks) {
        if (kvk.battle_result === 'Win') battleStreak++;
        else break;
      }
      if (battleStreak === 0) {
        for (const kvk of recentKvks) {
          if (kvk.battle_result === 'Loss') battleStreak--;
          else break;
        }
      }
    }
    
    // Atlas Score: Use pre-calculated Bayesian score from JSON (single source of truth)
    // DO NOT recalculate here - the JSON scores use the comprehensive Bayesian formula
    // from regenerate_kingdoms_with_atlas_score.py (Wilson Score, priors, experience scaling, etc.)
    const overallScore = k.overall_score;
    
    // Apply corrections to base values (override calculated values if correction exists)
    const getValue = (field: string, calculatedValue: number | string) => {
      if (corrections?.has(field)) {
        const corrected = corrections.get(field)!;
        if (typeof calculatedValue === 'number') {
          const parsed = parseFloat(corrected);
          return isNaN(parsed) ? calculatedValue : parsed;
        }
        return corrected;
      }
      return calculatedValue;
    };
    
    return {
      kingdom_number: k.kingdom_number,
      total_kvks: getValue('total_kvks', totalKvks) as number,
      prep_wins: getValue('prep_wins', prepWins) as number,
      prep_losses: getValue('prep_losses', prepLosses) as number,
      prep_win_rate: getValue('prep_win_rate', prepWinRate) as number,
      prep_streak: getValue('prep_streak', recentKvks.length > 0 ? prepStreak : k.prep_streak) as number,
      battle_wins: getValue('battle_wins', battleWins) as number,
      battle_losses: getValue('battle_losses', battleLosses) as number,
      battle_win_rate: getValue('battle_win_rate', battleWinRate) as number,
      battle_streak: getValue('battle_streak', recentKvks.length > 0 ? battleStreak : k.battle_streak) as number,
      dominations: getValue('dominations', dominations) as number,
      defeats: getValue('defeats', defeats) as number,
      most_recent_status: approvedStatus || 'Unannounced',
      overall_score: getValue('overall_score', overallScore) as number,
      power_tier: getPowerTier(getValue('overall_score', overallScore) as number),
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

// Function to reload kingdom data (called when status overrides change)
const reloadKingdomData = (): Kingdom[] => {
  return loadKingdomData();
};

let realKingdoms: Kingdom[] = loadKingdomData();

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

  /**
   * Reload kingdom data to pick up approved status changes
   * Call this after approving/rejecting a status submission
   */
  reloadData(): void {
    realKingdoms = reloadKingdomData();
    this.clearCache();
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
      
      // Reload from Supabase kingdoms table (source of truth)
      const supabaseKingdoms = await kingdomsSupabaseService.getAllKingdoms();
      if (supabaseKingdoms.length > 0) {
        realKingdoms = supabaseKingdoms;
        logger.info(`Reloaded ${supabaseKingdoms.length} kingdoms from Supabase`);
      } else {
        // Fallback to kvk_history rebuild
        supabaseKvkData = await kvkHistoryService.getAllRecords();
        realKingdoms = reloadKingdomData();
      }
      this.clearCache();
    } catch (err) {
      logger.warn('Failed to reload Supabase data:', err);
    }
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
      logger.warn('Failed to load cache:', e);
    }
    return null;
  }

  private saveCache(kingdoms: Kingdom[]): void {
    try {
      const data: CacheData = { kingdoms, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      this.cache = data;
    } catch (e) {
      logger.warn('Failed to save cache:', e);
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
