import { describe, it, expect } from 'vitest';
import {
  FORMULA_VERSION,
  TIER_THRESHOLDS,
  DISPLAY_SCALE_FACTOR,
  formatScore,
  formatScoreChange,
  getPowerTier,
  getTierColorFromScore,
  bayesianAdjustedRate,
  calculateBaseScore,
  calculateDomInvMultiplier,
  calculateRecentFormMultiplier,
  calculateStreakMultiplier,
  calculateExperienceFactor,
  calculateHistoryBonus,
  calculateAtlasScore,
  calculateAtlasScoreSimple,
  getKvKOutcome,
  getTierDescription,
  getTierRange,
  type KingdomStats,
} from './atlasScoreFormula';

// ============================================================================
// FORMULA VERSION
// ============================================================================

describe('Formula Version', () => {
  it('is v3.1.0', () => {
    expect(FORMULA_VERSION).toBe('3.1.0');
  });

  it('has correct display scale factor', () => {
    expect(DISPLAY_SCALE_FACTOR).toBeCloseTo(100 / 15, 5);
  });
});

// ============================================================================
// SCORE FORMATTING
// ============================================================================

describe('formatScore', () => {
  it('formats valid scores to 2 decimal places', () => {
    expect(formatScore(10.43)).toBe('10.43');
    expect(formatScore(7.8)).toBe('7.80');
    expect(formatScore(12)).toBe('12.00');
    expect(formatScore(0)).toBe('0.00');
    expect(formatScore(100)).toBe('100.00');
  });

  it('handles null/undefined/NaN', () => {
    expect(formatScore(null)).toBe('0.00');
    expect(formatScore(undefined)).toBe('0.00');
    expect(formatScore(NaN)).toBe('0.00');
  });
});

describe('formatScoreChange', () => {
  it('formats positive changes with + prefix', () => {
    expect(formatScoreChange(1.25)).toBe('+1.25');
    expect(formatScoreChange(0)).toBe('+0.00');
  });

  it('formats negative changes with - prefix', () => {
    expect(formatScoreChange(-0.5)).toBe('-0.50');
  });

  it('handles null/undefined/NaN', () => {
    expect(formatScoreChange(null)).toBe('+0.00');
    expect(formatScoreChange(undefined)).toBe('+0.00');
    expect(formatScoreChange(NaN)).toBe('+0.00');
  });
});

// ============================================================================
// TIER SYSTEM
// ============================================================================

describe('getPowerTier', () => {
  it('returns S for scores >= 57', () => {
    expect(getPowerTier(57)).toBe('S');
    expect(getPowerTier(82.39)).toBe('S');
    expect(getPowerTier(100)).toBe('S');
  });

  it('returns A for scores >= 47 and < 57', () => {
    expect(getPowerTier(47)).toBe('A');
    expect(getPowerTier(56.99)).toBe('A');
  });

  it('returns B for scores >= 38 and < 47', () => {
    expect(getPowerTier(38)).toBe('B');
    expect(getPowerTier(46.99)).toBe('B');
  });

  it('returns C for scores >= 29 and < 38', () => {
    expect(getPowerTier(29)).toBe('C');
    expect(getPowerTier(37.99)).toBe('C');
  });

  it('returns D for scores < 29', () => {
    expect(getPowerTier(28.99)).toBe('D');
    expect(getPowerTier(0)).toBe('D');
  });

  it('tier thresholds match documented values', () => {
    expect(TIER_THRESHOLDS.S).toBe(57);
    expect(TIER_THRESHOLDS.A).toBe(47);
    expect(TIER_THRESHOLDS.B).toBe(38);
    expect(TIER_THRESHOLDS.C).toBe(29);
    expect(TIER_THRESHOLDS.D).toBe(0);
  });
});

describe('getTierColorFromScore', () => {
  it('returns correct color for each tier', () => {
    expect(getTierColorFromScore(60)).toBe('#fbbf24'); // S = Gold
    expect(getTierColorFromScore(50)).toBe('#22c55e'); // A = Green
    expect(getTierColorFromScore(40)).toBe('#3b82f6'); // B = Blue
    expect(getTierColorFromScore(30)).toBe('#f97316'); // C = Orange
    expect(getTierColorFromScore(10)).toBe('#ef4444'); // D = Red
  });
});

