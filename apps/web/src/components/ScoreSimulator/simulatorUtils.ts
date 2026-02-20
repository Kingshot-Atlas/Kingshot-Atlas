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
  const insights = generateInsights(legacyCurrentStats, legacySimStats, simulatedKvKs, scoreChange, currentScore, projectedScore);
  
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
  scoreChange: number,
  currentScore: number,
  projectedScore: number
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
  
  // Tier change insights — use actual scores from centralized formula (0-100 scale)
  const currentTier = getPowerTier(currentScore);
  const projectedTier = getPowerTier(projectedScore);
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
