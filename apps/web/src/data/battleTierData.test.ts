import { describe, it, expect } from 'vitest';
import {
  calculateOffenseScore,
  calculateDefenseScore,
  calculateWeightedOffenseScore,
  calculateWeightedDefenseScore,
  getOffensiveAdjustedStats,
  recalculateAllWeighted,
  recalculateAll,
  isTroopWeightsDefault,
  isPlayerComplete,
  DEFAULT_TROOP_WEIGHTS,
  type BattlePlayerEntry,
  type BattleTroopWeights,
} from './battleTierData';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/** Realistic player with offensive heroes (Helga, Petra, Marlin) at EG 5 */
const PLAYER_OFFENSIVE: BattlePlayerEntry = {
  id: 'p1',
  playerName: 'OffensivePlayer',
  infantryHero: 'Helga', infantryEGLevel: 5,
  infantryAttack: 350, infantryLethality: 280, infantryDefense: 200, infantryHealth: 220,
  cavalryHero: 'Petra', cavalryEGLevel: 5,
  cavalryAttack: 340, cavalryLethality: 270, cavalryDefense: 190, cavalryHealth: 210,
  archerHero: 'Marlin', archerEGLevel: 5,
  archerAttack: 330, archerLethality: 260, archerDefense: 185, archerHealth: 205,
  offenseScore: 0, defenseScore: 0,
  offenseTier: 'D', defenseTier: 'D',
};

/** Realistic player with defensive heroes (Zoe, Jabel, Saul) at EG 5 */
const PLAYER_DEFENSIVE: BattlePlayerEntry = {
  id: 'p2',
  playerName: 'DefensivePlayer',
  infantryHero: 'Zoe', infantryEGLevel: 5,
  infantryAttack: 360, infantryLethality: 260, infantryDefense: 210, infantryHealth: 230,
  cavalryHero: 'Jabel', cavalryEGLevel: 5,
  cavalryAttack: 345, cavalryLethality: 275, cavalryDefense: 195, cavalryHealth: 215,
  archerHero: 'Saul', archerEGLevel: 5,
  archerAttack: 335, archerLethality: 255, archerDefense: 190, archerHealth: 200,
  offenseScore: 0, defenseScore: 0,
  offenseTier: 'D', defenseTier: 'D',
};

/** Player with no heroes (EG 0) for simpler math */
const PLAYER_NO_EG: BattlePlayerEntry = {
  id: 'p3',
  playerName: 'NoEGPlayer',
  infantryHero: 'Helga', infantryEGLevel: 0,
  infantryAttack: 300, infantryLethality: 250, infantryDefense: 200, infantryHealth: 200,
  cavalryHero: 'Petra', cavalryEGLevel: 0,
  cavalryAttack: 300, cavalryLethality: 250, cavalryDefense: 200, cavalryHealth: 200,
  archerHero: 'Marlin', archerEGLevel: 0,
  archerAttack: 300, archerLethality: 250, archerDefense: 200, archerHealth: 200,
  offenseScore: 0, defenseScore: 0,
  offenseTier: 'D', defenseTier: 'D',
};

/** Incomplete player (missing stats) */
const PLAYER_INCOMPLETE: BattlePlayerEntry = {
  id: 'p4',
  playerName: 'IncompletePlayer',
  infantryHero: 'Helga', infantryEGLevel: 5,
  infantryAttack: 350, infantryLethality: 280, infantryDefense: 0, infantryHealth: 0,
  cavalryHero: '', cavalryEGLevel: -1,
  cavalryAttack: 0, cavalryLethality: 0, cavalryDefense: 0, cavalryHealth: 0,
  archerHero: '', archerEGLevel: -1,
  archerAttack: 0, archerLethality: 0, archerDefense: 0, archerHealth: 0,
  offenseScore: 0, defenseScore: 0,
  offenseTier: 'D', defenseTier: 'D',
};

const CUSTOM_WEIGHTS: BattleTroopWeights = {
  infantry: { attack: 2, lethality: 1.5, defense: 0.5, health: 0.5 },
  cavalry: { attack: 2, lethality: 1.5, defense: 0.5, health: 0.5 },
  archer: { attack: 2, lethality: 1.5, defense: 0.5, health: 0.5 },
};

// ============================================================================
// getOffensiveAdjustedStats
// ============================================================================

