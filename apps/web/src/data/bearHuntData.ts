/**
 * Bear Hunt — Hero & Exclusive Gear Data
 * 
 * Game Context:
 * - Each hero has an Exclusive Gear (EG) with levels 0–10.
 * - EG bonuses are either offensive or defensive.
 * - Offensive bonuses activate when rallying (e.g., Bear Hunt rally).
 * - Defensive bonuses activate when being attacked or scouted.
 * - When scouting a player, defensive EG bonuses inflate the displayed stats.
 *   To get accurate rally stats, we must: remove defensive EG bonuses → then apply offensive EG bonuses.
 * 
 * EG Bonus Table:
 *   Level 0  = 0%      Level 5  = 7.5%    Level 10 = 15%
 *   Level 1  = 0%      Level 6  = 10%
 *   Level 2  = 5%      Level 7  = 10%
 *   Level 3  = 5%      Level 8  = 12.5%
 *   Level 4  = 7.5%    Level 9  = 12.5%
 */

// ─── Exclusive Gear Bonus by Level ──────────────────────────────────────────

export const EG_BONUS_BY_LEVEL: Record<number, number> = {
  0: 0,
  1: 0,
  2: 5,
  3: 5,
  4: 7.5,
  5: 7.5,
  6: 10,
  7: 10,
  8: 12.5,
  9: 12.5,
  10: 15,
};

// ─── Troop Types ────────────────────────────────────────────────────────────

export type TroopType = 'infantry' | 'cavalry' | 'archer';

// ─── Exclusive Gear Bonus Types ─────────────────────────────────────────────

export type EGBonusDirection = 'offensive' | 'defensive';
export type EGBonusStat = 'attack' | 'lethality' | 'defense' | 'health';

export interface HeroData {
  name: string;
  troopType: TroopType;
  egDirection: EGBonusDirection;
  egStat: EGBonusStat;
}

// ─── Troop Colors (consistent with Battle Registry / Roster) ────────────────

export const BEAR_TROOP_COLORS: Record<TroopType, string> = {
  infantry: '#3b82f6',
  cavalry:  '#f97316',
  archer:   '#ef4444',
};

// ─── Hero Database ──────────────────────────────────────────────────────────
// To add a new hero, simply add a new entry to the appropriate troop array.
// The hero will automatically appear in the form dropdowns.

const INFANTRY_HEROES: HeroData[] = [
  { name: 'Helga',    troopType: 'infantry', egDirection: 'offensive',  egStat: 'lethality' },
  { name: 'Amadeus',  troopType: 'infantry', egDirection: 'offensive',  egStat: 'attack' },
  { name: 'Zoe',      troopType: 'infantry', egDirection: 'defensive',  egStat: 'attack' },
  { name: 'Eric',     troopType: 'infantry', egDirection: 'defensive',  egStat: 'defense' },
  { name: 'Alcar',    troopType: 'infantry', egDirection: 'defensive',  egStat: 'health' },
  { name: 'Long Fei', troopType: 'infantry', egDirection: 'defensive',  egStat: 'attack' },
  { name: 'Triton',   troopType: 'infantry', egDirection: 'defensive',  egStat: 'defense' },
];

const CAVALRY_HEROES: HeroData[] = [
  { name: 'Jabel',    troopType: 'cavalry',  egDirection: 'defensive',  egStat: 'lethality' },
  { name: 'Hilde',    troopType: 'cavalry',  egDirection: 'defensive',  egStat: 'health' },
  { name: 'Petra',    troopType: 'cavalry',  egDirection: 'offensive',  egStat: 'attack' },
  { name: 'Margot',   troopType: 'cavalry',  egDirection: 'defensive',  egStat: 'lethality' },
  { name: 'Thrud',    troopType: 'cavalry',  egDirection: 'offensive',  egStat: 'lethality' },
];