describe('getTierRange', () => {
  it('returns correct ranges', () => {
    expect(getTierRange('S')).toBe('57+');
    expect(getTierRange('A')).toBe('47-57');
    expect(getTierRange('B')).toBe('38-47');
    expect(getTierRange('C')).toBe('29-38');
    expect(getTierRange('D')).toBe('0-29');
  });
});

describe('getTierDescription', () => {
  it('includes tier letter and description', () => {
    expect(getTierDescription('S')).toContain('S-Tier');
    expect(getTierDescription('S')).toContain('Elite');
    expect(getTierDescription('A')).toContain('Formidable');
    expect(getTierDescription('B')).toContain('Competitive');
    expect(getTierDescription('C')).toContain('Developing');
    expect(getTierDescription('D')).toContain('Struggling');
  });
});

// ============================================================================
// BAYESIAN ADJUSTMENT
// ============================================================================

describe('bayesianAdjustedRate', () => {
  it('returns 0.5 for no data', () => {
    expect(bayesianAdjustedRate(0, 0)).toBe(0.5);
  });

  it('pulls 100% win rate toward 50%', () => {
    const rate = bayesianAdjustedRate(2, 2); // 2 wins in 2 games
    expect(rate).toBeLessThan(1.0);
    expect(rate).toBeGreaterThan(0.5);
  });

  it('pulls 0% win rate toward 50%', () => {
    const rate = bayesianAdjustedRate(0, 2); // 0 wins in 2 games
    expect(rate).toBeGreaterThan(0.0);
    expect(rate).toBeLessThan(0.5);
  });

  it('converges toward raw rate with more games', () => {
    const small = bayesianAdjustedRate(8, 10); // 80% in 10 games
    const large = bayesianAdjustedRate(80, 100); // 80% in 100 games
    expect(large).toBeGreaterThan(small);
    expect(large).toBeCloseTo(0.8, 1);
  });
});

// ============================================================================
// BASE SCORE
// ============================================================================

describe('calculateBaseScore', () => {
  const makeStats = (overrides: Partial<KingdomStats> = {}): KingdomStats => ({
    totalKvks: 0,
    prepWins: 0,
    prepLosses: 0,
    battleWins: 0,
    battleLosses: 0,
    dominations: 0,
    invasions: 0,
    recentOutcomes: [],
    currentPrepStreak: 0,
    currentBattleStreak: 0,
    ...overrides,
  });

  it('returns ~5.0 for no wins/losses (Bayesian default 50%)', () => {
    const score = calculateBaseScore(makeStats());
    expect(score).toBeCloseTo(5.0, 1);
  });

  it('weights battle more than prep (55% vs 45%)', () => {
    // Good battle, bad prep → higher than good prep, bad battle
    const goodBattle = calculateBaseScore(makeStats({
      totalKvks: 10, prepWins: 0, prepLosses: 10, battleWins: 10, battleLosses: 0,
    }));
    const goodPrep = calculateBaseScore(makeStats({
      totalKvks: 10, prepWins: 10, prepLosses: 0, battleWins: 0, battleLosses: 10,
    }));
    expect(goodBattle).toBeGreaterThan(goodPrep);
  });

  it('returns higher score for perfect record', () => {
    const perfect = calculateBaseScore(makeStats({
      totalKvks: 10, prepWins: 10, prepLosses: 0, battleWins: 10, battleLosses: 0,
    }));
    const average = calculateBaseScore(makeStats({
      totalKvks: 10, prepWins: 5, prepLosses: 5, battleWins: 5, battleLosses: 5,
    }));
    expect(perfect).toBeGreaterThan(average);
  });
});

// ============================================================================
// MULTIPLIERS
// ============================================================================

describe('calculateDomInvMultiplier', () => {
  it('returns 1.0 for no KvKs', () => {
    expect(calculateDomInvMultiplier({ totalKvks: 0, dominations: 0, invasions: 0 } as KingdomStats)).toBe(1.0);
  });

  it('boosts for high domination rate', () => {
    const mult = calculateDomInvMultiplier({ totalKvks: 10, dominations: 10, invasions: 0 } as KingdomStats);
    expect(mult).toBeGreaterThan(1.0);
    expect(mult).toBeLessThanOrEqual(1.15);
  });

  it('penalizes for high invasion rate', () => {
    const mult = calculateDomInvMultiplier({ totalKvks: 10, dominations: 0, invasions: 10 } as KingdomStats);
    expect(mult).toBeLessThan(1.0);
    expect(mult).toBeGreaterThanOrEqual(0.85);
  });

  it('is clamped to [0.85, 1.15]', () => {
    const max = calculateDomInvMultiplier({ totalKvks: 1, dominations: 1, invasions: 0 } as KingdomStats);
    expect(max).toBeLessThanOrEqual(1.15);
    const min = calculateDomInvMultiplier({ totalKvks: 1, dominations: 0, invasions: 1 } as KingdomStats);
    expect(min).toBeGreaterThanOrEqual(0.85);
  });
});

