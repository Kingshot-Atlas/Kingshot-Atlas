/**
 * Score Simulator Utilities
 * 
 * Uses the centralized Atlas Score formula from atlasScoreFormula.ts
 * for frontend score projection simulations.
 */

import { KingdomProfile } from '../../types';
import { calculateOutcome, getOutcomeDisplay } from '../../utils/outcomeUtils';
import {
  calculateAtlasScore,
  extractStatsFromProfile,
  getKvKOutcome,
  getPowerTier,
  type KingdomStats,
} from '../../utils/atlasScoreFormula';

export interface SimulatedKvK {
  prepResult: 'W' | 'L';
  battleResult: 'W' | 'L';
}

export interface SimulationResult {
  currentScore: number;
  projectedScore: number;
  scoreChange: number;
  percentageChange: number;
  breakdown: {
    baseScoreChange: number;
    streakImpact: number;
    experienceGain: number;
    formBonus: number;
  };
  insights: string[];
  projectedTier: 'S' | 'A' | 'B' | 'C' | 'D';
  currentTier: 'S' | 'A' | 'B' | 'C' | 'D';
}

// Wilson Score lower bound for statistical confidence
function wilsonScoreLowerBound(wins: number, total: number, confidence: number = 0.90): number {
  if (total === 0) return 0;
  
  const p = wins / total;
  const n = total;
  
  const zScores: Record<number, number> = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };
  const z = zScores[confidence] || 1.645;
  
  const denominator = 1 + (z ** 2) / n;
  const center = p + (z ** 2) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + (z ** 2) / (4 * n)) / n);
  
  const lowerBound = (center - spread) / denominator;
  return Math.max(0, lowerBound);
}

// Bayesian adjusted win rate with strong prior toward 50%
function bayesianAdjustedWinRate(wins: number, losses: number, priorWins: number = 50, priorLosses: number = 50): number {
  const totalWins = wins + priorWins;
  const totalGames = wins + losses + priorWins + priorLosses;
  return totalGames > 0 ? totalWins / totalGames : 0;
}

// Enhanced Wilson Score with variable confidence based on sample size
function enhancedWilsonScore(wins: number, total: number, minSamplePenalty: number = 0.7): number {
  if (total === 0) return 0;
  
  let confidence: number;
  if (total < 5) {
    confidence = 0.99;
  } else if (total < 10) {
    confidence = 0.95;
  } else {
    confidence = 0.90;
  }
  
  const p = wins / total;
  const n = total;
  
  const zScores: Record<number, number> = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };
  const z = zScores[confidence] || 1.645;
  
  const denominator = 1 + (z ** 2) / n;
  const center = p + (z ** 2) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + (z ** 2) / (4 * n)) / n);
  
  let lowerBound = (center - spread) / denominator;
  
  if (total < 3) {
    lowerBound *= minSamplePenalty;
  }
  
  return Math.max(0, lowerBound);
}

// Calculate streak bonus/penalty
function calculateStreakBonus(streak: number, isCurrent: boolean = true): number {
  if (streak === 0) return 0;
  
  if (isCurrent && streak < 0) {
    const lossStreak = Math.abs(streak);
    if (lossStreak >= 5) return -0.8;
    if (lossStreak >= 3) return -0.5;
    if (lossStreak >= 2) return -0.3;
    return -0.1;
  } else {
    const winStreak = Math.abs(streak);
    if (winStreak >= 8) return 1.0;
    if (winStreak >= 5) return 0.7;
    if (winStreak >= 3) return 0.4;
    if (winStreak >= 2) return 0.2;
    return 0.1;
  }
}

// Get experience factor based on total KvKs (veteran threshold = 5)
function getExperienceFactor(totalKvks: number): number {
  if (totalKvks === 0) return 0.0;
  if (totalKvks === 1) return 0.4;
  if (totalKvks === 2) return 0.6;
  if (totalKvks === 3) return 0.75;
  if (totalKvks === 4) return 0.9;
  return 1.0; // Full credit at 5+ KvKs
}

// Re-export getPowerTier from centralized module (already imported above)

