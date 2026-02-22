/**
 * Kingdoms Supabase Service
 * Fetches kingdom aggregate stats directly from Supabase kingdoms table
 * This is the SINGLE SOURCE OF TRUTH for Atlas Scores and kingdom stats
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Kingdom, getPowerTier, KVKRecord } from '../types';
import { logger } from '../utils/logger';
import { kvkHistoryService, KvKHistoryRecord } from './kvkHistoryService';
import { statusService } from './statusService';

export interface SupabaseKingdom {
  kingdom_number: number;
  total_kvks: number;
  prep_wins: number;
  prep_losses: number;
  prep_win_rate: number;
  prep_streak: number;
  prep_loss_streak: number;
  prep_best_streak: number;
  battle_wins: number;
  battle_losses: number;
  battle_win_rate: number;
  battle_streak: number;
  battle_loss_streak: number;
  battle_best_streak: number;
  dominations: number;
  reversals: number;
  comebacks: number;
  invasions: number;
  atlas_score: number;
  overall_score?: number; // deprecated, use atlas_score
  most_recent_status: string;
  last_updated: string;
}

interface CachedKingdomsData {
  kingdoms: Kingdom[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 1000; // 5 seconds - very short to ensure corrections are reflected
let cachedKingdoms: CachedKingdomsData | null = null;
let isLoading = false;
let loadPromise: Promise<Kingdom[]> | null = null;

class KingdomsSupabaseService {
  /**
   * Get all kingdoms from Supabase (source of truth)
   */
  async getAllKingdoms(): Promise<Kingdom[]> {
    // Return cached data if fresh
    if (cachedKingdoms && Date.now() - cachedKingdoms.timestamp < CACHE_TTL_MS) {
      return cachedKingdoms.kingdoms;
    }

    // Prevent duplicate requests
    if (isLoading && loadPromise) {
      return loadPromise;
    }

    isLoading = true;
    loadPromise = this.fetchKingdoms();
    
    try {
      const kingdoms = await loadPromise;
      return kingdoms;
    } finally {
      isLoading = false;
      loadPromise = null;
    }
  }

  private async fetchKingdoms(): Promise<Kingdom[]> {
    if (!isSupabaseConfigured || !supabase) {
      logger.warn('Supabase not configured, cannot fetch kingdoms');
      return [];
    }

    try {
      // Fetch kingdom aggregate stats from Supabase
      // Note: Supabase has a default limit of 1000, so we need to fetch in batches
      const allKingdomsData: SupabaseKingdom[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      let hasMore = true;
      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from('kingdoms')
          .select('*')
          .order('kingdom_number')
          .range(offset, offset + batchSize - 1);
        
        if (batchError) {
          logger.error('Failed to fetch kingdoms batch from Supabase:', batchError);
          hasMore = false;
          continue;
        }
        
        if (!batch || batch.length === 0) {
          hasMore = false;
          continue;
        }
        
        allKingdomsData.push(...batch);
        
        if (batch.length < batchSize) {
          hasMore = false; // Last batch
        }
        offset += batchSize;
      }
      
      const kingdomsData = allKingdomsData;
      const error = null;

      if (error) {
        logger.error('Failed to fetch kingdoms from Supabase:', error);
        return cachedKingdoms?.kingdoms || [];
      }

      if (!kingdomsData || kingdomsData.length === 0) {
        logger.warn('No kingdoms found in Supabase');
        return cachedKingdoms?.kingdoms || [];
      }

      // Fetch KvK history for recent_kvks
      const kvkData = await kvkHistoryService.getAllRecords();
      
      // Get status overrides from Supabase (source of truth)
      const statusOverrides = await statusService.getAllApprovedStatusOverridesAsync();

      // Transform to Kingdom objects
      const kingdoms: Kingdom[] = kingdomsData.map((k: SupabaseKingdom) => {
        const kvkRecords = kvkData.get(k.kingdom_number) || [];
        const recentKvks: KVKRecord[] = kvkRecords.map((r: KvKHistoryRecord) => ({
          id: k.kingdom_number * 100 + r.kvk_number,
          kingdom_number: k.kingdom_number,
          kvk_number: r.kvk_number,
          opponent_kingdom: r.opponent_kingdom || 0,
          prep_result: r.prep_result === null ? null : (r.prep_result === 'W' ? 'Win' : 'Loss'),
          battle_result: r.battle_result === null ? null : (r.battle_result === 'W' ? 'Win' : 'Loss'),
          overall_result: r.overall_result,
          date_or_order_index: r.kvk_date || String(r.order_index),
          created_at: r.kvk_date || String(r.order_index)
        }));

        // Sort by kvk_number descending (most recent first)
        recentKvks.sort((a, b) => b.kvk_number - a.kvk_number);

        // Use status override if available
        const approvedStatus = statusOverrides.get(k.kingdom_number);

        return {
          kingdom_number: k.kingdom_number,
          total_kvks: k.total_kvks,
          prep_wins: k.prep_wins,
          prep_losses: k.prep_losses,
          prep_win_rate: Number(k.prep_win_rate),
          prep_streak: k.prep_streak,
          prep_loss_streak: k.prep_loss_streak,
          prep_best_streak: k.prep_best_streak,
          battle_wins: k.battle_wins,
          battle_losses: k.battle_losses,
          battle_win_rate: Number(k.battle_win_rate),
          battle_streak: k.battle_streak,
          battle_loss_streak: k.battle_loss_streak,
          battle_best_streak: k.battle_best_streak,
          dominations: k.dominations,
          reversals: k.reversals ?? 0,
          comebacks: k.comebacks ?? 0,
          invasions: k.invasions ?? 0,
          overall_score: Number(k.atlas_score ?? k.overall_score ?? 0),
          most_recent_status: approvedStatus || k.most_recent_status || 'Unannounced',
          power_tier: getPowerTier(Number(k.atlas_score ?? k.overall_score ?? 0)),
          last_updated: k.last_updated,
          recent_kvks: recentKvks
        } as Kingdom;
      });

      // Calculate ranks based on overall_score
      const sorted = [...kingdoms].sort((a, b) => b.overall_score - a.overall_score);
      sorted.forEach((k, index) => {
        k.rank = index + 1;
      });

      // Update cache
      cachedKingdoms = {
        kingdoms,
        timestamp: Date.now()
      };

      logger.info(`Loaded ${kingdoms.length} kingdoms from Supabase`);
      return kingdoms;
    } catch (err) {
      logger.error('Error fetching kingdoms from Supabase:', err);
      return cachedKingdoms?.kingdoms || [];
    }
  }

  /**
   * Get a single kingdom by number
   */
  async getKingdom(kingdomNumber: number): Promise<Kingdom | null> {
    const kingdoms = await this.getAllKingdoms();
    return kingdoms.find(k => k.kingdom_number === kingdomNumber) || null;
  }

  /**
   * Invalidate cache to force fresh fetch
   */
  invalidateCache(): void {
    cachedKingdoms = null;
    logger.info('Kingdoms cache invalidated');
  }

  /**
   * Check if Supabase has kingdom data
   */
  async hasData(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const { count, error } = await supabase
        .from('kingdoms')
        .select('*', { count: 'exact', head: true });

      return !error && (count || 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get data source status for debugging/display
   */
  getDataSourceStatus(): { source: 'supabase' | 'local' | 'loading'; lastUpdated: Date | null; kingdomCount: number } {
    if (!cachedKingdoms) {
      return { source: 'loading', lastUpdated: null, kingdomCount: 0 };
    }
    return {
      source: 'supabase',
      lastUpdated: new Date(cachedKingdoms.timestamp),
      kingdomCount: cachedKingdoms.kingdoms.length
    };
  }
}

export const kingdomsSupabaseService = new KingdomsSupabaseService();