describe('getOffensiveAdjustedStats', () => {
  it('removes base 10% city defense bonus from attack with no heroes', () => {
    const result = getOffensiveAdjustedStats([], 300, 250, 200, 200);
    // Attack: (300 - 0.10 * 100) / (1 + 0.10) = 290 / 1.10 ≈ 263.6
    expect(result.attack).toBeCloseTo(263.6, 0);
    // Other stats unchanged with no heroes
    expect(result.lethality).toBe(250);
    expect(result.defense).toBe(200);
    expect(result.health).toBe(200);
  });

  it('removes defensive EG inflation from attack stat', () => {
    // Zoe: defensive, egStat: attack
    const heroes = [{ name: 'Zoe', egLevel: 5 }];
    const result = getOffensiveAdjustedStats(heroes, 360, 260, 210, 230);
    // Defensive EG inflation is removed: result will be lower than scouted 360
    expect(result.attack).toBeCloseTo(291.5, 0);
  });

  it('applies offensive EG bonus to attack', () => {
    // Amadeus: offensive, egStat: attack
    const heroes = [{ name: 'Amadeus', egLevel: 5 }];
    const result = getOffensiveAdjustedStats(heroes, 300, 250, 200, 200);
    // Phase 1: base removal: (300 - 10) / 1.1 ≈ 263.6
    // Phase 2: offensive atk bonus 0.035: 263.6 * 1.035 + 3.5 ≈ 276.3
    expect(result.attack).toBeGreaterThan(263.6);
    expect(result.lethality).toBe(250);
  });

  it('applies offensive EG bonus to lethality', () => {
    // Helga: offensive, egStat: lethality
    const heroes = [{ name: 'Helga', egLevel: 5 }];
    const result = getOffensiveAdjustedStats(heroes, 300, 250, 200, 200);
    // Lethality gets offensive boost
    expect(result.lethality).toBeGreaterThan(250);
  });

  it('rounds output to 1 decimal place', () => {
    const result = getOffensiveAdjustedStats([], 333, 222, 111, 444);
    expect(result.attack).toBe(Math.round(result.attack * 10) / 10);
    expect(result.lethality).toBe(Math.round(result.lethality * 10) / 10);
    expect(result.defense).toBe(Math.round(result.defense * 10) / 10);
    expect(result.health).toBe(Math.round(result.health * 10) / 10);
  });
});

// ============================================================================
// calculateOffenseScore
// ============================================================================

describe('calculateOffenseScore', () => {
  it('returns a positive number for a complete player', () => {
    const score = calculateOffenseScore(PLAYER_OFFENSIVE);
    expect(score).toBeGreaterThan(0);
  });

  it('sums adjusted stats across all 3 troop types', () => {
    const score = calculateOffenseScore(PLAYER_NO_EG);
    // With EG 0, only base 10% city defense attack bonus is removed
    // All 3 troop types have same stats, so the score should be ~3x single troop
    expect(score).toBeGreaterThan(2000); // 3 × (263.6 + 250 + 200 + 200) ≈ 2740
    expect(score).toBeLessThan(3500);
  });

  it('offensive heroes produce higher offense score than defensive heroes (same raw stats)', () => {
    // Create identical stat players but with different hero types
    const offPlayer = { ...PLAYER_NO_EG, infantryHero: 'Amadeus', infantryEGLevel: 5 };
    const defPlayer = { ...PLAYER_NO_EG, infantryHero: 'Zoe', infantryEGLevel: 5 };
    const offScore = calculateOffenseScore(offPlayer);
    const defScore = calculateOffenseScore(defPlayer);
    // Offensive hero adds EG bonus; defensive hero has inflation removed → lower
    expect(offScore).toBeGreaterThan(defScore);
  });

  it('returns negative for all-zero stats due to base city defense removal', () => {
    const zeroPlayer = {
      infantryHero: '', infantryEGLevel: 0,
      infantryAttack: 0, infantryLethality: 0, infantryDefense: 0, infantryHealth: 0,
      cavalryHero: '', cavalryEGLevel: 0,
      cavalryAttack: 0, cavalryLethality: 0, cavalryDefense: 0, cavalryHealth: 0,
      archerHero: '', archerEGLevel: 0,
      archerAttack: 0, archerLethality: 0, archerDefense: 0, archerHealth: 0,
    };
    // Base 10% city defense removal: (0 - 10) / 1.1 ≈ -9.09 per troop × 3
    expect(calculateOffenseScore(zeroPlayer)).toBeLessThan(0);
  });
});

// ============================================================================
// calculateDefenseScore
// ============================================================================