// Comprehensive Atlas Score calculation
function calculateAtlasScoreComprehensive(
  totalKvks: number,
  prepWins: number,
  prepLosses: number,
  battleWins: number,
  battleLosses: number,
  dominations: number,
  invasions: number,
  recentResults: string[],
  currentPrepStreak: number,
  currentBattleStreak: number,
  overallPrepStreak: number,
  overallBattleStreak: number,
  recentPrepRates: number[],
  recentBattleRates: number[]
): number {
  const totalMatches = prepWins + prepLosses;
  if (totalMatches === 0) return 0;
  
  // COMPONENT 1: HYBRID STATISTICAL WIN RATE
  let prepRate: number;
  let battleRate: number;
  
  if (totalKvks < 3) {
    prepRate = bayesianAdjustedWinRate(prepWins, prepLosses, 50, 50);
    battleRate = bayesianAdjustedWinRate(battleWins, battleLosses, 50, 50);
  } else if (totalKvks < 8) {
    prepRate = enhancedWilsonScore(prepWins, totalMatches, 0.8);
    battleRate = enhancedWilsonScore(battleWins, totalMatches, 0.8);
  } else {
    prepRate = wilsonScoreLowerBound(prepWins, totalMatches, 0.90);
    battleRate = wilsonScoreLowerBound(battleWins, totalMatches, 0.90);
  }
  
  const baseWinRate = (prepRate * 0.3) + (battleRate * 0.7);
  
  // COMPONENT 2: DOMINATION/INVASION PATTERN
  let domRate: number;
  let invRate: number;
  
  if (totalKvks < 3) {
    // Fix: bayesianAdjustedWinRate expects (wins, losses), not (wins, total)
    domRate = totalKvks > 0 ? bayesianAdjustedWinRate(dominations, totalKvks - dominations, 10, 10) : 0;
    invRate = totalKvks > 0 ? bayesianAdjustedWinRate(invasions, totalKvks - invasions, 10, 10) : 0;
  } else if (totalKvks < 8) {
    domRate = totalKvks > 0 ? enhancedWilsonScore(dominations, totalKvks, 0.85) : 0;
    invRate = totalKvks > 0 ? enhancedWilsonScore(invasions, totalKvks, 0.85) : 0;
  } else {
    domRate = totalKvks > 0 ? wilsonScoreLowerBound(dominations, totalKvks, 0.90) : 0;
    invRate = totalKvks > 0 ? wilsonScoreLowerBound(invasions, totalKvks, 0.90) : 0;
  }
  
  const performanceModifier = (domRate * 0.8) - (invRate * 0.8);
  
  // COMPONENT 3: RECENT FORM (Last 3 KvKs)
  const weights = [1.0, 0.75, 0.5];
  let recentScore = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < Math.min(recentResults.length, 3); i++) {
    const weight = weights[i] || 0.3;
    const result = recentResults[i];
    if (result === 'D') recentScore += 1.0 * weight;
    else if (result === 'W') recentScore += 0.5 * weight;
    else if (result === 'L') recentScore += 0.0 * weight;
    else if (result === 'F') recentScore -= 0.25 * weight;
    totalWeight += weight;
  }
  
  const recentForm = totalWeight > 0 ? recentScore / totalWeight : 0;
  
  // COMPONENT 4: STREAK ANALYSIS
  const currentPrepBonus = calculateStreakBonus(currentPrepStreak, true);
  const currentBattleBonus = calculateStreakBonus(currentBattleStreak, true);
  const overallPrepBonus = calculateStreakBonus(overallPrepStreak, false);
  const overallBattleBonus = calculateStreakBonus(overallBattleStreak, false);
  
  const totalStreakBonus = (currentPrepBonus * 0.15) + (currentBattleBonus * 0.25) +
                          (overallPrepBonus * 0.20) + (overallBattleBonus * 0.40);
  
  // COMPONENT 5: RECENT PERFORMANCE TREND
  let recentTrendBonus = 0;
  if (recentPrepRates.length > 0 && recentBattleRates.length > 0) {
    const avgRecentPrep = recentPrepRates.reduce((a, b) => a + b, 0) / recentPrepRates.length;
    const avgRecentBattle = recentBattleRates.reduce((a, b) => a + b, 0) / recentBattleRates.length;
    const recentPerformance = (avgRecentPrep * 0.3) + (avgRecentBattle * 0.7);
    
    const recentCount = recentPrepRates.length;
    if (recentCount >= 5) recentTrendBonus = recentPerformance * 1.0;
    else if (recentCount >= 3) recentTrendBonus = recentPerformance * 0.8;
    else if (recentCount >= 1) recentTrendBonus = recentPerformance * 0.5;
  }
  
  // COMPONENT 6: EXPERIENCE SCALING
  const experienceFactor = getExperienceFactor(totalKvks);
  
  // FINAL SCORE CALCULATION
  const baseScore = baseWinRate * 10;
  const performanceScore = performanceModifier * 6;
  const formBonus = recentForm * 4;
  const streakBonus = totalStreakBonus * 3;
  const trendBonus = recentTrendBonus * 2;
  
  const rawScore = baseScore + performanceScore + formBonus + streakBonus + trendBonus;
  let finalScore = rawScore * experienceFactor;
  
  finalScore = Math.max(0, Math.min(20, finalScore));
  
  return Math.round(finalScore * 100) / 100;
}

