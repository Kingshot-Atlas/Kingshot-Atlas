/**
 * Atlas Score Formula v2.0 - Single Source of Truth
 * 
 * This module contains the centralized Atlas Score calculation used across
 * the entire application. All score calculations should use this module.
 * 
 * Formula Design Principles:
 * - Considers full kingdom history without excessive inflation
 * - Doesn't discourage younger kingdoms from competing
 * - Prevents lucky win streaks from climbing rankings too fast
 * - Uses Bayesian adjustment for statistical confidence
 * 
 * Components:
 * 1. Base Performance Score (Prep 40% + Battle 60% with Bayesian adjustment)
 * 2. Domination/Invasion Multiplier (rewards double wins, penalizes double losses)
 * 3. Recent Form Multiplier (last 5 KvKs weighted by recency)
 * 4. Streak Multiplier (current prep + battle streaks)
 * 5. Experience Factor (logarithmic scaling, veterans get full credit at 5+ KvKs)
 * 6. History Depth Bonus (small bonus for extensive track record)
 */

import { KingdomProfile } from '../types';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/** KvK outcome scores for Recent Form calculation */
export const KVK_OUTCOME_SCORES = {
  Domination: 1.0,   // WW - Best outcome
  Comeback: 0.75,    // LW - Lost prep but won battle (battle matters more)
  Reversal: 0.6,     // WL - Won prep but lost battle (not as good)
  Invasion: 0,       // LL - Worst outcome
} as const;

/** Weights for recent KvKs (most recent = highest weight) */
const RECENT_FORM_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2];

/** Bayesian prior for adjusting win rates (pulls toward 50%) */
const BAYESIAN_PRIOR = 2.5; // Prior wins/losses to add
const BAYESIAN_TOTAL_PRIOR = 5; // Total prior games

/** Experience factor thresholds */
const EXPERIENCE_THRESHOLDS = {
  VETERAN: 16,  // Reference point for logarithmic scaling
  FULL_CREDIT: 5, // Minimum KvKs for full experience credit
};

/** Maximum history depth bonus */
const MAX_HISTORY_BONUS = 1.5;

/** History bonus per KvK */
const HISTORY_BONUS_PER_KVK = 0.05;

// ============================================================================
// TIER SYSTEM
// ============================================================================

export type PowerTier = 'S' | 'A' | 'B' | 'C' | 'D';

/**
 * Tier thresholds based on percentiles
 * These should be recalculated periodically based on actual score distribution
 */
export const TIER_THRESHOLDS = {
  S: 8.90,  // Top 3% - Elite kingdoms
  A: 7.79,  // Top 10% - Strong kingdoms
  B: 6.42,  // Top 25% - Above average
  C: 4.72,  // Top 50% - Average kingdoms
  D: 0,     // Bottom 50% - Below average
} as const;

export const TIER_PERCENTILES = {
  S: { min: 97, label: 'Top 3%', description: 'Elite' },
  A: { min: 90, label: 'Top 10%', description: 'Formidable' },
  B: { min: 75, label: 'Top 25%', description: 'Competitive' },
  C: { min: 50, label: 'Top 50%', description: 'Developing' },
  D: { min: 0, label: 'Bottom 50%', description: 'Rebuilding' },
} as const;

export const TIER_COLORS: Record<PowerTier, string> = {
  S: '#fbbf24',  // Gold
  A: '#22c55e',  // Green
  B: '#3b82f6',  // Blue
  C: '#f97316',  // Orange
  D: '#ef4444',  // Red
};

/**
 * Get power tier from Atlas Score
 */
export function getPowerTier(score: number): PowerTier {
  if (score >= TIER_THRESHOLDS.S) return 'S';
  if (score >= TIER_THRESHOLDS.A) return 'A';
  if (score >= TIER_THRESHOLDS.B) return 'B';
  if (score >= TIER_THRESHOLDS.C) return 'C';
  return 'D';
}

/**
 * Get tier color from score
 */
export function getTierColorFromScore(score: number): string {
  return TIER_COLORS[getPowerTier(score)];
}

// ============================================================================
// SCORE COMPONENT INTERFACES
// ============================================================================

export interface ScoreBreakdown {
  baseScore: number;
  domInvMultiplier: number;
  recentFormMultiplier: number;
  streakMultiplier: number;
  experienceFactor: number;
  historyBonus: number;
  finalScore: number;
  tier: PowerTier;
}