describe('calculateRecentFormMultiplier', () => {
  it('returns 1.0 for empty outcomes', () => {
    expect(calculateRecentFormMultiplier([])).toBe(1.0);
  });

  it('returns > 1.0 for all Dominations', () => {
    const mult = calculateRecentFormMultiplier(['Domination', 'Domination', 'Domination']);
    expect(mult).toBeGreaterThan(1.0);
  });

  it('returns < 1.0 for all Invasions', () => {
    const mult = calculateRecentFormMultiplier(['Invasion', 'Invasion', 'Invasion']);
    expect(mult).toBeLessThan(1.0);
  });

  it('is clamped to [0.85, 1.15]', () => {
    const max = calculateRecentFormMultiplier(Array(5).fill('Domination'));
    expect(max).toBeLessThanOrEqual(1.15);
    const min = calculateRecentFormMultiplier(Array(5).fill('Invasion'));
    expect(min).toBeGreaterThanOrEqual(0.85);
  });

  it('weights recent outcomes more heavily', () => {
    // Same outcomes, different order — recency should tip the balance
    const recentGood = calculateRecentFormMultiplier(['Domination', 'Invasion']);
    const recentBad = calculateRecentFormMultiplier(['Invasion', 'Domination']);
    // More recent Domination → higher multiplier
    expect(recentGood).toBeGreaterThan(recentBad);
  });
});

describe('calculateStreakMultiplier', () => {
  it('returns 1.0 for no streaks', () => {
    expect(calculateStreakMultiplier(0, 0)).toBe(1.0);
  });

  it('increases with win streaks', () => {
    expect(calculateStreakMultiplier(5, 5)).toBeGreaterThan(1.0);
  });

  it('decreases with loss streaks', () => {
    expect(calculateStreakMultiplier(-5, -5)).toBeLessThan(1.0);
  });

  it('is clamped to [0.895, 1.21]', () => {
    expect(calculateStreakMultiplier(20, 20)).toBeLessThanOrEqual(1.21);
    expect(calculateStreakMultiplier(-20, -20)).toBeGreaterThanOrEqual(0.895);
  });

  it('caps win streak bonus at 10', () => {
    const at10 = calculateStreakMultiplier(10, 10);
    const at15 = calculateStreakMultiplier(15, 15);
    expect(at10).toBe(at15); // Both capped
  });
});

// ============================================================================
// EXPERIENCE FACTOR
// ============================================================================

describe('calculateExperienceFactor', () => {
  it('returns 0 for 0 KvKs', () => {
    expect(calculateExperienceFactor(0)).toBe(0.0);
  });

  it('returns step function values', () => {
    expect(calculateExperienceFactor(1)).toBe(0.4);
    expect(calculateExperienceFactor(2)).toBe(0.5);
    expect(calculateExperienceFactor(3)).toBe(0.6);
    expect(calculateExperienceFactor(4)).toBe(0.75);
    expect(calculateExperienceFactor(5)).toBe(0.85);
    expect(calculateExperienceFactor(6)).toBe(0.9);
  });

  it('returns 1.0 for 7+ KvKs', () => {
    expect(calculateExperienceFactor(7)).toBe(1.0);
    expect(calculateExperienceFactor(10)).toBe(1.0);
    expect(calculateExperienceFactor(50)).toBe(1.0);
  });
});

// ============================================================================
// HISTORY BONUS
// ============================================================================

describe('calculateHistoryBonus', () => {
  it('returns 0 for 0 KvKs', () => {
    expect(calculateHistoryBonus(0)).toBe(0);
  });

  it('increases with more KvKs', () => {
    expect(calculateHistoryBonus(10)).toBeGreaterThan(calculateHistoryBonus(5));
  });

  it('caps at 1.5', () => {
    expect(calculateHistoryBonus(100)).toBe(1.5);
    expect(calculateHistoryBonus(30)).toBe(1.5);
  });

  it('is 0.05 per KvK before cap', () => {
    expect(calculateHistoryBonus(1)).toBeCloseTo(0.05, 5);
    expect(calculateHistoryBonus(10)).toBeCloseTo(0.5, 5);
    expect(calculateHistoryBonus(20)).toBeCloseTo(1.0, 5);
  });
});