const ARCHER_HEROES: HeroData[] = [
  { name: 'Saul',     troopType: 'archer',   egDirection: 'defensive',  egStat: 'attack' },
  { name: 'Marlin',   troopType: 'archer',   egDirection: 'offensive',  egStat: 'lethality' },
  { name: 'Jaeger',   troopType: 'archer',   egDirection: 'defensive',  egStat: 'health' },
  { name: 'Rosa',     troopType: 'archer',   egDirection: 'offensive',  egStat: 'lethality' },
  { name: 'Vivian',   troopType: 'archer',   egDirection: 'defensive',  egStat: 'defense' },
  { name: 'Yang',     troopType: 'archer',   egDirection: 'offensive',  egStat: 'lethality' },
];

// Combined lookup (built automatically from the arrays above)
export const ALL_HEROES: HeroData[] = [...INFANTRY_HEROES, ...CAVALRY_HEROES, ...ARCHER_HEROES];

// ─── Helper: Get heroes by troop type ───────────────────────────────────────

export const getHeroesByTroopType = (troopType: TroopType): HeroData[] => {
  switch (troopType) {
    case 'infantry': return INFANTRY_HEROES;
    case 'cavalry':  return CAVALRY_HEROES;
    case 'archer':   return ARCHER_HEROES;
  }
};

export const getHeroByName = (name: string): HeroData | undefined =>
  ALL_HEROES.find(h => h.name === name);

// ─── Tier System ────────────────────────────────────────────────────────────

export type BearTier = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

export const BEAR_TIER_COLORS: Record<BearTier, string> = {
  SS: '#22d3ee', // Cyan
  S:  '#22c55e', // Green
  A:  '#eab308', // Yellow
  B:  '#fb923c', // Light orange
  C:  '#f97316', // Darker orange
  D:  '#ef4444', // Red
};

// ─── Player Entry Interface ─────────────────────────────────────────────────

export interface BearPlayerEntry {
  id: string;
  playerName: string;
  // Infantry hero
  infantryHero: string;
  infantryEGLevel: number;
  infantryAttack: number;
  infantryLethality: number;
  // Cavalry hero
  cavalryHero: string;
  cavalryEGLevel: number;
  cavalryAttack: number;
  cavalryLethality: number;
  // Archer hero
  archerHero: string;
  archerEGLevel: number;
  archerAttack: number;
  archerLethality: number;
  // Computed
  bearScore: number;
  tier: BearTier;
}

// ─── Adjusted Stats Calculator ──────────────────────────────────────────────

/**
 * Adjusts scouted troop bonuses for accurate rally stats:
 * 1. If the hero's EG is defensive AND the stat matches (e.g., defensive attack on Zoe),
 *    subtract the EG bonus from the scouted value to get the raw stat.
 * 2. If the hero's EG is offensive AND the stat matches (e.g., offensive lethality on Helga),
 *    add the EG bonus to the raw stat for rally damage.
 * 
 * Stats that don't match the hero's EG stat are returned as-is.
 */
export function getAdjustedStats(
  heroName: string,
  egLevel: number,
  scoutedAttack: number,
  scoutedLethality: number
): { adjustedAttack: number; adjustedLethality: number } {
  const hero = getHeroByName(heroName);
  if (!hero) return { adjustedAttack: scoutedAttack, adjustedLethality: scoutedLethality };

  const egBonus = EG_BONUS_BY_LEVEL[egLevel] ?? 0;

  let adjustedAttack = scoutedAttack;
  let adjustedLethality = scoutedLethality;

  if (hero.egDirection === 'defensive') {
    // Defensive EG inflates scouted stats — remove the bonus
    if (hero.egStat === 'attack') {
      adjustedAttack = scoutedAttack - egBonus;
    } else if (hero.egStat === 'lethality') {
      adjustedLethality = scoutedLethality - egBonus;
    }
    // defense/health EG don't affect attack/lethality, so no adjustment
  } else if (hero.egDirection === 'offensive') {
    // Offensive EG is NOT shown in scouted stats — add it for rally
    if (hero.egStat === 'attack') {
      adjustedAttack = scoutedAttack + egBonus;
    } else if (hero.egStat === 'lethality') {
      adjustedLethality = scoutedLethality + egBonus;
    }
  }

  return { adjustedAttack, adjustedLethality };
}