export interface ScoreComponents {
  prepWinRate: { raw: number; adjusted: number; weight: number };
  battleWinRate: { raw: number; adjusted: number; weight: number };
  dominationRate: number;
  invasionRate: number;
  recentFormScore: number;
  prepStreakBonus: number;
  battleStreakBonus: number;
  experienceFactor: number;
}

export interface KingdomStats {
  totalKvks: number;
  prepWins: number;
  prepLosses: number;
  battleWins: number;
  battleLosses: number;
  dominations: number;
  invasions: number;
  recentOutcomes: string[]; // ['Domination', 'Reversal', 'Comeback', 'Invasion']
  currentPrepStreak: number;
  currentBattleStreak: number;
}

// ============================================================================
// CORE FORMULA FUNCTIONS
// ============================================================================

/**
 * Bayesian adjusted win rate - pulls extreme rates toward 50%
 * This prevents lucky 2-0 starts from having inflated scores
 */
export function bayesianAdjustedRate(wins: number, total: number): number {
  if (total === 0) return 0.5; // Default to 50% with no data
  
  const adjustedWins = wins + BAYESIAN_PRIOR;
  const adjustedTotal = total + BAYESIAN_TOTAL_PRIOR;
  
  return adjustedWins / adjustedTotal;
}

/**
 * Calculate base performance score
 * Prep Phase: 40% weight, Battle Phase: 60% weight
 */
export function calculateBaseScore(stats: KingdomStats): number {
  const prepTotal = stats.prepWins + stats.prepLosses;
  const battleTotal = stats.battleWins + stats.battleLosses;
  
  const adjPrepRate = bayesianAdjustedRate(stats.prepWins, prepTotal);
  const adjBattleRate = bayesianAdjustedRate(stats.battleWins, battleTotal);
  
  // Weighted combination: Prep 40%, Battle 60%
  const baseScore = (adjPrepRate * 0.40 + adjBattleRate * 0.60) * 10;
  
  return baseScore;
}

/**
 * Calculate domination/invasion multiplier
 * Rewards consistent double wins, penalizes double losses equally
 */
export function calculateDomInvMultiplier(stats: KingdomStats): number {
  if (stats.totalKvks === 0) return 1.0;
  
  const domRate = stats.dominations / stats.totalKvks;
  const invRate = stats.invasions / stats.totalKvks;
  
  // Domination bonus: up to +15%, Invasion penalty: up to -15%
  const multiplier = 1.0 + (domRate * 0.15) - (invRate * 0.15);
  
  return Math.max(0.85, Math.min(1.15, multiplier));
}

/**
 * Calculate recent form multiplier based on last 5 KvK outcomes
 * Outcomes weighted by recency (most recent = highest weight)
 */
export function calculateRecentFormMultiplier(recentOutcomes: string[]): number {
  if (recentOutcomes.length === 0) return 1.0;
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < Math.min(recentOutcomes.length, 5); i++) {
    const weight = RECENT_FORM_WEIGHTS[i];
    const outcome = recentOutcomes[i];
    const score = KVK_OUTCOME_SCORES[outcome as keyof typeof KVK_OUTCOME_SCORES] ?? 0.5;
    
    weightedScore += score * weight;
    totalWeight += weight;
  }
  
  const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  
  // Convert to multiplier: 0.85 to 1.15 range (±15%)
  // Score of 0.5 = 1.0 multiplier (neutral)
  const multiplier = 1.0 + (normalizedScore - 0.5) * 0.3;
  
  return Math.max(0.85, Math.min(1.15, multiplier));
}

/**
 * Calculate streak multiplier based on current win streaks
 * Battle streaks weighted more heavily than prep streaks
 */
export function calculateStreakMultiplier(prepStreak: number, battleStreak: number): number {
  // Prep streak bonus: 1% per win, max 6%
  const prepBonus = Math.min(prepStreak, 6) * 0.01;
  
  // Battle streak bonus: 1.5% per win, max 9% (battle streaks count more)
  const battleBonus = Math.min(battleStreak, 6) * 0.015;
  
  // Loss streaks: small penalty
  const prepPenalty = prepStreak < 0 ? Math.min(Math.abs(prepStreak), 3) * 0.01 : 0;
  const battlePenalty = battleStreak < 0 ? Math.min(Math.abs(battleStreak), 3) * 0.015 : 0;
  
  const multiplier = 1.0 + prepBonus + battleBonus - prepPenalty - battlePenalty;
  
  return Math.max(0.91, Math.min(1.15, multiplier));
}

