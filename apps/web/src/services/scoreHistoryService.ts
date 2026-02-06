/**
 * Score History Service
 * Fetches Atlas Score history from score_history table (source of truth)
 * Used for score trend charts and historical matchup analysis
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';
import { 
  PowerTier,
  getPowerTier
} from '../utils/atlasScoreFormula';

export interface ScoreHistoryRecord {
  id: string;
  kingdom_number: number;
  kvk_number: number;
  score: number;
  tier: PowerTier;
  rank_at_time: number | null;
  percentile_rank: number | null;
  base_score: number | null;
  dom_inv_multiplier: number | null;
  recent_form_multiplier: number | null;
  streak_multiplier: number | null;
  experience_factor: number | null;
  history_bonus: number | null;
  recorded_at: string;
}

export interface KingdomScoreHistory {
  kingdom_number: number;
  history: ScoreHistoryRecord[];
  current_score: number;
  score_change: number; // Change from first to last recorded score
  avg_change_per_kvk: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface MatchupWithScores {
  kvk_number: number;
  kingdom1: number;
  kingdom2: number;
  kingdom1_score: number;
  kingdom2_score: number;
  kingdom1_tier: string;
  kingdom2_tier: string;
  kingdom1_rank: number | null;
  kingdom2_rank: number | null;
  kingdom1_prep_record: string;
  kingdom2_prep_record: string;
  kingdom1_battle_record: string;
  kingdom2_battle_record: string;
  combined_score: number;
  winner: number | null;
  outcome: string;
  prep_result: string;
  battle_result: string;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute cache
const scoreHistoryCache = new Map<number, CachedData<ScoreHistoryRecord[]>>();
const allMatchupsCache: { data: MatchupWithScores[] | null; timestamp: number } = { data: null, timestamp: 0 };

class ScoreHistoryService {
  /**
   * Get score history for a specific kingdom
   * Fetches directly from score_history table - the source of truth for historical scores
   */
  async getKingdomScoreHistory(kingdomNumber: number): Promise<KingdomScoreHistory | null> {
    if (!isSupabaseConfigured || !supabase) {
      logger.warn('Supabase not configured, cannot fetch score history');
      return null;
    }

    // Check cache
    const cached = scoreHistoryCache.get(kingdomNumber);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return this.buildKingdomScoreHistory(kingdomNumber, cached.data);
    }

    try {
      // Fetch directly from score_history table - the source of truth
      const { data, error } = await supabase
        .from('score_history')
        .select('*')
        .eq('kingdom_number', kingdomNumber)
        .order('kvk_number', { ascending: true });

      if (error) {
        logger.error('Failed to fetch score history:', error);
        return null;
      }

      const records: ScoreHistoryRecord[] = (data || []).map((record: {
        id: string;
        kingdom_number: number;
        kvk_number: number;
        score: number;
        tier: string;
        rank_at_time: number | null;
        percentile_rank?: number | null;
        base_score?: number | null;
        dom_inv_multiplier?: number | null;
        recent_form_multiplier?: number | null;
        streak_multiplier?: number | null;
        experience_factor?: number | null;
        history_bonus?: number | null;
        recorded_at: string;
      }) => ({
        id: record.id,
        kingdom_number: record.kingdom_number,
        kvk_number: record.kvk_number,
        score: record.score,
        tier: record.tier as PowerTier,
        rank_at_time: record.rank_at_time,
        percentile_rank: record.percentile_rank ?? null,
        base_score: record.base_score ?? null,
        dom_inv_multiplier: record.dom_inv_multiplier ?? null,
        recent_form_multiplier: record.recent_form_multiplier ?? null,
        streak_multiplier: record.streak_multiplier ?? null,
        experience_factor: record.experience_factor ?? null,
        history_bonus: record.history_bonus ?? null,
        recorded_at: record.recorded_at
      }));

      scoreHistoryCache.set(kingdomNumber, { data: records, timestamp: Date.now() });

      return this.buildKingdomScoreHistory(kingdomNumber, records);
    } catch (err) {
      logger.error('Error fetching score history:', err);
      return null;
    }
  }

  private buildKingdomScoreHistory(kingdomNumber: number, records: ScoreHistoryRecord[]): KingdomScoreHistory {
    if (records.length === 0) {
      return {
        kingdom_number: kingdomNumber,
        history: [],
        current_score: 0,
        score_change: 0,
        avg_change_per_kvk: 0,
        trend: 'stable'
      };
    }

    const firstRecord = records[0];
    const lastRecord = records[records.length - 1];
    const firstScore = firstRecord?.score ?? 0;
    const lastScore = lastRecord?.score ?? 0;
    const scoreChange = lastScore - firstScore;
    const avgChange = records.length > 1 ? scoreChange / (records.length - 1) : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (avgChange > 0.1) trend = 'improving';
    else if (avgChange < -0.1) trend = 'declining';

    return {
      kingdom_number: kingdomNumber,
      history: records,
      current_score: lastScore,
      score_change: scoreChange,
      avg_change_per_kvk: avgChange,
      trend
    };
  }

  /**
   * Get matchups for a specific KvK season with historical scores
   * Historical scores and ranks come from score_history table
   * For KvK #N, we fetch from score_history where kvk_number = N-1
   * This represents each kingdom's score AFTER the previous KvK ended
   */
  async getSeasonMatchups(kvkNumber: number): Promise<MatchupWithScores[]> {
    if (!isSupabaseConfigured || !supabase) {
      logger.warn('Supabase not configured');
      return [];
    }

    try {
      // Fetch KvK records for matchup data
      const { data: kvkRecords, error: kvkError } = await supabase
        .from('kvk_history')
        .select('kingdom_number, opponent_kingdom, prep_result, battle_result, overall_result')
        .eq('kvk_number', kvkNumber)
        .order('kingdom_number');

      if (kvkError) {
        logger.error('Failed to fetch KvK records:', kvkError);
        return [];
      }

      if (!kvkRecords || kvkRecords.length === 0) {
        logger.info(`No KvK records found for season ${kvkNumber}`);
        return [];
      }

      // Fetch historical scores from score_history table for the PREVIOUS KvK
      // For KvK #10, we need scores from kvk_number = 9 (what kingdoms had AFTER KvK #9)
      const previousKvk = kvkNumber - 1;
      const scoreMap = new Map<number, { score: number; rank: number | null }>();
      
      if (previousKvk >= 1) {
        const { data: scoreHistoryData, error: scoreHistoryError } = await supabase
          .from('score_history')
          .select('kingdom_number, score, rank_at_time')
          .eq('kvk_number', previousKvk);
        
        if (scoreHistoryError) {
          logger.error('Failed to fetch score_history:', scoreHistoryError);
        } else if (scoreHistoryData) {
          scoreHistoryData.forEach(s => {
            scoreMap.set(s.kingdom_number, { 
              score: s.score ?? 0, 
              rank: s.rank_at_time ?? null 
            });
          });
        }
      }
      // For KvK #1, all kingdoms have no prior history (first KvK)

      // Build unique matchups (avoid duplicates where K1 vs K2 and K2 vs K1)
      const matchupSet = new Set<string>();
      const matchups: MatchupWithScores[] = [];

      for (const record of kvkRecords) {
        // Skip bye records
        if (record.opponent_kingdom === 0 || record.prep_result === 'B') continue;

        const k1 = Math.min(record.kingdom_number, record.opponent_kingdom);
        const k2 = Math.max(record.kingdom_number, record.opponent_kingdom);
        const key = `${k1}-${k2}`;

        if (matchupSet.has(key)) continue;
        matchupSet.add(key);

        // Get historical scores and ranks from score_history table
        // NULL = first participation, no Atlas Score yet
        const k1Data = scoreMap.get(k1);
        const k2Data = scoreMap.get(k2);
        const k1Score = k1Data?.score ?? 0;
        const k2Score = k2Data?.score ?? 0;
        const k1Rank = k1Data?.rank ?? null;
        const k2Rank = k2Data?.rank ?? null;
        const k1Tier = getPowerTier(k1Score);
        const k2Tier = getPowerTier(k2Score);

        // Determine winner based on the record perspective
        let winner: number | null = null;
        if (record.overall_result === 'Domination' || record.overall_result === 'Comeback') {
          winner = record.kingdom_number === k1 ? k1 : k2;
        } else if (record.overall_result === 'Invasion' || record.overall_result === 'Reversal') {
          winner = record.kingdom_number === k1 ? k2 : k1;
        }

        // Always put higher score kingdom first
        const [highK, lowK] = k1Score >= k2Score ? [k1, k2] : [k2, k1];
        const [highScore, lowScore] = k1Score >= k2Score ? [k1Score, k2Score] : [k2Score, k1Score];
        const [highTier, lowTier] = k1Score >= k2Score ? [k1Tier, k2Tier] : [k2Tier, k1Tier];
        const [highRank, lowRank] = k1Score >= k2Score ? [k1Rank, k2Rank] : [k2Rank, k1Rank];

        // Determine prep/battle results from highK's (kingdom1) perspective
        // record.prep_result is from record.kingdom_number's perspective
        // If record.kingdom_number is highK, keep as-is; otherwise flip W<->L
        const flipResult = (result: string) => result === 'W' ? 'L' : result === 'L' ? 'W' : result;
        const isRecordFromHighK = record.kingdom_number === highK;
        const adjustedPrepResult = isRecordFromHighK ? record.prep_result : flipResult(record.prep_result);
        const adjustedBattleResult = isRecordFromHighK ? record.battle_result : flipResult(record.battle_result);

        matchups.push({
          kvk_number: kvkNumber,
          kingdom1: highK,
          kingdom2: lowK,
          kingdom1_score: highScore,
          kingdom2_score: lowScore,
          kingdom1_tier: highTier,
          kingdom2_tier: lowTier,
          kingdom1_rank: highRank, // From score_history.rank_at_time
          kingdom2_rank: lowRank,
          kingdom1_prep_record: '', // Fetched separately below
          kingdom2_prep_record: '',
          kingdom1_battle_record: '',
          kingdom2_battle_record: '',
          combined_score: highScore + lowScore,
          winner,
          outcome: record.overall_result,
          prep_result: adjustedPrepResult,
          battle_result: adjustedBattleResult
        });
      }

      // Sort by combined score descending
      const sortedMatchups = matchups.sort((a, b) => b.combined_score - a.combined_score);

      // Fetch historical prep/battle records for all kingdoms in this season
      const allKingdoms = new Set<number>();
      sortedMatchups.forEach(m => {
        allKingdoms.add(m.kingdom1);
        allKingdoms.add(m.kingdom2);
      });

      // Fetch historical records (all KvKs before this one) for each kingdom
      // Must match PostgreSQL function filters: prep_result IS NOT NULL AND prep_result != 'B'
      // IMPORTANT: Supabase has a default 1000 row limit - we need more for 500+ kingdoms × 9 KvKs
      const { data: historyData, error: historyError } = await supabase
        .from('kvk_history')
        .select('kingdom_number, prep_result, battle_result, kvk_number')
        .in('kingdom_number', Array.from(allKingdoms))
        .lt('kvk_number', kvkNumber)
        .not('prep_result', 'is', null)
        .neq('prep_result', 'B')
        .range(0, 9999);
      
      if (historyError) {
        logger.error('Failed to fetch historical records:', historyError);
      }

      // Calculate historical prep/battle records for each kingdom
      // Use case-insensitive comparison to handle any data inconsistencies
      const recordsMap = new Map<number, { prepWins: number; prepLosses: number; battleWins: number; battleLosses: number }>();
      (historyData || []).forEach(h => {
        const existing = recordsMap.get(h.kingdom_number) || { prepWins: 0, prepLosses: 0, battleWins: 0, battleLosses: 0 };
        const prepUpper = (h.prep_result || '').toString().toUpperCase();
        const battleUpper = (h.battle_result || '').toString().toUpperCase();
        
        // Handle both 'W'/'L' and 'WIN'/'LOSS' formats
        if (prepUpper === 'W' || prepUpper === 'WIN') existing.prepWins++;
        if (prepUpper === 'L' || prepUpper === 'LOSS') existing.prepLosses++;
        if (battleUpper === 'W' || battleUpper === 'WIN') existing.battleWins++;
        if (battleUpper === 'L' || battleUpper === 'LOSS') existing.battleLosses++;
        recordsMap.set(h.kingdom_number, existing);
      });

      // Update matchups with historical prep/battle records
      // Ranks are already set from score_history.rank_at_time
      sortedMatchups.forEach(m => {
        const k1Records = recordsMap.get(m.kingdom1);
        const k2Records = recordsMap.get(m.kingdom2);
        
        m.kingdom1_prep_record = k1Records ? `${k1Records.prepWins}-${k1Records.prepLosses}` : '';
        m.kingdom1_battle_record = k1Records ? `${k1Records.battleWins}-${k1Records.battleLosses}` : '';
        m.kingdom2_prep_record = k2Records ? `${k2Records.prepWins}-${k2Records.prepLosses}` : '';
        m.kingdom2_battle_record = k2Records ? `${k2Records.battleWins}-${k2Records.battleLosses}` : '';
      });

      return sortedMatchups;
    } catch (err) {
      logger.error('Error fetching season matchups:', err);
      return [];
    }
  }

  /**
   * Get top matchups of all time
   * Historical scores and ranks come from score_history table
   * For KvK #N, we use scores from score_history where kvk_number = N-1
   */
  async getAllTimeTopMatchups(limit: number = 50): Promise<MatchupWithScores[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    // Check cache
    if (allMatchupsCache.data && Date.now() - allMatchupsCache.timestamp < CACHE_TTL_MS) {
      return allMatchupsCache.data.slice(0, limit);
    }

    try {
      // Fetch ALL KvK records for matchup data
      const { data: allKvkRecords, error: allError } = await supabase
        .from('kvk_history')
        .select('kingdom_number, opponent_kingdom, kvk_number, prep_result, battle_result, overall_result')
        .not('prep_result', 'is', null)
        .neq('prep_result', 'B')
        .order('kvk_number', { ascending: true })
        .range(0, 9999);

      if (allError) {
        logger.error('Failed to fetch all KvK records:', allError);
        return [];
      }

      if (!allKvkRecords || allKvkRecords.length === 0) {
        return [];
      }

      // Fetch ALL score_history records for historical scores and ranks
      const { data: scoreHistoryData, error: scoreHistoryError } = await supabase
        .from('score_history')
        .select('kingdom_number, kvk_number, score, rank_at_time')
        .range(0, 9999);

      if (scoreHistoryError) {
        logger.error('Failed to fetch score_history:', scoreHistoryError);
      }

      // Build score lookup map: for KvK #N, we need scores from kvk_number = N-1
      // Key: "(N)-kingdom_number" -> { score, rank } (where N is the KvK we're displaying)
      const scoreMap = new Map<string, { score: number; rank: number | null }>();
      (scoreHistoryData || []).forEach(s => {
        // score_history.kvk_number represents the score AFTER that KvK
        // So for displaying KvK #10, we need kvk_number = 9
        const displayKvk = s.kvk_number + 1;
        const key = `${displayKvk}-${s.kingdom_number}`;
        scoreMap.set(key, { score: s.score ?? 0, rank: s.rank_at_time ?? null });
      });

      // Build historical records map: for each kingdom at each KvK, calculate their record BEFORE that KvK
      // Key: "kvk_number-kingdom_number" -> { prepWins, prepLosses, battleWins, battleLosses }
      const historicalRecordsMap = new Map<string, { prepWins: number; prepLosses: number; battleWins: number; battleLosses: number }>();
      
      // Group records by kingdom for efficient processing
      const recordsByKingdom = new Map<number, typeof allKvkRecords>();
      allKvkRecords.forEach(r => {
        const existing = recordsByKingdom.get(r.kingdom_number) || [];
        existing.push(r);
        recordsByKingdom.set(r.kingdom_number, existing);
      });

      // For each kingdom, calculate cumulative records at each KvK point
      recordsByKingdom.forEach((records, kingdomNumber) => {
        // Sort by kvk_number ascending
        const sortedRecords = records.sort((a, b) => a.kvk_number - b.kvk_number);
        let prepWins = 0, prepLosses = 0, battleWins = 0, battleLosses = 0;
        
        for (const record of sortedRecords) {
          // Store the record BEFORE this KvK (cumulative up to but not including this KvK)
          const key = `${record.kvk_number}-${kingdomNumber}`;
          historicalRecordsMap.set(key, { prepWins, prepLosses, battleWins, battleLosses });
          
          // Now update cumulative stats with this KvK's results
          const prepUpper = (record.prep_result || '').toString().toUpperCase();
          const battleUpper = (record.battle_result || '').toString().toUpperCase();
          if (prepUpper === 'W' || prepUpper === 'WIN') prepWins++;
          if (prepUpper === 'L' || prepUpper === 'LOSS') prepLosses++;
          if (battleUpper === 'W' || battleUpper === 'WIN') battleWins++;
          if (battleUpper === 'L' || battleUpper === 'LOSS') battleLosses++;
        }
      });

      // Build unique matchups (only from non-bye records)
      const matchupSet = new Set<string>();
      const matchups: MatchupWithScores[] = [];

      for (const record of allKvkRecords) {
        // Skip bye records
        if (record.opponent_kingdom === 0) continue;

        const k1 = Math.min(record.kingdom_number, record.opponent_kingdom);
        const k2 = Math.max(record.kingdom_number, record.opponent_kingdom);
        const key = `${record.kvk_number}-${k1}-${k2}`;

        if (matchupSet.has(key)) continue;
        matchupSet.add(key);

        // Get historical scores and ranks from score_history table
        const k1Data = scoreMap.get(`${record.kvk_number}-${k1}`);
        const k2Data = scoreMap.get(`${record.kvk_number}-${k2}`);
        const k1Score = k1Data?.score ?? 0;
        const k2Score = k2Data?.score ?? 0;
        const k1Rank = k1Data?.rank ?? null;
        const k2Rank = k2Data?.rank ?? null;
        const k1Tier = getPowerTier(k1Score);
        const k2Tier = getPowerTier(k2Score);

        // Get historical records at time of this KvK
        const k1Records = historicalRecordsMap.get(`${record.kvk_number}-${k1}`);
        const k2Records = historicalRecordsMap.get(`${record.kvk_number}-${k2}`);

        let winner: number | null = null;
        if (record.overall_result === 'Domination' || record.overall_result === 'Comeback') {
          winner = record.kingdom_number === k1 ? k1 : k2;
        } else if (record.overall_result === 'Invasion' || record.overall_result === 'Reversal') {
          winner = record.kingdom_number === k1 ? k2 : k1;
        }

        // Put higher score kingdom first
        const [highK, lowK] = k1Score >= k2Score ? [k1, k2] : [k2, k1];
        const [highScore, lowScore] = k1Score >= k2Score ? [k1Score, k2Score] : [k2Score, k1Score];
        const [highTier, lowTier] = k1Score >= k2Score ? [k1Tier, k2Tier] : [k2Tier, k1Tier];
        const [highRank, lowRank] = k1Score >= k2Score ? [k1Rank, k2Rank] : [k2Rank, k1Rank];
        const [highRecords, lowRecords] = k1Score >= k2Score ? [k1Records, k2Records] : [k2Records, k1Records];

        // Determine prep/battle results from highK's (kingdom1) perspective
        // record.prep_result is from record.kingdom_number's perspective
        // If record.kingdom_number is highK, keep as-is; otherwise flip W<->L
        const flipResult = (result: string) => result === 'W' ? 'L' : result === 'L' ? 'W' : result;
        const isRecordFromHighK = record.kingdom_number === highK;
        const adjustedPrepResult = isRecordFromHighK ? record.prep_result : flipResult(record.prep_result);
        const adjustedBattleResult = isRecordFromHighK ? record.battle_result : flipResult(record.battle_result);

        matchups.push({
          kvk_number: record.kvk_number,
          kingdom1: highK,
          kingdom2: lowK,
          kingdom1_score: highScore,
          kingdom2_score: lowScore,
          kingdom1_tier: highTier,
          kingdom2_tier: lowTier,
          kingdom1_rank: highRank,
          kingdom2_rank: lowRank,
          kingdom1_prep_record: highRecords ? `${highRecords.prepWins}-${highRecords.prepLosses}` : '',
          kingdom2_prep_record: lowRecords ? `${lowRecords.prepWins}-${lowRecords.prepLosses}` : '',
          kingdom1_battle_record: highRecords ? `${highRecords.battleWins}-${highRecords.battleLosses}` : '',
          kingdom2_battle_record: lowRecords ? `${lowRecords.battleWins}-${lowRecords.battleLosses}` : '',
          combined_score: highScore + lowScore,
          winner,
          outcome: record.overall_result,
          prep_result: adjustedPrepResult,
          battle_result: adjustedBattleResult
        });
      }

      // Sort by combined score descending
      const sorted = matchups.sort((a, b) => b.combined_score - a.combined_score);
      allMatchupsCache.data = sorted;
      allMatchupsCache.timestamp = Date.now();

      return sorted.slice(0, limit);
    } catch (err) {
      logger.error('Error fetching all-time matchups:', err);
      return [];
    }
  }

  /**
   * Get available seasons (KvK numbers that have data)
   */
  async getAvailableSeasons(): Promise<number[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('kvk_history')
        .select('kvk_number')
        .order('kvk_number', { ascending: false });

      if (error) {
        logger.error('Failed to fetch seasons:', error);
        return [];
      }

      // Get unique KvK numbers
      const seasons = [...new Set((data || []).map((d: { kvk_number: number }) => d.kvk_number))];
      return seasons;
    } catch (err) {
      logger.error('Error fetching seasons:', err);
      return [];
    }
  }

  /**
   * Get season stats summary
   */
  async getSeasonStats(kvkNumber: number): Promise<{
    totalMatchups: number;
    avgCombinedScore: number;
    dominations: number;
    invasions: number;
    comebacks: number;
    reversals: number;
  } | null> {
    const matchups = await this.getSeasonMatchups(kvkNumber);
    if (matchups.length === 0) return null;

    return {
      totalMatchups: matchups.length,
      avgCombinedScore: matchups.reduce((sum, m) => sum + m.combined_score, 0) / matchups.length,
      dominations: matchups.filter(m => m.outcome === 'Domination').length,
      invasions: matchups.filter(m => m.outcome === 'Invasion').length,
      comebacks: matchups.filter(m => m.outcome === 'Comeback').length,
      reversals: matchups.filter(m => m.outcome === 'Reversal').length
    };
  }

  /**
   * Get the latest rank for a kingdom from score_history
   * Returns the rank_at_time from the most recent KvK entry
   * This is the single source of truth for rank display
   */
  async getLatestRank(kingdomNumber: number): Promise<{ rank: number; totalAtKvk: number; kvkNumber: number } | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    try {
      // Get the latest score_history entry for this kingdom
      const { data, error } = await supabase
        .from('score_history')
        .select('kvk_number, rank_at_time')
        .eq('kingdom_number', kingdomNumber)
        .not('rank_at_time', 'is', null)
        .order('kvk_number', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      const latest = data[0] as { kvk_number: number; rank_at_time: number };

      // Get total kingdoms at that KvK for context
      const { count, error: countError } = await supabase
        .from('score_history')
        .select('id', { count: 'exact', head: true })
        .eq('kvk_number', latest.kvk_number);

      if (countError) {
        return { rank: latest.rank_at_time, totalAtKvk: 0, kvkNumber: latest.kvk_number };
      }

      return { rank: latest.rank_at_time, totalAtKvk: count || 0, kvkNumber: latest.kvk_number };
    } catch (err) {
      logger.error('Error fetching latest rank:', err);
      return null;
    }
  }

  /**
   * Clear cache (useful after data updates)
   */
  clearCache(): void {
    scoreHistoryCache.clear();
    allMatchupsCache.data = null;
    allMatchupsCache.timestamp = 0;
  }
}

export const scoreHistoryService = new ScoreHistoryService();
