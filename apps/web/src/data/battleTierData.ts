/**
 * KvK Battle Tier List — Data Layer
 *
 * Extends the Bear Rally EG adjustment engine to compute two separate scores:
 *   1. Offense Score — Remove defensive EG inflation, apply offensive EG bonuses, sum ALL stats
 *   2. Defense Score — Use raw scouted values as-is (scout report = exact defensive stats), sum ALL stats
 *
 * Reuses hero database, EG bonus table, and tier assignment algorithm from bearHuntData.ts.
 */

import {
  EG_BONUS_BY_LEVEL,
  ALL_HEROES,
  getHeroByName,
  getHeroesByTroopType,
  computeTierBoundaries,
  type TroopType,
  type HeroData,
  type BearTier,
  type BearTierOverrides,
} from './bearHuntData';

// Re-export shared types/data for convenience
export { EG_BONUS_BY_LEVEL, ALL_HEROES, getHeroByName, getHeroesByTroopType, getEGBonusDisplay } from './bearHuntData';
export type { TroopType, HeroData, EGBonusDirection, EGBonusStat } from './bearHuntData';

// ─── Tier System (reuse Bear tiers) ─────────────────────────────────────────

export type BattleTier = BearTier;
export type BattleTierOverrides = BearTierOverrides;

export const BATTLE_TIER_COLORS: Record<BattleTier, string> = {
  SS: '#22d3ee',
  S:  '#22c55e',
  A:  '#eab308',
  B:  '#fb923c',
  C:  '#f97316',
  D:  '#ef4444',
};

// ─── Player Entry Interface ─────────────────────────────────────────────────

export interface BattlePlayerEntry {
  id: string;
  playerName: string;
  // Infantry
  infantryHero: string;
  infantryEGLevel: number;
  infantryAttack: number;
  infantryLethality: number;
  infantryDefense: number;
  infantryHealth: number;
  // Cavalry
  cavalryHero: string;
  cavalryEGLevel: number;
  cavalryAttack: number;
  cavalryLethality: number;
  cavalryDefense: number;
  cavalryHealth: number;
  // Archer
  archerHero: string;
  archerEGLevel: number;
  archerAttack: number;
  archerLethality: number;
  archerDefense: number;
  archerHealth: number;
  // Computed
  offenseScore: number;
  defenseScore: number;
  offenseTier: BattleTier;
  defenseTier: BattleTier;
}

// ─── Completeness Check ─────────────────────────────────────────────────────

export function isPlayerComplete(player: BattlePlayerEntry): boolean {
  return !!(
    player.infantryHero && player.cavalryHero && player.archerHero &&
    player.infantryEGLevel >= 0 && player.cavalryEGLevel >= 0 && player.archerEGLevel >= 0 &&
    player.infantryAttack > 0 && player.infantryLethality > 0 &&
    player.infantryDefense > 0 && player.infantryHealth > 0 &&
    player.cavalryAttack > 0 && player.cavalryLethality > 0 &&
    player.cavalryDefense > 0 && player.cavalryHealth > 0 &&
    player.archerAttack > 0 && player.archerLethality > 0 &&
    player.archerDefense > 0 && player.archerHealth > 0
  );
}

// ─── Base City Defense Bonus ────────────────────────────────────────────────
// When scouting at Guard Station, a universal 10% defensive attack bonus inflates displayed attack %.

const BASE_DEFENSIVE_ATTACK_BONUS = 0.10;

// ─── Offensive Stat Adjustment ──────────────────────────────────────────────

/**
 * Computes fully adjusted OFFENSIVE stats from scouted values.
 *
 * Phase 1 — Remove defensive inflation (scout shows inflated values):
 *   - Base 10% city defense bonus applies to attack
 *   - Heroes with defensive EG inflate the corresponding stat
 *   - Removal: adjusted = (scouted - totalBonus * 100) / (1 + totalBonus)
 *
 * Phase 2 — Apply offensive EG bonuses (active during KvK rallies):
 *   - Heroes with offensive EG contribute bonuses
 *   - Application: adjusted = stat * (1 + bonus) + bonus * 100
 *
 * Returns all 4 adjusted stats: attack, lethality, defense, health
 */