// ============================================================================
// FULL SCORE CALCULATION
// ============================================================================

describe('calculateAtlasScore', () => {
  const makeStats = (overrides: Partial<KingdomStats> = {}): KingdomStats => ({
    totalKvks: 0,
    prepWins: 0,
    prepLosses: 0,
    battleWins: 0,
    battleLosses: 0,
    dominations: 0,
    invasions: 0,
    recentOutcomes: [],
    currentPrepStreak: 0,
    currentBattleStreak: 0,
    ...overrides,
  });

  it('returns 0 for kingdom with no KvKs', () => {
    const result = calculateAtlasScore(makeStats());
    expect(result.finalScore).toBe(0);
    expect(result.tier).toBe('D');
    expect(result.experienceFactor).toBe(0);
  });

  it('returns a score in 0-100 range', () => {
    const result = calculateAtlasScore(makeStats({
      totalKvks: 10,
      prepWins: 8, prepLosses: 2,
      battleWins: 7, battleLosses: 3,
      dominations: 6, invasions: 1,
      recentOutcomes: ['Domination', 'Domination', 'Comeback', 'Domination', 'Reversal'],
      currentPrepStreak: 3,
      currentBattleStreak: 2,
    }));
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
  });

  it('perfect kingdom gets high score but not 100', () => {
    const result = calculateAtlasScore(makeStats({
      totalKvks: 10,
      prepWins: 10, prepLosses: 0,
      battleWins: 10, battleLosses: 0,
      dominations: 10, invasions: 0,
      recentOutcomes: Array(5).fill('Domination'),
      currentPrepStreak: 10,
      currentBattleStreak: 10,
    }));
    expect(result.finalScore).toBeGreaterThan(60);
    expect(result.finalScore).toBeLessThan(100);
    expect(result.tier).toBe('S');
  });

  it('terrible kingdom gets low score', () => {
    const result = calculateAtlasScore(makeStats({
      totalKvks: 10,
      prepWins: 0, prepLosses: 10,
      battleWins: 0, battleLosses: 10,
      dominations: 0, invasions: 10,
      recentOutcomes: Array(5).fill('Invasion'),
      currentPrepStreak: -10,
      currentBattleStreak: -10,
    }));
    expect(result.finalScore).toBeLessThan(20);
    expect(result.tier).toBe('D');
  });

  it('calculateAtlasScoreSimple returns just the number', () => {
    const stats = makeStats({
      totalKvks: 5, prepWins: 3, prepLosses: 2,
      battleWins: 3, battleLosses: 2, dominations: 2, invasions: 1,
      recentOutcomes: ['Domination', 'Invasion', 'Comeback'],
    });
    const full = calculateAtlasScore(stats);
    const simple = calculateAtlasScoreSimple(stats);
    expect(simple).toBe(full.finalScore);
  });

  it('experience factor correctly reduces new kingdom scores', () => {
    const veteran = calculateAtlasScore(makeStats({
      totalKvks: 10, prepWins: 7, prepLosses: 3, battleWins: 7, battleLosses: 3,
      dominations: 5, invasions: 1,
      recentOutcomes: ['Domination', 'Domination', 'Comeback'],
      currentPrepStreak: 2, currentBattleStreak: 2,
    }));
    const rookie = calculateAtlasScore(makeStats({
      totalKvks: 2, prepWins: 2, prepLosses: 0, battleWins: 2, battleLosses: 0,
      dominations: 2, invasions: 0,
      recentOutcomes: ['Domination', 'Domination'],
      currentPrepStreak: 2, currentBattleStreak: 2,
    }));
    // Veteran with lower win rate should still score higher than 2-KvK rookie
    expect(veteran.finalScore).toBeGreaterThan(rookie.finalScore);
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

describe('getKvKOutcome', () => {
  it('returns correct outcomes', () => {
    expect(getKvKOutcome('W', 'W')).toBe('Domination');
    expect(getKvKOutcome('L', 'W')).toBe('Comeback');
    expect(getKvKOutcome('W', 'L')).toBe('Reversal');
    expect(getKvKOutcome('L', 'L')).toBe('Invasion');
  });
});