// ─── Bear Score Calculator (Placeholder) ────────────────────────────────────

/**
 * Calculates the Bear Score for a player.
 * 
 * PLACEHOLDER: The user will provide the exact formula.
 * Current implementation: sum of all adjusted attack + lethality values.
 */
export function calculateBearScore(
  infantryHero: string, infantryEG: number, infAtk: number, infLeth: number,
  cavalryHero: string, cavalryEG: number, cavAtk: number, cavLeth: number,
  archerHero: string, archerEG: number, archAtk: number, archLeth: number,
): number {
  const inf = getAdjustedStats(infantryHero, infantryEG, infAtk, infLeth);
  const cav = getAdjustedStats(cavalryHero, cavalryEG, cavAtk, cavLeth);
  const arch = getAdjustedStats(archerHero, archerEG, archAtk, archLeth);

  // PLACEHOLDER FORMULA — sum of all adjusted stats
  const score =
    inf.adjustedAttack + inf.adjustedLethality +
    cav.adjustedAttack + cav.adjustedLethality +
    arch.adjustedAttack + arch.adjustedLethality;

  return Math.round(score * 100) / 100;
}

// ─── Tier Assignment (Percentile-based) ─────────────────────────────────────

/**
 * Assigns tiers using percentile-based ranking with strategic cutoffs.
 * With < 6 players, falls back to simpler distribution.
 * 
 * Distribution:
 *   SS = top 5%   — Elite hitters, your rally leads
 *   S  = next 15% — Strong hitters, solid rally fillers
 *   A  = next 25% — Above average, dependable
 *   B  = next 25% — Average, adequate backup
 *   C  = next 20% — Below average, last resort
 *   D  = bottom 10% — Weakest, bench
 *
 * Ties at cutoff boundaries share the higher tier.
 */
export function assignBearTier(score: number, allScores: number[]): BearTier {
  if (allScores.length === 0) return 'D';
  if (allScores.length === 1) return 'SS';

  // Sort descending to compute percentile rank
  const sorted = [...allScores].sort((a, b) => b - a);
  // Percentile = % of players this score is >= (higher = better)
  const rank = sorted.filter(s => score >= s).length;
  const percentile = (rank / sorted.length) * 100;

  // Strategic cutoffs
  if (percentile >= 95) return 'SS'; // top 5%
  if (percentile >= 80) return 'S';  // next 15%
  if (percentile >= 55) return 'A';  // next 25%
  if (percentile >= 30) return 'B';  // next 25%
  if (percentile >= 10) return 'C';  // next 20%
  return 'D';                        // bottom 10%
}

/** Single-score fallback (used when recalculating without full list) */
export function assignBearTierSingle(score: number): BearTier {
  if (score >= 2000) return 'SS';
  if (score >= 1600) return 'S';
  if (score >= 1200) return 'A';
  if (score >= 800) return 'B';
  if (score >= 400) return 'C';
  return 'D';
}

// ─── LocalStorage Key ───────────────────────────────────────────────────────

export const BEAR_STORAGE_KEY = 'kingshot_bear_rally_tier_list';

// ─── Disclaimer ─────────────────────────────────────────────────────────────

export const BEAR_DISCLAIMER_KEY = 'bearRally.disclaimer';
export const BEAR_DISCLAIMER_DEFAULT = 'This tool is a guide only. Bear Scores are based on troop bonuses and Exclusive Gear adjustments — hero skills and talent trees are not factored in. Use this as a starting point, not the final word.';