export function getOffensiveAdjustedStats(
  heroes: Array<{ name: string; egLevel: number }>,
  scoutedAttack: number,
  scoutedLethality: number,
  scoutedDefense: number,
  scoutedHealth: number,
): { attack: number; lethality: number; defense: number; health: number } {
  let totalDefAtkBonus = 0;
  let totalDefLethBonus = 0;
  let totalDefDefBonus = 0;
  let totalDefHpBonus = 0;
  let totalOffAtkBonus = 0;
  let totalOffLethBonus = 0;

  for (const { name, egLevel } of heroes) {
    const hero = getHeroByName(name);
    if (!hero) continue;
    const egBonus = EG_BONUS_BY_LEVEL[egLevel] ?? 0;
    if (hero.egDirection === 'defensive') {
      if (hero.egStat === 'attack') totalDefAtkBonus += egBonus;
      else if (hero.egStat === 'lethality') totalDefLethBonus += egBonus;
      else if (hero.egStat === 'defense') totalDefDefBonus += egBonus;
      else if (hero.egStat === 'health') totalDefHpBonus += egBonus;
    } else if (hero.egDirection === 'offensive') {
      if (hero.egStat === 'attack') totalOffAtkBonus += egBonus;
      else if (hero.egStat === 'lethality') totalOffLethBonus += egBonus;
      // No offensive EG for defense/health in current hero data
    }
  }

  // Phase 1: Remove defensive inflation
  const atkDivisor = 1 + BASE_DEFENSIVE_ATTACK_BONUS + totalDefAtkBonus;
  let adjustedAttack = (scoutedAttack - (BASE_DEFENSIVE_ATTACK_BONUS + totalDefAtkBonus) * 100) / atkDivisor;

  let adjustedLethality = scoutedLethality;
  if (totalDefLethBonus > 0) {
    const lethDivisor = 1 + totalDefLethBonus;
    adjustedLethality = (scoutedLethality - totalDefLethBonus * 100) / lethDivisor;
  }

  let adjustedDefense = scoutedDefense;
  if (totalDefDefBonus > 0) {
    const defDivisor = 1 + totalDefDefBonus;
    adjustedDefense = (scoutedDefense - totalDefDefBonus * 100) / defDivisor;
  }

  let adjustedHealth = scoutedHealth;
  if (totalDefHpBonus > 0) {
    const hpDivisor = 1 + totalDefHpBonus;
    adjustedHealth = (scoutedHealth - totalDefHpBonus * 100) / hpDivisor;
  }

  // Phase 2: Apply offensive EG bonuses
  if (totalOffAtkBonus > 0) {
    adjustedAttack = adjustedAttack * (1 + totalOffAtkBonus) + totalOffAtkBonus * 100;
  }
  if (totalOffLethBonus > 0) {
    adjustedLethality = adjustedLethality * (1 + totalOffLethBonus) + totalOffLethBonus * 100;
  }

  return {
    attack: Math.round(adjustedAttack * 10) / 10,
    lethality: Math.round(adjustedLethality * 10) / 10,
    defense: Math.round(adjustedDefense * 10) / 10,
    health: Math.round(adjustedHealth * 10) / 10,
  };
}

// ─── Score Calculators ──────────────────────────────────────────────────────

/**
 * Calculates the Offense Score: sum of all adjusted offensive stats across 3 troop types.
 * No weights applied (equal contribution).
 */
export function calculateOffenseScore(player: {
  infantryHero: string; infantryEGLevel: number;
  infantryAttack: number; infantryLethality: number; infantryDefense: number; infantryHealth: number;
  cavalryHero: string; cavalryEGLevel: number;
  cavalryAttack: number; cavalryLethality: number; cavalryDefense: number; cavalryHealth: number;
  archerHero: string; archerEGLevel: number;
  archerAttack: number; archerLethality: number; archerDefense: number; archerHealth: number;
}): number {
  const heroSlots = [
    { name: player.infantryHero, egLevel: player.infantryEGLevel },
    { name: player.cavalryHero, egLevel: player.cavalryEGLevel },
    { name: player.archerHero, egLevel: player.archerEGLevel },
  ];

  const inf = getOffensiveAdjustedStats(heroSlots, player.infantryAttack, player.infantryLethality, player.infantryDefense, player.infantryHealth);
  const cav = getOffensiveAdjustedStats(heroSlots, player.cavalryAttack, player.cavalryLethality, player.cavalryDefense, player.cavalryHealth);
  const arc = getOffensiveAdjustedStats(heroSlots, player.archerAttack, player.archerLethality, player.archerDefense, player.archerHealth);

  const total =
    inf.attack + inf.lethality + inf.defense + inf.health +
    cav.attack + cav.lethality + cav.defense + cav.health +
    arc.attack + arc.lethality + arc.defense + arc.health;

  return Math.round(total * 100) / 100;
}

