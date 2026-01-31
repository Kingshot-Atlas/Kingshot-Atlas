/**
 * Service for handling KvK record corrections
 * Fetches corrections from Supabase and applies them when loading KvK data
 * Falls back to localStorage for offline support
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface KvKCorrection {
  id: string | number;
  kingdom_number: number;
  kvk_number: number;
  opponent_kingdom: number;
  original_prep_result: string;
  original_battle_result: string;
  corrected_prep_result: string;
  corrected_battle_result: string;
  corrected_overall_result?: string;
  approved_at?: string;
  approved_by?: string;
}

const KVK_CORRECTIONS_KEY = 'kingshot_kvk_corrections_applied';
const KVK_CORRECTIONS_CACHE_KEY = 'kingshot_kvk_corrections_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class KvKCorrectionService {
  private correctionsCache: Map<string, KvKCorrection> | null = null;
  private lastFetchTime: number = 0;

  /**
   * Fetch corrections from Supabase and cache them
   */
  async fetchCorrectionsFromSupabase(): Promise<Map<string, KvKCorrection>> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getLocalCorrections();
    }

    try {
      const { data, error } = await supabase
        .from('kvk_corrections')
        .select('*');

      if (error) {
        console.warn('Failed to fetch corrections from Supabase:', error.message);
        return this.getLocalCorrections();
      }

      const result = new Map<string, KvKCorrection>();
      for (const c of data || []) {
        const key = `${c.kingdom_number}-${c.kvk_number}`;
        result.set(key, {
          id: c.id,
          kingdom_number: c.kingdom_number,
          kvk_number: c.kvk_number,
          opponent_kingdom: c.opponent_kingdom,
          original_prep_result: c.original_prep_result,
          original_battle_result: c.original_battle_result,
          corrected_prep_result: c.corrected_prep_result,
          corrected_battle_result: c.corrected_battle_result,
          corrected_overall_result: c.corrected_overall_result,
          approved_at: c.corrected_at,
          approved_by: c.corrected_by
        });
      }

      // Cache in memory and localStorage
      this.correctionsCache = result;
      this.lastFetchTime = Date.now();
      localStorage.setItem(KVK_CORRECTIONS_CACHE_KEY, JSON.stringify(Array.from(result.entries())));

      return result;
    } catch (err) {
      console.warn('Error fetching corrections:', err);
      return this.getLocalCorrections();
    }
  }

  /**
   * Get corrections from localStorage (fallback/offline)
   */
  private getLocalCorrections(): Map<string, KvKCorrection> {
    try {
      // Try cache first
      const cacheData = localStorage.getItem(KVK_CORRECTIONS_CACHE_KEY);
      if (cacheData) {
        return new Map(JSON.parse(cacheData));
      }
      // Fall back to old localStorage format
      const data = localStorage.getItem(KVK_CORRECTIONS_KEY);
      const corrections: KvKCorrection[] = data ? JSON.parse(data) : [];
      const result = new Map<string, KvKCorrection>();
      for (const c of corrections) {
        result.set(`${c.kingdom_number}-${c.kvk_number}`, c);
      }
      return result;
    } catch {
      return new Map();
    }
  }

  /**
   * Get all applied KvK corrections as a lookup map
   * Uses cache if available and fresh, otherwise fetches from Supabase
   */
  async getAllAppliedCorrectionsAsync(): Promise<Map<string, KvKCorrection>> {
    const now = Date.now();
    if (this.correctionsCache && (now - this.lastFetchTime) < CACHE_TTL_MS) {
      return this.correctionsCache;
    }
    return this.fetchCorrectionsFromSupabase();
  }

  /**
   * Synchronous version - returns cached data only (for backward compatibility)
   */
  getAllAppliedCorrections(): Map<string, KvKCorrection> {
    if (this.correctionsCache) {
      return this.correctionsCache;
    }
    return this.getLocalCorrections();
  }

  /**
   * Get correction for a specific KvK record
   */
  getCorrection(kingdomNumber: number, kvkNumber: number): KvKCorrection | null {
    const corrections = this.getAllAppliedCorrections();
    return corrections.get(`${kingdomNumber}-${kvkNumber}`) || null;
  }

  /**
   * Apply a KvK error correction (called when admin approves)
   * Writes to Supabase for persistence, falls back to localStorage
   */
  async applyCorrectionAsync(kvkError: {
    id: string;
    kingdom_number: number;
    kvk_number: number | null;
    current_data: {
      opponent: number;
      prep_result: string;
      battle_result: string;
    } | null;
    corrected_prep?: string;
    corrected_battle?: string;
  }, approvedBy: string): Promise<boolean> {
    if (!kvkError.kvk_number || !kvkError.current_data) {
      console.warn('Cannot apply correction: missing kvk_number or current_data');
      return false;
    }

    const correctedPrep = kvkError.corrected_prep || this.flipResult(kvkError.current_data.prep_result);
    const correctedBattle = kvkError.corrected_battle || this.flipResult(kvkError.current_data.battle_result);
    const overallResult = this.calculateOverallResult(correctedPrep, correctedBattle);

    // Try to write to Supabase first
    if (isSupabaseConfigured && supabase) {
      try {
        // Insert main correction
        const { error: mainError } = await supabase
          .from('kvk_corrections')
          .upsert({
            kingdom_number: kvkError.kingdom_number,
            kvk_number: kvkError.kvk_number,
            opponent_kingdom: kvkError.current_data.opponent,
            original_prep_result: kvkError.current_data.prep_result,
            original_battle_result: kvkError.current_data.battle_result,
            corrected_prep_result: correctedPrep,
            corrected_battle_result: correctedBattle,
            corrected_overall_result: overallResult,
            notes: `Correction approved from error report ${kvkError.id}`
          }, { onConflict: 'kingdom_number,kvk_number' });

        if (mainError) {
          console.error('Failed to save correction to Supabase:', mainError);
        } else {
          // Insert opponent inverse correction
          const oppPrep = this.flipResult(correctedPrep);
          const oppBattle = this.flipResult(correctedBattle);
          const oppOverall = this.calculateOverallResult(oppPrep, oppBattle);

          await supabase
            .from('kvk_corrections')
            .upsert({
              kingdom_number: kvkError.current_data.opponent,
              kvk_number: kvkError.kvk_number,
              opponent_kingdom: kvkError.kingdom_number,
              original_prep_result: this.flipResult(kvkError.current_data.prep_result),
              original_battle_result: this.flipResult(kvkError.current_data.battle_result),
              corrected_prep_result: oppPrep,
              corrected_battle_result: oppBattle,
              corrected_overall_result: oppOverall,
              notes: `Inverse correction for K${kvkError.kingdom_number}`
            }, { onConflict: 'kingdom_number,kvk_number' });

          // Invalidate cache to pick up new corrections
          this.correctionsCache = null;
          this.lastFetchTime = 0;
          
          return true;
        }
      } catch (err) {
        console.error('Supabase correction error:', err);
      }
    }

    // Fallback to localStorage
    return this.applyCorrection(kvkError, approvedBy);
  }

  /**
   * Calculate overall result from prep and battle results
   */
  private calculateOverallResult(prep: string, battle: string): string {
    if (prep === 'W' && battle === 'W') return 'Win';
    if (prep === 'L' && battle === 'L') return 'Loss';
    if (prep === 'W' && battle === 'L') return 'Preparation';
    if (prep === 'L' && battle === 'W') return 'Battle';
    return 'Unknown';
  }

  /**
   * Legacy sync method - writes to localStorage only
   */
  applyCorrection(kvkError: {
    id: string;
    kingdom_number: number;
    kvk_number: number | null;
    current_data: {
      opponent: number;
      prep_result: string;
      battle_result: string;
    } | null;
    corrected_prep?: string;
    corrected_battle?: string;
  }, approvedBy: string): boolean {
    if (!kvkError.kvk_number || !kvkError.current_data) {
      return false;
    }

    try {
      const data = localStorage.getItem(KVK_CORRECTIONS_KEY);
      const corrections: KvKCorrection[] = data ? JSON.parse(data) : [];

      const correction: KvKCorrection = {
        id: kvkError.id,
        kingdom_number: kvkError.kingdom_number,
        kvk_number: kvkError.kvk_number,
        opponent_kingdom: kvkError.current_data.opponent,
        original_prep_result: kvkError.current_data.prep_result,
        original_battle_result: kvkError.current_data.battle_result,
        corrected_prep_result: kvkError.corrected_prep || this.flipResult(kvkError.current_data.prep_result),
        corrected_battle_result: kvkError.corrected_battle || this.flipResult(kvkError.current_data.battle_result),
        approved_at: new Date().toISOString(),
        approved_by: approvedBy
      };

      const existingIndex = corrections.findIndex(
        c => c.kingdom_number === kvkError.kingdom_number && c.kvk_number === kvkError.kvk_number
      );

      if (existingIndex >= 0) {
        corrections[existingIndex] = correction;
      } else {
        corrections.push(correction);
      }

      localStorage.setItem(KVK_CORRECTIONS_KEY, JSON.stringify(corrections));
      this.applyOpponentCorrection(correction);
      
      return true;
    } catch (error) {
      console.error('Failed to apply KvK correction:', error);
      return false;
    }
  }

  /**
   * Apply the inverse correction for the opponent kingdom (localStorage only)
   */
  private applyOpponentCorrection(correction: KvKCorrection): void {
    try {
      const data = localStorage.getItem(KVK_CORRECTIONS_KEY);
      const corrections: KvKCorrection[] = data ? JSON.parse(data) : [];

      const opponentCorrection: KvKCorrection = {
        id: `${correction.id}_opponent`,
        kingdom_number: correction.opponent_kingdom,
        kvk_number: correction.kvk_number,
        opponent_kingdom: correction.kingdom_number,
        original_prep_result: this.flipResult(correction.original_prep_result),
        original_battle_result: this.flipResult(correction.original_battle_result),
        corrected_prep_result: this.flipResult(correction.corrected_prep_result),
        corrected_battle_result: this.flipResult(correction.corrected_battle_result),
        approved_at: correction.approved_at,
        approved_by: correction.approved_by
      };

      const existingIndex = corrections.findIndex(
        c => c.kingdom_number === correction.opponent_kingdom && c.kvk_number === correction.kvk_number
      );

      if (existingIndex >= 0) {
        corrections[existingIndex] = opponentCorrection;
      } else {
        corrections.push(opponentCorrection);
      }

      localStorage.setItem(KVK_CORRECTIONS_KEY, JSON.stringify(corrections));
    } catch (error) {
      console.error('Failed to apply opponent correction:', error);
    }
  }

  /**
   * Flip W to L or L to W
   */
  private flipResult(result: string): string {
    if (result === 'W' || result === 'Win') return 'L';
    if (result === 'L' || result === 'Loss') return 'W';
    return result;
  }

  /**
   * Remove a correction (if admin reverts approval)
   */
  removeCorrection(kingdomNumber: number, kvkNumber: number): void {
    try {
      const data = localStorage.getItem(KVK_CORRECTIONS_KEY);
      const corrections: KvKCorrection[] = data ? JSON.parse(data) : [];
      
      // Remove both the correction and its opponent inverse
      const filtered = corrections.filter(
        c => !(c.kingdom_number === kingdomNumber && c.kvk_number === kvkNumber) &&
             !(c.opponent_kingdom === kingdomNumber && c.kvk_number === kvkNumber)
      );
      
      localStorage.setItem(KVK_CORRECTIONS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove KvK correction:', error);
    }
  }

  /**
   * Get count of applied corrections
   */
  getCorrectionCount(): number {
    try {
      const data = localStorage.getItem(KVK_CORRECTIONS_KEY);
      const corrections: KvKCorrection[] = data ? JSON.parse(data) : [];
      return corrections.length;
    } catch {
      return 0;
    }
  }

  /**
   * Clear all corrections (for testing/reset)
   */
  clearAll(): void {
    localStorage.removeItem(KVK_CORRECTIONS_KEY);
  }
}

export const kvkCorrectionService = new KvKCorrectionService();
