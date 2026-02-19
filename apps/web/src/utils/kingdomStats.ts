/**
 * Shared utility functions for kingdom statistics calculations
 * Used across KingdomDirectory, KingdomProfile, Leaderboards, and CompareKingdoms
 */

import { Kingdom, KVKRecord, FilterOptions as TypeFilterOptions } from '../types';

// Re-export FilterOptions from types
export type { FilterOptions } from '../types';

/**
 * Calculate streak data from KvK results
 */
export interface StreakData {
  prepWinStreak: number;
  prepLossStreak: number;
  battleWinStreak: number;
  battleLossStreak: number;
  currentPrepStreak: { type: 'win' | 'loss'; count: number };
  currentBattleStreak: { type: 'win' | 'loss'; count: number };
}

export const calculateStreaks = (kvkResults: KVKRecord[]): StreakData => {
  if (!kvkResults || kvkResults.length === 0) {
    return {
      prepWinStreak: 0,
      prepLossStreak: 0,
      battleWinStreak: 0,
      battleLossStreak: 0,
      currentPrepStreak: { type: 'win', count: 0 },
      currentBattleStreak: { type: 'win', count: 0 }
    };
  }

  const sorted = [...kvkResults].sort((a, b) => b.kvk_number - a.kvk_number);
  
  let maxPrepWin = 0, maxPrepLoss = 0, maxBattleWin = 0, maxBattleLoss = 0;
  let currentPrepWin = 0, currentPrepLoss = 0, currentBattleWin = 0, currentBattleLoss = 0;
  
  sorted.forEach((result) => {
    // Prep streak
    if (result.prep_result === 'win') {
      currentPrepWin++;
      currentPrepLoss = 0;
      maxPrepWin = Math.max(maxPrepWin, currentPrepWin);
    } else if (result.prep_result === 'loss') {
      currentPrepLoss++;
      currentPrepWin = 0;
      maxPrepLoss = Math.max(maxPrepLoss, currentPrepLoss);
    }
    
    // Battle streak
    if (result.battle_result === 'win') {
      currentBattleWin++;
      currentBattleLoss = 0;
      maxBattleWin = Math.max(maxBattleWin, currentBattleWin);
    } else if (result.battle_result === 'loss') {
      currentBattleLoss++;
      currentBattleWin = 0;
      maxBattleLoss = Math.max(maxBattleLoss, currentBattleLoss);
    }
  });

  // Current streaks (from most recent)
  let currentPrepType: 'win' | 'loss' = 'win';
  let currentPrepCount = 0;
  let currentBattleType: 'win' | 'loss' = 'win';
  let currentBattleCount = 0;

  for (const result of sorted) {
    if (currentPrepCount === 0) {
      currentPrepType = result.prep_result as 'win' | 'loss';
    }
    if (result.prep_result === currentPrepType) {
      currentPrepCount++;
    } else {
      break;
    }
  }

  for (const result of sorted) {
    if (currentBattleCount === 0) {
      currentBattleType = result.battle_result as 'win' | 'loss';
    }
    if (result.battle_result === currentBattleType) {
      currentBattleCount++;
    } else {
      break;
    }
  }

  return {
    prepWinStreak: maxPrepWin,
    prepLossStreak: maxPrepLoss,
    battleWinStreak: maxBattleWin,
    battleLossStreak: maxBattleLoss,
    currentPrepStreak: { type: currentPrepType, count: currentPrepCount },
    currentBattleStreak: { type: currentBattleType, count: currentBattleCount }
  };
};

/**
 * Count dominations, comebacks, reversals, and invasions
 */
export interface OutcomeStats {
  dominations: number;  // Won both prep and battle
  comebacks: number;    // Lost prep, won battle
  reversals: number;    // Won prep, lost battle
  invasions: number;    // Lost both prep and battle
}

/**
 * Get outcome stats from a Kingdom object (pre-aggregated fields).
 * Used by KingdomTable, KingdomDirectory, and similar list views.
 */
export const getOutcomeStats = (k: Kingdom): OutcomeStats => {
  const dominations = k.dominations ?? 0;
  const invasions = k.invasions ?? 0;
  const comebacks = Math.max(0, k.battle_wins - dominations);
  const reversals = Math.max(0, k.prep_wins - dominations);
  return { dominations, invasions, comebacks, reversals };
};