/**
 * Calculates the Defense Score: sum of all RAW scouted stats (no adjustment needed).
 * The scout report shows exact defensive values.
 */
export function calculateDefenseScore(player: {
  infantryAttack: number; infantryLethality: number; infantryDefense: number; infantryHealth: number;
  cavalryAttack: number; cavalryLethality: number; cavalryDefense: number; cavalryHealth: number;
  archerAttack: number; archerLethality: number; archerDefense: number; archerHealth: number;
}): number {
  const total =
    player.infantryAttack + player.infantryLethality + player.infantryDefense + player.infantryHealth +
    player.cavalryAttack + player.cavalryLethality + player.cavalryDefense + player.cavalryHealth +
    player.archerAttack + player.archerLethality + player.archerDefense + player.archerHealth;

  return Math.round(total * 100) / 100;
}

// ─── Full Display Stats ─────────────────────────────────────────────────────

export interface TroopDisplayStats {
  attack: number; lethality: number; defense: number; health: number;
}

export function getPlayerOffensiveDisplayStats(player: BattlePlayerEntry): {
  infantry: TroopDisplayStats; cavalry: TroopDisplayStats; archer: TroopDisplayStats;
} {
  const heroSlots = [
    { name: player.infantryHero, egLevel: player.infantryEGLevel },
    { name: player.cavalryHero, egLevel: player.cavalryEGLevel },
    { name: player.archerHero, egLevel: player.archerEGLevel },
  ];
  return {
    infantry: getOffensiveAdjustedStats(heroSlots, player.infantryAttack, player.infantryLethality, player.infantryDefense, player.infantryHealth),
    cavalry: getOffensiveAdjustedStats(heroSlots, player.cavalryAttack, player.cavalryLethality, player.cavalryDefense, player.cavalryHealth),
    archer: getOffensiveAdjustedStats(heroSlots, player.archerAttack, player.archerLethality, player.archerDefense, player.archerHealth),
  };
}

export function getPlayerDefensiveDisplayStats(player: BattlePlayerEntry): {
  infantry: TroopDisplayStats; cavalry: TroopDisplayStats; archer: TroopDisplayStats;
} {
  return {
    infantry: { attack: player.infantryAttack, lethality: player.infantryLethality, defense: player.infantryDefense, health: player.infantryHealth },
    cavalry: { attack: player.cavalryAttack, lethality: player.cavalryLethality, defense: player.cavalryDefense, health: player.cavalryHealth },
    archer: { attack: player.archerAttack, lethality: player.archerLethality, defense: player.archerDefense, health: player.archerHealth },
  };
}

// ─── Tier Assignment (reuse natural-breaks from bearHuntData) ────────────────

const TIERS: BattleTier[] = ['SS', 'S', 'A', 'B', 'C', 'D'];

export function assignTier(score: number, allScores: number[], overrides?: BattleTierOverrides | null): BattleTier {
  if (allScores.length === 0) return 'D';
  if (allScores.length === 1) return 'SS';

  if (overrides) {
    if (score >= overrides.SS) return 'SS';
    if (score >= overrides.S) return 'S';
    if (score >= overrides.A) return 'A';
    if (score >= overrides.B) return 'B';
    if (score >= overrides.C) return 'C';
    return 'D';
  }

  const boundaries = computeTierBoundaries(allScores);
  for (let i = 0; i < boundaries.length; i++) {
    const tier = TIERS[i];
    const boundary = boundaries[i];
    if (tier !== undefined && boundary !== undefined && score >= boundary) return tier;
  }
  return 'D';
}

// ─── Recalculate All ────────────────────────────────────────────────────────