/**
 * Calculate experience factor using logarithmic scaling
 * Rewards proven veterans without over-penalizing newcomers
 */
export function calculateExperienceFactor(totalKvks: number): number {
  if (totalKvks === 0) return 0.0;
  if (totalKvks === 1) return 0.4;
  if (totalKvks === 2) return 0.6;
  if (totalKvks === 3) return 0.75;
  if (totalKvks === 4) return 0.9;
  
  // Full credit for 5+ KvKs with slight bonus for extensive history
  // Uses logarithmic scaling: log₁₀(total+1) / log₁₀(17) for gradual increase
  const base = 1.0;
  const historyBonus = 0.5 * (Math.log10(totalKvks + 1) / Math.log10(EXPERIENCE_THRESHOLDS.VETERAN + 1));
  
  return Math.min(1.0, base + historyBonus * 0.1);
}

/**
 * Calculate history depth bonus
 * Small reward for extensive track record
 */
export function calculateHistoryBonus(totalKvks: number): number {
  return Math.min(MAX_HISTORY_BONUS, totalKvks * HISTORY_BONUS_PER_KVK);
}

// ============================================================================
// MAIN SCORE CALCULATION
// ============================================================================

/**
 * Calculate the complete Atlas Score with full breakdown
 */
export function calculateAtlasScore(stats: KingdomStats): ScoreBreakdown {
  // Calculate each component
  const baseScore = calculateBaseScore(stats);
  const domInvMultiplier = calculateDomInvMultiplier(stats);
  const recentFormMultiplier = calculateRecentFormMultiplier(stats.recentOutcomes);
  const streakMultiplier = calculateStreakMultiplier(stats.currentPrepStreak, stats.currentBattleStreak);
  const experienceFactor = calculateExperienceFactor(stats.totalKvks);
  const historyBonus = calculateHistoryBonus(stats.totalKvks);
  
  // Apply formula: (Base × Multipliers × Experience) + History Bonus
  const rawScore = baseScore * domInvMultiplier * recentFormMultiplier * streakMultiplier;
  const scaledScore = rawScore * experienceFactor;
  const finalScore = Math.max(0, Math.min(15, scaledScore + historyBonus));
  
  return {
    baseScore: Math.round(baseScore * 100) / 100,
    domInvMultiplier: Math.round(domInvMultiplier * 1000) / 1000,
    recentFormMultiplier: Math.round(recentFormMultiplier * 1000) / 1000,
    streakMultiplier: Math.round(streakMultiplier * 1000) / 1000,
    experienceFactor: Math.round(experienceFactor * 100) / 100,
    historyBonus: Math.round(historyBonus * 100) / 100,
    finalScore: Math.round(finalScore * 100) / 100,
    tier: getPowerTier(finalScore),
  };
}

/**
 * Simple score calculation (returns just the number)
 */
