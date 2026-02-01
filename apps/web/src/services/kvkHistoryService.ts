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

const CACHE_TTL_MS = 30 * 1000; // 30 seconds - very short for immediate data freshness
const INDEXEDDB_CACHE_KEY = 'kvk_history_cache';
let cachedData: CachedKvKData | null = null;

class KvKHistoryService {
  private corrections: Map<string, KvKCorrection> | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize IndexedDB for persistent caching
   */
  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('KingshotAtlasKvK', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Save cache to IndexedDB for offline support
   */
  private async saveToIndexedDB(data: CachedKvKData): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      
      // Convert Map to array for storage
      const serialized = {
        key: INDEXEDDB_CACHE_KEY,
        records: Array.from(data.records.entries()),
        timestamp: data.timestamp,
        source: data.source
      };
      
      store.put(serialized);
    } catch (err) {
      console.warn('Failed to save to IndexedDB:', err);
    }
  }

  /**
   * Load cache from IndexedDB
   */
  private async loadFromIndexedDB(): Promise<CachedKvKData | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cache', 'readonly');
        const store = tx.objectStore('cache');
        const request = store.get(INDEXEDDB_CACHE_KEY);
        
        request.onsuccess = () => {
          const data = request.result;
          if (data && Date.now() - data.timestamp < CACHE_TTL_MS * 2) { // 1 minute for IndexedDB
            resolve({
              records: new Map(data.records),
              timestamp: data.timestamp,
              source: data.source
            });
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

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
    // Check memory cache first
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
      return cachedData.records;
    }

    // Try IndexedDB cache (for offline support)
    const indexedDBCache = await this.loadFromIndexedDB();
    if (indexedDBCache) {
      cachedData = indexedDBCache;
      return indexedDBCache.records;
    }

    // Load corrections first
    this.corrections = await kvkCorrectionService.getAllAppliedCorrectionsAsync();

    // Try Supabase first
    if (isSupabaseConfigured && supabase) {
      try {
        // Fetch all records with pagination (Supabase default limit is 1000)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allData: any[] = [];
        let offset = 0;
        const batchSize = 1000;
        
        while (true) {
          const { data: batch, error: batchError } = await supabase
            .from('kvk_history')
            .select('*')
            .order('kingdom_number')
            .order('kvk_number', { ascending: false })
            .range(offset, offset + batchSize - 1);
          
          if (batchError) {
            console.warn('Supabase KvK batch fetch failed:', batchError);
            break;
          }
          
          if (!batch || batch.length === 0) break;
          
          allData.push(...batch);
          
          if (batch.length < batchSize) break; // Last batch
          offset += batchSize;
        }
        
        const data = allData;

        if (data && data.length > 0) {
          // Supabase has data - use it as source of truth
          const records = this.processRecords(data);
          cachedData = { records, timestamp: Date.now(), source: 'supabase' };
          
          // Save to IndexedDB for offline support
          await this.saveToIndexedDB(cachedData);
          
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
   * Get paginated KvK records for a kingdom
   */
  async getKingdomHistoryPaginated(
    kingdomNumber: number,
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ records: KvKHistoryRecord[]; total: number; hasMore: boolean }> {
    const allRecords = await this.getKingdomHistory(kingdomNumber);
    const total = allRecords.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const records = allRecords.slice(start, end);
    
    return {
      records,
      total,
      hasMore: end < total
    };
  }

  /**
   * Get paginated kingdoms with their KvK stats
   */
  async getKingdomsPaginated(
    page: number = 1,
    pageSize: number = 50,
    sortBy: 'kingdom_number' | 'win_rate' = 'kingdom_number'
  ): Promise<{ kingdoms: number[]; total: number; hasMore: boolean }> {
    const allRecords = await this.getAllRecords();
    const kingdomNumbers = Array.from(allRecords.keys());
    
    // Sort kingdoms
    if (sortBy === 'win_rate') {
      kingdomNumbers.sort((a, b) => {
        const aRecords = allRecords.get(a) || [];
        const bRecords = allRecords.get(b) || [];
        const aWins = aRecords.filter(r => r.overall_result === 'Win').length;
        const bWins = bRecords.filter(r => r.overall_result === 'Win').length;
        const aRate = aRecords.length > 0 ? aWins / aRecords.length : 0;
        const bRate = bRecords.length > 0 ? bWins / bRecords.length : 0;
        return bRate - aRate;
      });
    } else {
      kingdomNumbers.sort((a, b) => a - b);
    }
    
    const total = kingdomNumbers.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const kingdoms = kingdomNumbers.slice(start, end);
    
    return {
      kingdoms,
      total,
      hasMore: end < total
    };
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
   * Invalidate cache (call after corrections are applied or new data is added)
   */
  invalidateCache(): void {
    cachedData = null;
    this.corrections = null;
    // Also clear IndexedDB cache to force fresh fetch
    this.clearIndexedDBCache();
  }

  /**
   * Clear IndexedDB cache
   */
  private async clearIndexedDBCache(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      store.delete(INDEXEDDB_CACHE_KEY);
    } catch (err) {
      console.warn('Failed to clear IndexedDB cache:', err);
    }
  }
}

export const kvkHistoryService = new KvKHistoryService();