export function recalculateAll(
  players: BattlePlayerEntry[],
  offOverrides?: BattleTierOverrides | null,
  defOverrides?: BattleTierOverrides | null,
): BattlePlayerEntry[] {
  if (players.length === 0) return players;

  // Recalculate scores
  const withScores = players.map(p => {
    if (!isPlayerComplete(p)) return p;
    return {
      ...p,
      offenseScore: calculateOffenseScore(p),
      defenseScore: calculateDefenseScore(p),
    };
  });

  // Reassign tiers
  const complete = withScores.filter(isPlayerComplete);
  const offScores = complete.map(p => p.offenseScore);
  const defScores = complete.map(p => p.defenseScore);

  return withScores.map(p => {
    if (!isPlayerComplete(p)) return p;
    return {
      ...p,
      offenseTier: assignTier(p.offenseScore, offScores, offOverrides),
      defenseTier: assignTier(p.defenseScore, defScores, defOverrides),
    };
  });
}

// ─── Formula Version ────────────────────────────────────────────────────────

export const BATTLE_TIER_FORMULA_VERSION = 1;

// ─── Validation ─────────────────────────────────────────────────────────────

const VALID_TIERS: readonly string[] = ['SS', 'S', 'A', 'B', 'C', 'D'];
const MAX_PLAYERS = 200;

export function validateBattlePlayers(players: unknown): string | null {
  if (!Array.isArray(players)) return 'players must be an array';
  if (players.length > MAX_PLAYERS) return `Too many players (max ${MAX_PLAYERS})`;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p || typeof p !== 'object') return `Player #${i + 1} is not an object`;
    const e = p as Record<string, unknown>;

    if (typeof e.id !== 'string' || !e.id) return `Player #${i + 1} missing id`;
    if (typeof e.playerName !== 'string') return `Player #${i + 1} missing playerName`;

    const numFields = [
      'infantryEGLevel', 'cavalryEGLevel', 'archerEGLevel',
      'infantryAttack', 'infantryLethality', 'infantryDefense', 'infantryHealth',
      'cavalryAttack', 'cavalryLethality', 'cavalryDefense', 'cavalryHealth',
      'archerAttack', 'archerLethality', 'archerDefense', 'archerHealth',
      'offenseScore', 'defenseScore',
    ] as const;
    for (const f of numFields) {
      if (typeof e[f] !== 'number' || isNaN(e[f] as number)) {
        return `Player #${i + 1} (${e.playerName}) has invalid ${f}`;
      }
    }

    for (const eg of ['infantryEGLevel', 'cavalryEGLevel', 'archerEGLevel'] as const) {
      const v = e[eg] as number;
      if (v < 0 || v > 10) return `Player #${i + 1} has ${eg} out of range (0-10)`;
    }

    if (e.offenseTier !== undefined && !VALID_TIERS.includes(e.offenseTier as string)) {
      return `Player #${i + 1} has invalid offenseTier`;
    }
    if (e.defenseTier !== undefined && !VALID_TIERS.includes(e.defenseTier as string)) {
      return `Player #${i + 1} has invalid defenseTier`;
    }
  }
  return null;
}

// ─── Stat Weights ────────────────────────────────────────────────────────

export interface BattleStatWeights {
  attack: number;
  lethality: number;
  defense: number;
  health: number;
}

export interface BattleTroopWeights {
  infantry: BattleStatWeights;
  cavalry: BattleStatWeights;
  archer: BattleStatWeights;
}

const DEFAULT_STAT: BattleStatWeights = { attack: 1, lethality: 1, defense: 1, health: 1 };

export const DEFAULT_WEIGHTS: BattleStatWeights = { ...DEFAULT_STAT };

export const DEFAULT_TROOP_WEIGHTS: BattleTroopWeights = {
  infantry: { ...DEFAULT_STAT },
  cavalry: { ...DEFAULT_STAT },
  archer: { ...DEFAULT_STAT },
};

export function isTroopWeightsDefault(w: BattleTroopWeights): boolean {
  return (['infantry', 'cavalry', 'archer'] as const).every(t =>
    w[t].attack === 1 && w[t].lethality === 1 && w[t].defense === 1 && w[t].health === 1
  );
}

/**
 * Calculates Offense Score with per-troop-type stat weights.
 * Each troop type's stats are weighted independently.
 */