// Extract current stats from kingdom data
function extractKingdomStats(kingdom: KingdomProfile) {
  const sortedKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number);
  
  // Calculate current streaks
  let currentPrepStreak = 0;
  let currentBattleStreak = 0;
  
  for (const kvk of sortedKvks) {
    const prepWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
    if (currentPrepStreak === 0) {
      currentPrepStreak = prepWin ? 1 : -1;
    } else if ((prepWin && currentPrepStreak > 0) || (!prepWin && currentPrepStreak < 0)) {
      currentPrepStreak += prepWin ? 1 : -1;
    } else {
      break;
    }
  }
  
  for (const kvk of sortedKvks) {
    const battleWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
    if (currentBattleStreak === 0) {
      currentBattleStreak = battleWin ? 1 : -1;
    } else if ((battleWin && currentBattleStreak > 0) || (!battleWin && currentBattleStreak < 0)) {
      currentBattleStreak += battleWin ? 1 : -1;
    } else {
      break;
    }
  }
  
  // Get recent results (D=Domination, W=Win, L=Loss, F=Invasion)
  const recentResults: string[] = sortedKvks.slice(0, 5).map(kvk => {
    const prepWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
    const battleWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
    if (prepWin && battleWin) return 'D';
    if (battleWin) return 'W';
    if (!prepWin && !battleWin) return 'F';
    return 'L';
  });
  
  // Get recent rates
  const recentPrepRates = sortedKvks.slice(0, 5).map(kvk => 
    kvk.prep_result === 'Win' || kvk.prep_result === 'W' ? 1 : 0
  );
  const recentBattleRates = sortedKvks.slice(0, 5).map(kvk => 
    kvk.battle_result === 'Win' || kvk.battle_result === 'W' ? 1 : 0
  );
  
  return {
    totalKvks: kingdom.total_kvks,
    prepWins: kingdom.prep_wins,
    prepLosses: kingdom.prep_losses,
    battleWins: kingdom.battle_wins,
    battleLosses: kingdom.battle_losses,
    dominations: kingdom.dominations ?? 0,
    invasions: kingdom.invasions ?? kingdom.defeats ?? 0,
    recentResults,
    currentPrepStreak,
    currentBattleStreak,
    overallPrepStreak: kingdom.prep_best_streak ?? Math.max(0, currentPrepStreak),
    overallBattleStreak: kingdom.battle_best_streak ?? Math.max(0, currentBattleStreak),
    recentPrepRates,
    recentBattleRates
  };
}