describe('calculateDefenseScore', () => {
  it('returns a positive number for a complete player', () => {
    const score = calculateDefenseScore(PLAYER_DEFENSIVE);
    expect(score).toBeGreaterThan(0);
  });

  it('sums all 12 raw stats without any adjustment', () => {
    const expected =
      PLAYER_NO_EG.infantryAttack + PLAYER_NO_EG.infantryLethality + PLAYER_NO_EG.infantryDefense + PLAYER_NO_EG.infantryHealth +
      PLAYER_NO_EG.cavalryAttack + PLAYER_NO_EG.cavalryLethality + PLAYER_NO_EG.cavalryDefense + PLAYER_NO_EG.cavalryHealth +
      PLAYER_NO_EG.archerAttack + PLAYER_NO_EG.archerLethality + PLAYER_NO_EG.archerDefense + PLAYER_NO_EG.archerHealth;
    expect(calculateDefenseScore(PLAYER_NO_EG)).toBe(expected);
  });

  it('is not affected by hero choice or EG level', () => {
    // Same raw stats, different heroes should give same defense score
    const a = calculateDefenseScore(PLAYER_NO_EG);
    const modified = { ...PLAYER_NO_EG, infantryHero: 'Zoe', infantryEGLevel: 10 };
    const b = calculateDefenseScore(modified);
    expect(a).toBe(b);
  });

  it('returns 0 for all-zero stats', () => {
    const zero = {
      infantryAttack: 0, infantryLethality: 0, infantryDefense: 0, infantryHealth: 0,
      cavalryAttack: 0, cavalryLethality: 0, cavalryDefense: 0, cavalryHealth: 0,
      archerAttack: 0, archerLethality: 0, archerDefense: 0, archerHealth: 0,
    };
    expect(calculateDefenseScore(zero)).toBe(0);
  });
});

// ============================================================================
// calculateWeightedOffenseScore
// ============================================================================

describe('calculateWeightedOffenseScore', () => {
  it('equals calculateOffenseScore when weights are all 1', () => {
    const normal = calculateOffenseScore(PLAYER_OFFENSIVE);
    const weighted = calculateWeightedOffenseScore(PLAYER_OFFENSIVE, DEFAULT_TROOP_WEIGHTS);
    expect(weighted).toBeCloseTo(normal, 2);
  });

  it('produces different score when weights differ from default', () => {
    const normal = calculateOffenseScore(PLAYER_OFFENSIVE);
    const weighted = calculateWeightedOffenseScore(PLAYER_OFFENSIVE, CUSTOM_WEIGHTS);
    expect(weighted).not.toBeCloseTo(normal, 0);
  });

  it('doubles the score when all weights are 2', () => {
    const normalScore = calculateOffenseScore(PLAYER_NO_EG);
    const doubleWeights: BattleTroopWeights = {
      infantry: { attack: 2, lethality: 2, defense: 2, health: 2 },
      cavalry: { attack: 2, lethality: 2, defense: 2, health: 2 },
      archer: { attack: 2, lethality: 2, defense: 2, health: 2 },
    };
    const weightedScore = calculateWeightedOffenseScore(PLAYER_NO_EG, doubleWeights);
    expect(weightedScore).toBeCloseTo(normalScore * 2, 1);
  });

  it('zeroes out stats when weight is 0', () => {
    const zeroDefWeights: BattleTroopWeights = {
      infantry: { attack: 1, lethality: 1, defense: 0, health: 0 },
      cavalry: { attack: 1, lethality: 1, defense: 0, health: 0 },
      archer: { attack: 1, lethality: 1, defense: 0, health: 0 },
    };
    const fullScore = calculateWeightedOffenseScore(PLAYER_NO_EG, DEFAULT_TROOP_WEIGHTS);
    const partialScore = calculateWeightedOffenseScore(PLAYER_NO_EG, zeroDefWeights);
    expect(partialScore).toBeLessThan(fullScore);
  });
});

// ============================================================================
// calculateWeightedDefenseScore
// ============================================================================

describe('calculateWeightedDefenseScore', () => {
  it('equals calculateDefenseScore when weights are all 1', () => {
    const normal = calculateDefenseScore(PLAYER_DEFENSIVE);
    const weighted = calculateWeightedDefenseScore(PLAYER_DEFENSIVE, DEFAULT_TROOP_WEIGHTS);
    expect(weighted).toBe(normal);
  });

  it('correctly applies per-stat weights', () => {
    // Only count attack (weight 1) and zero everything else
    const atkOnlyWeights: BattleTroopWeights = {
      infantry: { attack: 1, lethality: 0, defense: 0, health: 0 },
      cavalry: { attack: 1, lethality: 0, defense: 0, health: 0 },
      archer: { attack: 1, lethality: 0, defense: 0, health: 0 },
    };
    const score = calculateWeightedDefenseScore(PLAYER_NO_EG, atkOnlyWeights);
    const expected = PLAYER_NO_EG.infantryAttack + PLAYER_NO_EG.cavalryAttack + PLAYER_NO_EG.archerAttack;
    expect(score).toBe(expected);
  });

  it('doubles with 2x weights', () => {
    const normalScore = calculateDefenseScore(PLAYER_NO_EG);
    const doubleWeights: BattleTroopWeights = {
      infantry: { attack: 2, lethality: 2, defense: 2, health: 2 },
      cavalry: { attack: 2, lethality: 2, defense: 2, health: 2 },
      archer: { attack: 2, lethality: 2, defense: 2, health: 2 },
    };
    expect(calculateWeightedDefenseScore(PLAYER_NO_EG, doubleWeights)).toBe(normalScore * 2);
  });
});