export function calculateAtlasScoreSimple(stats: KingdomStats): number {
  return calculateAtlasScore(stats).finalScore;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine KvK outcome from prep and battle results
 */
export function getKvKOutcome(prepResult: 'W' | 'L', battleResult: 'W' | 'L'): string {
  if (prepResult === 'W' && battleResult === 'W') return 'Domination';
  if (prepResult === 'L' && battleResult === 'W') return 'Comeback';
  if (prepResult === 'W' && battleResult === 'L') return 'Reversal';
  return 'Invasion';
}

/**
 * Extract KingdomStats from a KingdomProfile object
 */
export function extractStatsFromProfile(kingdom: KingdomProfile): KingdomStats {
  const sortedKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number);
  
  // Filter out Bye results for calculations - Byes don't affect Atlas Score
  // Bye records have: NULL results, 'B' results, overall_result='Bye', or opponent_kingdom=0
  const nonByeKvks = sortedKvks.filter(kvk => 
    kvk.prep_result !== null && 
    kvk.battle_result !== null && 
    kvk.prep_result !== 'B' &&
    kvk.battle_result !== 'B' &&
    kvk.overall_result?.toLowerCase() !== 'bye' &&
    kvk.opponent_kingdom !== 0
  );
  
  // Calculate current streaks (skip Byes - they don't break streaks)
  let currentPrepStreak = 0;
  let currentBattleStreak = 0;
  
  for (const kvk of nonByeKvks) {
    const prepWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
    if (currentPrepStreak === 0) {
      currentPrepStreak = prepWin ? 1 : -1;
    } else if ((prepWin && currentPrepStreak > 0) || (!prepWin && currentPrepStreak < 0)) {
      currentPrepStreak += prepWin ? 1 : -1;
    } else {
      break;
    }
  }
  
  // Reset for battle streak calculation
  for (const kvk of nonByeKvks) {
    const battleWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
    if (currentBattleStreak === 0) {
      currentBattleStreak = battleWin ? 1 : -1;
    } else if ((battleWin && currentBattleStreak > 0) || (!battleWin && currentBattleStreak < 0)) {
      currentBattleStreak += battleWin ? 1 : -1;
    } else {
      break;
    }
  }
  
  // Get recent outcomes (most recent first, excluding Byes)
  const recentOutcomes: string[] = nonByeKvks.slice(0, 5).map(kvk => {
    const prepWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
    const battleWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
    return getKvKOutcome(prepWin ? 'W' : 'L', battleWin ? 'W' : 'L');
  });
  
  return {
    totalKvks: kingdom.total_kvks ?? 0,
    prepWins: kingdom.prep_wins ?? 0,
    prepLosses: kingdom.prep_losses ?? 0,
    battleWins: kingdom.battle_wins ?? 0,
    battleLosses: kingdom.battle_losses ?? 0,
    dominations: kingdom.dominations ?? 0,
    invasions: kingdom.invasions ?? kingdom.defeats ?? 0,
    recentOutcomes,
    currentPrepStreak: Math.max(0, currentPrepStreak),
    currentBattleStreak: Math.max(0, currentBattleStreak),
  };
}

/**
 * Get detailed score components for UI display
 */
export function getScoreComponents(stats: KingdomStats): ScoreComponents {
  const prepTotal = stats.prepWins + stats.prepLosses;
  const battleTotal = stats.battleWins + stats.battleLosses;
  
  return {
    prepWinRate: {
      raw: prepTotal > 0 ? stats.prepWins / prepTotal : 0,
      adjusted: bayesianAdjustedRate(stats.prepWins, prepTotal),
      weight: 40,
    },
    battleWinRate: {
      raw: battleTotal > 0 ? stats.battleWins / battleTotal : 0,
      adjusted: bayesianAdjustedRate(stats.battleWins, battleTotal),
      weight: 60,
    },
    dominationRate: stats.totalKvks > 0 ? stats.dominations / stats.totalKvks : 0,
    invasionRate: stats.totalKvks > 0 ? stats.invasions / stats.totalKvks : 0,
    recentFormScore: calculateRecentFormMultiplier(stats.recentOutcomes),
    prepStreakBonus: Math.min(stats.currentPrepStreak, 6) * 0.01,
    battleStreakBonus: Math.min(stats.currentBattleStreak, 6) * 0.015,
    experienceFactor: calculateExperienceFactor(stats.totalKvks),
  };
}

// ============================================================================
// TOOLTIP CONTENT
// ============================================================================

export const SCORE_TOOLTIPS = {
  atlasScore: 'Comprehensive rating based on win rates, performance patterns, recent form, and experience. Rewards consistency over lucky streaks.',
  baseScore: 'Combined Prep (40%) and Battle (60%) win rates with Bayesian adjustment to prevent small sample bias.',
  domInvMultiplier: 'Dominations boost your score; Invasions hurt it equally. Rewards consistent double-phase performance.',
  recentForm: 'Your last 5 KvKs weighted by recency. Domination = 1.0, Comeback = 0.75, Reversal = 0.6, Invasion = 0.',
  streakBonus: 'Current win streaks provide a small boost. Battle streaks count 50% more than prep streaks.',
  experienceFactor: 'Kingdoms with 5+ KvKs get full credit. Newer kingdoms face a small penalty until they prove themselves.',
  tier: 'Power tier based on Atlas Score percentile. S = Top 3%, A = Top 10%, B = Top 25%, C = Top 50%, D = Bottom 50%.',
};

/**
 * Get tier description for tooltips
 */
export function getTierDescription(tier: PowerTier): string {
  const info = TIER_PERCENTILES[tier];
  const threshold = tier === 'D' ? '0-4.7' : 
                    tier === 'C' ? '4.7-6.4' :
                    tier === 'B' ? '6.4-7.8' :
                    tier === 'A' ? '7.8-8.9' : '8.9+';
  return `${tier}-Tier: ${info.description} kingdom (${info.label}) with Atlas Score ${threshold}`;
}