// Main simulation function using centralized Atlas Score formula
export function simulateScore(
  kingdom: KingdomProfile,
  simulatedKvKs: SimulatedKvK[]
): SimulationResult {
  // Use centralized extraction for current stats
  const currentKingdomStats = extractStatsFromProfile(kingdom);
  const currentBreakdown = calculateAtlasScore(currentKingdomStats);
  const currentScore = currentBreakdown.finalScore;
  
  // Clone stats for simulation
  const simStats: KingdomStats = { ...currentKingdomStats };
  
  // Track initial experience factor
  const initialExpFactor = currentBreakdown.experienceFactor;
  
  // Apply each simulated KvK
  for (const kvk of simulatedKvKs) {
    simStats.totalKvks += 1;
    
    // Update prep stats
    if (kvk.prepResult === 'W') {
      simStats.prepWins += 1;
      simStats.currentPrepStreak = simStats.currentPrepStreak > 0 
        ? simStats.currentPrepStreak + 1 
        : 1;
    } else {
      simStats.prepLosses += 1;
      simStats.currentPrepStreak = 0; // Reset on loss
    }
    
    // Update battle stats
    if (kvk.battleResult === 'W') {
      simStats.battleWins += 1;
      simStats.currentBattleStreak = simStats.currentBattleStreak > 0 
        ? simStats.currentBattleStreak + 1 
        : 1;
    } else {
      simStats.battleLosses += 1;
      simStats.currentBattleStreak = 0; // Reset on loss
    }
    
    // Update domination/invasion counts
    if (kvk.prepResult === 'W' && kvk.battleResult === 'W') {
      simStats.dominations += 1;
    } else if (kvk.prepResult === 'L' && kvk.battleResult === 'L') {
      simStats.invasions += 1;
    }
    
    // Update recent outcomes using centralized function
    const newOutcome = getKvKOutcome(kvk.prepResult, kvk.battleResult);
    simStats.recentOutcomes = [newOutcome, ...simStats.recentOutcomes.slice(0, 4)];
  }
  
  // Calculate projected score using centralized formula
  const projectedBreakdown = calculateAtlasScore(simStats);
  const projectedScore = projectedBreakdown.finalScore;
  
  const scoreChange = projectedScore - currentScore;
  const percentageChange = currentScore > 0 ? (scoreChange / currentScore) * 100 : 0;
  
  // Calculate breakdown components from centralized results
  const experienceGain = (projectedBreakdown.experienceFactor - initialExpFactor) * 10;
  const streakImpact = (projectedBreakdown.streakMultiplier - currentBreakdown.streakMultiplier) * currentBreakdown.baseScore;
  const formBonus = (projectedBreakdown.recentFormMultiplier - currentBreakdown.recentFormMultiplier) * currentBreakdown.baseScore;
  const baseScoreChange = scoreChange - experienceGain - streakImpact - formBonus;
  
  // Generate insights using legacy format for compatibility
  const legacyCurrentStats = extractKingdomStats(kingdom);
  const legacySimStats = {
    ...legacyCurrentStats,
    totalKvks: simStats.totalKvks,
    prepWins: simStats.prepWins,
    prepLosses: simStats.prepLosses,
    battleWins: simStats.battleWins,
    battleLosses: simStats.battleLosses,
    dominations: simStats.dominations,
    invasions: simStats.invasions,
    currentPrepStreak: simStats.currentPrepStreak,
    currentBattleStreak: simStats.currentBattleStreak,
    recentResults: simStats.recentOutcomes.map(o => {
      switch(o) {
        case 'Domination': return 'D';
        case 'Comeback': return 'W';
        case 'Reversal': return 'L';
        case 'Invasion': return 'F';
        default: return 'F';
      }
    }),
  };
  const insights = generateInsights(legacyCurrentStats, legacySimStats, simulatedKvKs, scoreChange);
  
  return {
    currentScore,
    projectedScore,
    scoreChange,
    percentageChange,
    breakdown: {
      baseScoreChange: Math.round(baseScoreChange * 100) / 100,
      streakImpact: Math.round(streakImpact * 100) / 100,
      experienceGain: Math.round(experienceGain * 100) / 100,
      formBonus: Math.round((scoreChange - baseScoreChange - streakImpact - experienceGain) * 100) / 100
    },
    insights,
    currentTier: getPowerTier(currentScore),
    projectedTier: getPowerTier(projectedScore)
  };
}

