/**
 * Service for handling KvK record corrections
 * Fetches corrections from Supabase and applies them when loading KvK data
 * Falls back to localStorage for offline support
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { calculateOutcome, flipResult as flipResultUtil } from '../utils/outcomeUtils';
import { logger } from '../utils/logger';

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
  status?: 'pending' | 'approved' | 'rejected';
  submitted_by?: string;
  submitted_by_name?: string;
  submitted_at?: string;
  approved_at?: string;
  approved_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

const KVK_CORRECTIONS_KEY = 'kingshot_kvk_corrections_applied';
const KVK_CORRECTIONS_CACHE_KEY = 'kingshot_kvk_corrections_cache';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds - short to ensure corrections are picked up quickly

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
      // CRITICAL: Only fetch APPROVED corrections - pending/rejected should NOT be applied
      const { data, error } = await supabase
        .from('kvk_corrections')
        .select('*')
        .eq('status', 'approved');

      if (error) {
        logger.warn('Failed to fetch corrections from Supabase:', error.message);
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
      logger.warn('Error fetching corrections:', err);
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
   * Invalidate corrections cache (call when realtime updates arrive)
   */
  invalidateCache(): void {
    this.correctionsCache = null;
    this.lastFetchTime = 0;
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
   * Updates kvk_history table directly (source of truth) AND stores correction record
   */
  async applyCorrectionAsync(kvkError: {
    id: string;
    kingdom_number: number;
    kvk_number: number | null;
    error_type?: string;
    current_data: {
      opponent: number;
      prep_result: string;
      battle_result: string;
    } | null;
    corrected_prep?: string;
    corrected_battle?: string;
  }, approvedBy: string): Promise<boolean> {
    if (!kvkError.kvk_number || !kvkError.current_data) {
      logger.warn('Cannot apply correction: missing kvk_number or current_data');
      return false;
    }

    // Determine which fields to flip based on error_type
    // Only flip the field that was reported as incorrect
    let correctedPrep: string;
    let correctedBattle: string;
    
    if (kvkError.corrected_prep) {
      correctedPrep = kvkError.corrected_prep;
    } else if (kvkError.error_type === 'wrong_prep_result' || kvkError.error_type === 'wrong_both_results') {
      correctedPrep = this.flipResult(kvkError.current_data.prep_result);
    } else {
      correctedPrep = kvkError.current_data.prep_result; // Keep unchanged
    }
    
    if (kvkError.corrected_battle) {
      correctedBattle = kvkError.corrected_battle;
    } else if (kvkError.error_type === 'wrong_battle_result' || kvkError.error_type === 'wrong_both_results') {
      correctedBattle = this.flipResult(kvkError.current_data.battle_result);
    } else {
      correctedBattle = kvkError.current_data.battle_result; // Keep unchanged
    }
    
    logger.log(`Applying correction for K${kvkError.kingdom_number} KvK#${kvkError.kvk_number}: error_type=${kvkError.error_type}, prep ${kvkError.current_data.prep_result}→${correctedPrep}, battle ${kvkError.current_data.battle_result}→${correctedBattle}`);
    const overallResult = this.calculateOverallResult(correctedPrep, correctedBattle);

    // Try to write to Supabase first
    if (isSupabaseConfigured && supabase) {
      try {
        // CRITICAL: Update kvk_history table directly (source of truth)
        // This ensures the correction is immediately visible everywhere
        const { error: historyError } = await supabase
          .from('kvk_history')
          .update({
            prep_result: correctedPrep,
            battle_result: correctedBattle,
            overall_result: overallResult
          })
          .eq('kingdom_number', kvkError.kingdom_number)
          .eq('kvk_number', kvkError.kvk_number);

        if (historyError) {
          logger.error('Failed to update kvk_history:', historyError);
        } else {
          logger.log(`✅ Updated kvk_history for K${kvkError.kingdom_number} KvK#${kvkError.kvk_number}`);
        }

        // Also update opponent's record (inverse results)
        const oppPrep = this.flipResult(correctedPrep);
        const oppBattle = this.flipResult(correctedBattle);
        const oppOverall = this.calculateOverallResult(oppPrep, oppBattle);

        const { error: oppHistoryError } = await supabase
          .from('kvk_history')
          .update({
            prep_result: oppPrep,
            battle_result: oppBattle,
            overall_result: oppOverall
          })
          .eq('kingdom_number', kvkError.current_data.opponent)
          .eq('kvk_number', kvkError.kvk_number);

        if (oppHistoryError) {
          logger.error('Failed to update opponent kvk_history:', oppHistoryError);
        } else {
          logger.log(`✅ Updated opponent kvk_history for K${kvkError.current_data.opponent} KvK#${kvkError.kvk_number}`);
        }

        // Store correction record for audit trail
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
            status: 'approved',
            corrected_by: approvedBy,
            reviewed_at: new Date().toISOString(),
            notes: `Correction approved from error report ${kvkError.id}`
          }, { onConflict: 'kingdom_number,kvk_number' });

        if (mainError) {
          logger.error('Failed to save correction record:', mainError);
        }

        // Store opponent's correction record
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
            status: 'approved',
            corrected_by: approvedBy,
            reviewed_at: new Date().toISOString(),
            notes: `Inverse correction for K${kvkError.kingdom_number}`
          }, { onConflict: 'kingdom_number,kvk_number' });

        // Invalidate all caches to pick up changes immediately
        this.correctionsCache = null;
        this.lastFetchTime = 0;
        
        return true;
      } catch (err) {
        logger.error('Supabase correction error:', err);
      }
    }

    // Fallback to localStorage
    return this.applyCorrection(kvkError, approvedBy);
  }

  /**
   * Calculate overall result from prep and battle results
   * Uses standardized outcome naming: Domination, Reversal, Comeback, Invasion
   */
  private calculateOverallResult(prep: string, battle: string): string {
    return calculateOutcome(prep, battle);
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
      logger.error('Failed to apply KvK correction:', error);
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
      logger.error('Failed to apply opponent correction:', error);
    }
  }

  /**
   * Flip W to L or L to W
   */
  private flipResult(result: string): string {
    return flipResultUtil(result);
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
      logger.error('Failed to remove KvK correction:', error);
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

  /**
   * Submit a new correction for approval (pending status)
   */
  async submitCorrectionForApproval(correction: {
    kingdom_number: number;
    kvk_number: number;
    opponent_kingdom: number;
    original_prep_result: string;
    original_battle_result: string;
    corrected_prep_result: string;
    corrected_battle_result: string;
    submitted_by: string;
    submitted_by_name: string;
    notes?: string;
  }): Promise<{ success: boolean; id?: number; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const overallResult = this.calculateOverallResult(
      correction.corrected_prep_result,
      correction.corrected_battle_result
    );

    try {
      const { data, error } = await supabase
        .from('kvk_corrections')
        .insert({
          kingdom_number: correction.kingdom_number,
          kvk_number: correction.kvk_number,
          opponent_kingdom: correction.opponent_kingdom,
          original_prep_result: correction.original_prep_result,
          original_battle_result: correction.original_battle_result,
          corrected_prep_result: correction.corrected_prep_result,
          corrected_battle_result: correction.corrected_battle_result,
          corrected_overall_result: overallResult,
          submitted_by: correction.submitted_by,
          submitted_by_name: correction.submitted_by_name,
          notes: correction.notes,
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, id: data?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get pending corrections for admin review
   */
  async getPendingCorrections(): Promise<KvKCorrection[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('kvk_corrections')
        .select('*')
        .eq('status', 'pending')
        .order('corrected_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch pending corrections:', error);
        return [];
      }

      return (data || []).map(c => ({
        id: c.id,
        kingdom_number: c.kingdom_number,
        kvk_number: c.kvk_number,
        opponent_kingdom: c.opponent_kingdom,
        original_prep_result: c.original_prep_result,
        original_battle_result: c.original_battle_result,
        corrected_prep_result: c.corrected_prep_result,
        corrected_battle_result: c.corrected_battle_result,
        corrected_overall_result: c.corrected_overall_result,
        status: c.status,
        submitted_by: c.submitted_by,
        submitted_by_name: c.submitted_by_name,
        submitted_at: c.corrected_at,
        approved_at: c.reviewed_at,
        approved_by: c.corrected_by,
        review_notes: c.review_notes
      }));
    } catch (err) {
      logger.error('Error fetching pending corrections:', err);
      return [];
    }
  }

  /**
   * Approve a pending correction
   */
  async approveCorrection(
    correctionId: number,
    approvedBy: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      // Update the correction status
      const { error } = await supabase
        .from('kvk_corrections')
        .update({
          status: 'approved',
          corrected_by: approvedBy,
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', correctionId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Invalidate cache
      this.correctionsCache = null;
      this.lastFetchTime = 0;

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Reject a pending correction
   */
  async rejectCorrection(
    correctionId: number,
    rejectedBy: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase
        .from('kvk_corrections')
        .update({
          status: 'rejected',
          corrected_by: rejectedBy,
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', correctionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get correction stats for admin dashboard
   */
  async getCorrectionStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return { pending: 0, approved: 0, rejected: 0, total: 0 };
    }

    try {
      const { data, error } = await supabase
        .from('kvk_corrections')
        .select('status');

      if (error) {
        logger.error('Failed to fetch correction stats:', error);
        return { pending: 0, approved: 0, rejected: 0, total: 0 };
      }

      const stats = { pending: 0, approved: 0, rejected: 0, total: data?.length || 0 };
      for (const row of data || []) {
        if (row.status === 'pending') stats.pending++;
        else if (row.status === 'approved') stats.approved++;
        else if (row.status === 'rejected') stats.rejected++;
      }

      return stats;
    } catch (err) {
      logger.error('Error fetching correction stats:', err);
      return { pending: 0, approved: 0, rejected: 0, total: 0 };
    }
  }
}

export const kvkCorrectionService = new KvKCorrectionService();
