/**
 * KvK History Service
 * Provides KvK data from Supabase (primary) with CSV fallback
 * Applies corrections from kvk_corrections table
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { kvkCorrectionService, KvKCorrection } from './kvkCorrectionService';

export interface KvKHistoryRecord {
  kingdom_number: number;
  kvk_number: number;
  opponent_kingdom: number;
  prep_result: 'W' | 'L';
  battle_result: 'W' | 'L';
  overall_result: string;
  kvk_date: string | null;
  order_index: number;
}

interface CachedKvKData {
  records: Map<number, KvKHistoryRecord[]>;
  timestamp: number;
  source: 'supabase' | 'csv';
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedData: CachedKvKData | null = null;

class KvKHistoryService {
  private corrections: Map<string, KvKCorrection> | null = null;

  /**
   * Get KvK history for a specific kingdom
   */
  async getKingdomHistory(kingdomNumber: number): Promise<KvKHistoryRecord[]> {
    const allRecords = await this.getAllRecords();
    return allRecords.get(kingdomNumber) || [];
  }

  /**
   * Get all KvK records grouped by kingdom
   */
  async getAllRecords(): Promise<Map<number, KvKHistoryRecord[]>> {
    // Check cache
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
      return cachedData.records;
    }

    // Load corrections first
    this.corrections = await kvkCorrectionService.getAllAppliedCorrectionsAsync();

    // Try Supabase first
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('kvk_history')
          .select('*')
          .order('kingdom_number')
          .order('kvk_number', { ascending: false });

        if (!error && data && data.length > 100) {
          // Supabase has sufficient data
          const records = this.processRecords(data);
          cachedData = { records, timestamp: Date.now(), source: 'supabase' };
          return records;
        }
      } catch (err) {
        console.warn('Supabase KvK fetch failed, using CSV fallback:', err);
      }
    }

    // Fallback: return empty (CSV data is loaded separately in api.ts)
    // This service is for Supabase data; CSV fallback happens in loadKingdomData
    return new Map();
  }

  /**
   * Process raw records and apply corrections
   */
  private processRecords(data: any[]): Map<number, KvKHistoryRecord[]> {
    const result = new Map<number, KvKHistoryRecord[]>();

    for (const row of data) {
      const kingdomNumber = row.kingdom_number;
      if (!result.has(kingdomNumber)) {
        result.set(kingdomNumber, []);
      }

      // Check for corrections
      const correctionKey = `${kingdomNumber}-${row.kvk_number}`;
      const correction = this.corrections?.get(correctionKey);

      const record: KvKHistoryRecord = {
        kingdom_number: kingdomNumber,
        kvk_number: row.kvk_number,
        opponent_kingdom: row.opponent_kingdom,
        prep_result: correction ? correction.corrected_prep_result as 'W' | 'L' : row.prep_result,
        battle_result: correction ? correction.corrected_battle_result as 'W' | 'L' : row.battle_result,
        overall_result: correction 
          ? this.calculateOverallResult(correction.corrected_prep_result, correction.corrected_battle_result)
          : row.overall_result,
        kvk_date: row.kvk_date,
        order_index: row.order_index,
      };

      result.get(kingdomNumber)!.push(record);
    }

    // Sort each kingdom's records by kvk_number descending
    for (const [, records] of result) {
      records.sort((a, b) => b.kvk_number - a.kvk_number);
    }

    return result;
  }

  /**
   * Calculate overall result from prep and battle outcomes
   */
  private calculateOverallResult(prep: string, battle: string): string {
    if (prep === 'W' && battle === 'W') return 'Win';
    if (prep === 'L' && battle === 'L') return 'Loss';
    if (prep === 'W' && battle === 'L') return 'Preparation';
    if (prep === 'L' && battle === 'W') return 'Battle';
    return 'Unknown';
  }

  /**
   * Check if Supabase has KvK data
   */
  async hasSupabaseData(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    
    try {
      const { count, error } = await supabase
        .from('kvk_history')
        .select('*', { count: 'exact', head: true });
      
      return !error && (count || 0) > 100;
    } catch {
      return false;
    }
  }

  /**
   * Get data source info
   */
  getDataSource(): { source: 'supabase' | 'csv' | 'unknown'; recordCount: number } {
    if (!cachedData) {
      return { source: 'unknown', recordCount: 0 };
    }
    
    let count = 0;
    for (const records of cachedData.records.values()) {
      count += records.length;
    }
    
    return { source: cachedData.source, recordCount: count };
  }

  /**
   * Invalidate cache (call after corrections are applied)
   */
  invalidateCache(): void {
    cachedData = null;
    this.corrections = null;
  }
}

export const kvkHistoryService = new KvKHistoryService();