// ============================================================================
// isTroopWeightsDefault
// ============================================================================

describe('isTroopWeightsDefault', () => {
  it('returns true for default weights', () => {
    expect(isTroopWeightsDefault(DEFAULT_TROOP_WEIGHTS)).toBe(true);
  });

  it('returns false when any weight differs', () => {
    const modified = structuredClone(DEFAULT_TROOP_WEIGHTS);
    modified.infantry.attack = 1.5;
    expect(isTroopWeightsDefault(modified)).toBe(false);
  });

  it('returns false when a single troop type has one non-1 weight', () => {
    const modified = structuredClone(DEFAULT_TROOP_WEIGHTS);
    modified.archer.health = 0;
    expect(isTroopWeightsDefault(modified)).toBe(false);
  });
});

// ============================================================================
// recalculateAllWeighted
// ============================================================================

describe('recalculateAllWeighted', () => {
  it('returns empty array unchanged', () => {
    expect(recalculateAllWeighted([])).toEqual([]);
  });

  it('assigns tiers and scores to complete players', () => {
    const players = [
      { ...PLAYER_OFFENSIVE },
      { ...PLAYER_DEFENSIVE },
      { ...PLAYER_NO_EG },
    ];
    const result = recalculateAllWeighted(players);
    for (const p of result) {
      expect(p.offenseScore).toBeGreaterThan(0);
      expect(p.defenseScore).toBeGreaterThan(0);
      expect(['SS', 'S', 'A', 'B', 'C', 'D']).toContain(p.offenseTier);
      expect(['SS', 'S', 'A', 'B', 'C', 'D']).toContain(p.defenseTier);
    }
  });

  it('skips incomplete players', () => {
    const players = [{ ...PLAYER_OFFENSIVE }, { ...PLAYER_INCOMPLETE }];
    const result = recalculateAllWeighted(players);
    const incomplete = result.find(p => p.id === PLAYER_INCOMPLETE.id)!;
    expect(incomplete.offenseScore).toBe(0);
    expect(incomplete.defenseScore).toBe(0);
  });

  it('produces same result as recalculateAll when weights are default', () => {
    const players = [{ ...PLAYER_OFFENSIVE }, { ...PLAYER_DEFENSIVE }];
    const weighted = recalculateAllWeighted(players, null, null, DEFAULT_TROOP_WEIGHTS, DEFAULT_TROOP_WEIGHTS);
    const normal = recalculateAll(players, null, null);
    for (let i = 0; i < players.length; i++) {
      expect(weighted[i]!.offenseScore).toBeCloseTo(normal[i]!.offenseScore, 2);
      expect(weighted[i]!.defenseScore).toBeCloseTo(normal[i]!.defenseScore, 2);
    }
  });

  it('produces different scores with custom weights', () => {
    const players = [{ ...PLAYER_OFFENSIVE }];
    const defaultResult = recalculateAllWeighted(players, null, null, DEFAULT_TROOP_WEIGHTS, DEFAULT_TROOP_WEIGHTS);
    const customResult = recalculateAllWeighted(players, null, null, CUSTOM_WEIGHTS, CUSTOM_WEIGHTS);
    expect(customResult[0]!.offenseScore).not.toBeCloseTo(defaultResult[0]!.offenseScore, 0);
    expect(customResult[0]!.defenseScore).not.toBeCloseTo(defaultResult[0]!.defenseScore, 0);
  });

  it('respects tier overrides', () => {
    const players = [{ ...PLAYER_OFFENSIVE }, { ...PLAYER_NO_EG }];
    const overrides = { SS: 100000, S: 99999, A: 99998, B: 99997, C: 99996 };
    const result = recalculateAllWeighted(players, overrides, overrides);
    // With impossibly high cutoffs, all players should be D tier
    for (const p of result) {
      expect(p.offenseTier).toBe('D');
      expect(p.defenseTier).toBe('D');
    }
  });
});

// ============================================================================
// isPlayerComplete
// ============================================================================

describe('isPlayerComplete', () => {
  it('returns true for a fully-filled player', () => {
    expect(isPlayerComplete(PLAYER_OFFENSIVE)).toBe(true);
  });

  it('returns false when a hero is missing', () => {
    expect(isPlayerComplete(PLAYER_INCOMPLETE)).toBe(false);
  });

  it('returns false when a stat is 0', () => {
    const p = { ...PLAYER_OFFENSIVE, archerHealth: 0 };
    expect(isPlayerComplete(p)).toBe(false);
  });
});