/**
 * Get a single outcome value by field name (for sorting).
 * Used by KingdomDirectory for frontend sorting on calculated fields.
 */
export const getOutcomeValue = (k: Kingdom, field: string): number => {
  const stats = getOutcomeStats(k);
  if (field === 'dominations') return stats.dominations;
  if (field === 'invasions') return stats.invasions;
  if (field === 'comebacks') return stats.comebacks;
  if (field === 'reversals') return stats.reversals;
  return 0;
};

export const calculateOutcomeStats = (kvkResults: KVKRecord[]): OutcomeStats => {
  if (!kvkResults || kvkResults.length === 0) {
    return { dominations: 0, comebacks: 0, reversals: 0, invasions: 0 };
  }

  return kvkResults.reduce((acc, result) => {
    const prepWin = result.prep_result === 'win';
    const battleWin = result.battle_result === 'win';

    if (prepWin && battleWin) acc.dominations++;
    else if (!prepWin && battleWin) acc.comebacks++;
    else if (prepWin && !battleWin) acc.reversals++;
    else if (!prepWin && !battleWin) acc.invasions++;

    return acc;
  }, { dominations: 0, comebacks: 0, reversals: 0, invasions: 0 });
};

/**
 * Calculate win rates from KvK results
 */
export interface WinRates {
  prepWinRate: number;
  battleWinRate: number;
  prepWins: number;
  prepLosses: number;
  battleWins: number;
  battleLosses: number;
}

export const calculateWinRates = (kvkResults: KVKRecord[]): WinRates => {
  if (!kvkResults || kvkResults.length === 0) {
    return { prepWinRate: 0, battleWinRate: 0, prepWins: 0, prepLosses: 0, battleWins: 0, battleLosses: 0 };
  }

  const prepWins = kvkResults.filter(r => r.prep_result === 'win').length;
  const prepLosses = kvkResults.filter(r => r.prep_result === 'loss').length;
  const battleWins = kvkResults.filter(r => r.battle_result === 'win').length;
  const battleLosses = kvkResults.filter(r => r.battle_result === 'loss').length;

  const prepTotal = prepWins + prepLosses;
  const battleTotal = battleWins + battleLosses;

  return {
    prepWinRate: prepTotal > 0 ? prepWins / prepTotal : 0,
    battleWinRate: battleTotal > 0 ? battleWins / battleTotal : 0,
    prepWins,
    prepLosses,
    battleWins,
    battleLosses
  };
};

/**
 * Get tier description
 */
export const getTierDescription = (tier: string): string => {
  switch (tier) {
    case 'S': return 'Elite kingdom with exceptional KvK performance';
    case 'A': return 'Strong kingdom with consistent wins';
    case 'B': return 'Developing kingdom with moderate experience';
    case 'C': return 'Newer kingdom still building track record';
    default: return 'Kingdom tier based on Atlas Score';
  }
};

/**
 * Format percentage for display
 */
export const formatPercent = (value: number, decimals = 0): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Get color for win rate
 */
export const getWinRateColor = (rate: number): string => {
  if (rate >= 0.8) return '#22c55e'; // Green
  if (rate >= 0.6) return '#eab308'; // Yellow
  if (rate >= 0.4) return '#f97316'; // Orange
  return '#ef4444'; // Red
};

/**
 * Check if filters are default (no active filters)
 */
// Use TypeFilterOptions imported from types

export const DEFAULT_FILTERS: TypeFilterOptions = {
  status: 'all',
  minKvKs: 0,
  maxKvKs: 99,
  minPrepWinRate: 0,
  minBattleWinRate: 0,
  tier: 'all',
  minAtlasScore: 0
};

export const countActiveFilters = (filters: TypeFilterOptions): number => {
  let count = 0;
  if (filters.status && filters.status !== 'all') count++;
  if (filters.minKvKs && filters.minKvKs > 0) count++;
  if (filters.maxKvKs && filters.maxKvKs < 99) count++;
  if (filters.minPrepWinRate && filters.minPrepWinRate > 0) count++;
  if (filters.minBattleWinRate && filters.minBattleWinRate > 0) count++;
  if (filters.tier && filters.tier !== 'all') count++;
  if (filters.minAtlasScore && filters.minAtlasScore > 0) count++;
  return count;
};

export const isDefaultFilters = (filters: TypeFilterOptions): boolean => {
  return countActiveFilters(filters) === 0;
};