// Generate actionable insights
function generateInsights(
  currentStats: ReturnType<typeof extractKingdomStats>,
  simStats: ReturnType<typeof extractKingdomStats>,
  simulatedKvKs: SimulatedKvK[],
  scoreChange: number
): string[] {
  const insights: string[] = [];
  
  // Streak insights
  if (simStats.currentPrepStreak >= 3 && currentStats.currentPrepStreak < 3) {
    insights.push(`Building a ${simStats.currentPrepStreak}-win prep streak boosts your score significantly.`);
  }
  if (simStats.currentBattleStreak >= 3 && currentStats.currentBattleStreak < 3) {
    insights.push(`A ${simStats.currentBattleStreak}-win battle streak is your strongest asset!`);
  }
  if (simStats.currentPrepStreak < 0 && currentStats.currentPrepStreak > 0) {
    insights.push("Losing this prep phase would break your winning streak.");
  }
  if (simStats.currentBattleStreak < 0 && currentStats.currentBattleStreak > 0) {
    insights.push("Losing this battle phase would break your winning streak.");
  }
  
  // Experience insights
  if (currentStats.totalKvks < 5 && simStats.totalKvks >= 5) {
    insights.push("You'll reach veteran status (5+ KvKs) - full experience bonus unlocked!");
  }
  
  // Domination insights
  const newDominations = simStats.dominations - currentStats.dominations;
  if (newDominations > 0) {
    insights.push(`${newDominations} domination${newDominations > 1 ? 's' : ''} will boost your performance modifier.`);
  }
  
  // Tier change insights
  const currentTier = getPowerTier(simulateScoreWithStats(currentStats));
  const projectedTier = getPowerTier(simulateScoreWithStats(simStats));
  if (projectedTier !== currentTier) {
    if (['S', 'A'].includes(projectedTier) && !['S', 'A'].includes(currentTier)) {
      insights.push(`This could push you into ${projectedTier}-Tier! Elite territory.`);
    } else if (projectedTier < currentTier) {
      insights.push(`Warning: You might drop to ${projectedTier}-Tier.`);
    }
  }
  
  // All wins insight
  const allWins = simulatedKvKs.every(k => k.prepResult === 'W' && k.battleResult === 'W');
  if (allWins && simulatedKvKs.length >= 2) {
    insights.push("Dominating consistently compounds your score over time.");
  }
  
  // All losses insight
  const allLosses = simulatedKvKs.every(k => k.prepResult === 'L' && k.battleResult === 'L');
  if (allLosses && simulatedKvKs.length >= 2) {
    insights.push("Multiple invasions will hurt, but recovery is possible with consistency.");
  }
  
  // General score change insight
  if (scoreChange > 0 && insights.length === 0) {
    insights.push("Consistency pays off - keep up the good work!");
  }
  
  return insights.slice(0, 3);
}

// Helper to calculate score from stats object
function simulateScoreWithStats(stats: ReturnType<typeof extractKingdomStats>): number {
  return calculateAtlasScoreComprehensive(
    stats.totalKvks,
    stats.prepWins,
    stats.prepLosses,
    stats.battleWins,
    stats.battleLosses,
    stats.dominations,
    stats.invasions,
    stats.recentResults,
    stats.currentPrepStreak,
    stats.currentBattleStreak,
    stats.overallPrepStreak,
    stats.overallBattleStreak,
    stats.recentPrepRates,
    stats.recentBattleRates
  );
}

// Get outcome label for a simulated KvK
export function getSimulatedOutcome(prep: 'W' | 'L', battle: 'W' | 'L'): {
  label: string;
  abbrev: string;
  color: string;
  bgColor: string;
  emoji: string;
} {
  const outcome = calculateOutcome(prep, battle);
  const display = getOutcomeDisplay(outcome);
  return {
    label: display.label,
    abbrev: display.abbrev,
    color: display.color,
    bgColor: display.bgColor,
    emoji: display.emoji
  };
}