export function calculateWeightedOffenseScore(player: Parameters<typeof calculateOffenseScore>[0], weights: BattleTroopWeights = DEFAULT_TROOP_WEIGHTS): number {
  const heroSlots = [
    { name: player.infantryHero, egLevel: player.infantryEGLevel },
    { name: player.cavalryHero, egLevel: player.cavalryEGLevel },
    { name: player.archerHero, egLevel: player.archerEGLevel },
  ];
  const inf = getOffensiveAdjustedStats(heroSlots, player.infantryAttack, player.infantryLethality, player.infantryDefense, player.infantryHealth);
  const cav = getOffensiveAdjustedStats(heroSlots, player.cavalryAttack, player.cavalryLethality, player.cavalryDefense, player.cavalryHealth);
  const arc = getOffensiveAdjustedStats(heroSlots, player.archerAttack, player.archerLethality, player.archerDefense, player.archerHealth);

  const total =
    inf.attack * weights.infantry.attack + inf.lethality * weights.infantry.lethality + inf.defense * weights.infantry.defense + inf.health * weights.infantry.health +
    cav.attack * weights.cavalry.attack + cav.lethality * weights.cavalry.lethality + cav.defense * weights.cavalry.defense + cav.health * weights.cavalry.health +
    arc.attack * weights.archer.attack + arc.lethality * weights.archer.lethality + arc.defense * weights.archer.defense + arc.health * weights.archer.health;

  return Math.round(total * 100) / 100;
}

/**
 * Calculates Defense Score with per-troop-type stat weights.
 */
export function calculateWeightedDefenseScore(player: Parameters<typeof calculateDefenseScore>[0], weights: BattleTroopWeights = DEFAULT_TROOP_WEIGHTS): number {
  const total =
    player.infantryAttack * weights.infantry.attack + player.infantryLethality * weights.infantry.lethality + player.infantryDefense * weights.infantry.defense + player.infantryHealth * weights.infantry.health +
    player.cavalryAttack * weights.cavalry.attack + player.cavalryLethality * weights.cavalry.lethality + player.cavalryDefense * weights.cavalry.defense + player.cavalryHealth * weights.cavalry.health +
    player.archerAttack * weights.archer.attack + player.archerLethality * weights.archer.lethality + player.archerDefense * weights.archer.defense + player.archerHealth * weights.archer.health;

  return Math.round(total * 100) / 100;
}

/**
 * Recalculate all players with custom stat weights.
 */
export function recalculateAllWeighted(
  players: BattlePlayerEntry[],
  offOverrides?: BattleTierOverrides | null,
  defOverrides?: BattleTierOverrides | null,
  offWeights: BattleTroopWeights = DEFAULT_TROOP_WEIGHTS,
  defWeights: BattleTroopWeights = DEFAULT_TROOP_WEIGHTS,
): BattlePlayerEntry[] {
  if (players.length === 0) return players;

  const useWeighted = !isTroopWeightsDefault(offWeights) || !isTroopWeightsDefault(defWeights);

  const withScores = players.map(p => {
    if (!isPlayerComplete(p)) return p;
    return {
      ...p,
      offenseScore: useWeighted ? calculateWeightedOffenseScore(p, offWeights) : calculateOffenseScore(p),
      defenseScore: useWeighted ? calculateWeightedDefenseScore(p, defWeights) : calculateDefenseScore(p),
    };
  });

  const complete = withScores.filter(isPlayerComplete);
  const offScores = complete.map(p => p.offenseScore);
  const defScores = complete.map(p => p.defenseScore);

  return withScores.map(p => {
    if (!isPlayerComplete(p)) return p;
    return {
      ...p,
      offenseTier: assignTier(p.offenseScore, offScores, offOverrides),
      defenseTier: assignTier(p.defenseScore, defScores, defOverrides),
    };
  });
}

// ─── Storage Keys (local cache) ─────────────────────────────────────────────

export const BATTLE_TIER_ACTIVE_LIST_KEY = 'kingshot_battle_tier_active_list';

// ─── Troop Colors ───────────────────────────────────────────────────────────

export const TROOP_COLORS: Record<TroopType, string> = {
  infantry: '#3b82f6',
  cavalry:  '#f97316',
  archer:   '#ef4444',
};

// ─── Stat Labels ────────────────────────────────────────────────────────────

export const STAT_LABELS = ['attack', 'lethality', 'defense', 'health'] as const;
export type StatLabel = typeof STAT_LABELS[number];
