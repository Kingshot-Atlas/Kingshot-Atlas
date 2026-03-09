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
  2: 0.05,
  3: 0.05,
  4: 0.075,
  5: 0.075,
  6: 0.10,
  7: 0.10,
  8: 0.125,
  9: 0.125,
  10: 0.15,
};

/** Display-friendly EG bonus (e.g. "5%") */
export const getEGBonusDisplay = (level: number): number => (EG_BONUS_BY_LEVEL[level] ?? 0) * 100;

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

// ─── Player Completeness Check ───────────────────────────────────────────────

/** A player is "complete" (rankable) when all 3 hero names, gear levels, and all 6 stat values are filled. */
export function isPlayerComplete(player: BearPlayerEntry): boolean {
  return !!(
    player.infantryHero && player.cavalryHero && player.archerHero &&
    player.infantryEGLevel >= 0 && player.cavalryEGLevel >= 0 && player.archerEGLevel >= 0 &&
    player.infantryAttack > 0 && player.infantryLethality > 0 &&
    player.cavalryAttack > 0 && player.cavalryLethality > 0 &&
    player.archerAttack > 0 && player.archerLethality > 0
  );
}

// ─── Base City Defense Bonus ─────────────────────────────────────────────────
// When scouting a player at their Guard Station, a universal 10% defensive
// attack bonus inflates all displayed attack percentages.

const BASE_DEFENSIVE_ATTACK_BONUS = 0.10;

// ─── Adjusted Stats Calculator ──────────────────────────────────────────────

/**
 * Computes fully adjusted stats from scouted values across ALL three hero slots.
 *
 * Two-phase adjustment:
 *   Phase 1 — Remove defensive inflation from scout:
 *     - ALL scouted attack values include a base 10% city defense bonus.
 *     - Heroes with defensive attack/lethality EG further inflate displayed stats.
 *     - Removal formula: adjusted = (scouted - totalBonus * 100) / (1 + totalBonus)
 *
 *   Phase 2 — Apply offensive EG bonuses (active during rally):
 *     - Heroes with offensive attack/lethality EG contribute bonuses.
 *     - Offensive bonuses from ALL heroes stack and apply to ALL troop types.
 *     - Application formula (multiplicative + additive): adjusted = stat * (1 + bonus) + bonus * 100
 *
 * This function is DATA-DRIVEN: adding new heroes to the hero arrays above
 * automatically incorporates them — no hardcoded name checks.
 */
export function getAdjustedStats(
  heroes: Array<{ name: string; egLevel: number }>,
  scoutedAttack: number,
  scoutedLethality: number,
): { adjustedAttack: number; adjustedLethality: number } {
  // Accumulate EG bonuses across all hero slots
  let totalDefAtkBonus = 0;
  let totalDefLethBonus = 0;
  let totalOffAtkBonus = 0;
  let totalOffLethBonus = 0;

  for (const { name, egLevel } of heroes) {
    const hero = getHeroByName(name);
    if (!hero) continue;
    const egBonus = EG_BONUS_BY_LEVEL[egLevel] ?? 0;
    if (hero.egDirection === 'defensive') {
      if (hero.egStat === 'attack') totalDefAtkBonus += egBonus;
      else if (hero.egStat === 'lethality') totalDefLethBonus += egBonus;
      // defense/health EG don't affect attack/lethality → no adjustment
    } else if (hero.egDirection === 'offensive') {
      if (hero.egStat === 'attack') totalOffAtkBonus += egBonus;
      else if (hero.egStat === 'lethality') totalOffLethBonus += egBonus;
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

  // Phase 2: Apply offensive EG bonuses (multiplicative + additive)
  if (totalOffAtkBonus > 0) {
    adjustedAttack = adjustedAttack * (1 + totalOffAtkBonus) + totalOffAtkBonus * 100;
  }
  if (totalOffLethBonus > 0) {
    adjustedLethality = adjustedLethality * (1 + totalOffLethBonus) + totalOffLethBonus * 100;
  }

  return { adjustedAttack, adjustedLethality };
}

/**
 * Compute all 6 display stats (fully adjusted) for a player entry.
 * Used by the tier list table to show final stats after EG adjustments.
 */
export function getPlayerDisplayStats(player: BearPlayerEntry): {
  infAtk: number; infLeth: number;
  cavAtk: number; cavLeth: number;
  arcAtk: number; arcLeth: number;
} {
  const heroSlots = [
    { name: player.infantryHero, egLevel: player.infantryEGLevel },
    { name: player.cavalryHero, egLevel: player.cavalryEGLevel },
    { name: player.archerHero, egLevel: player.archerEGLevel },
  ];
  const inf = getAdjustedStats(heroSlots, player.infantryAttack, player.infantryLethality);
  const cav = getAdjustedStats(heroSlots, player.cavalryAttack, player.cavalryLethality);
  const arc = getAdjustedStats(heroSlots, player.archerAttack, player.archerLethality);
  return {
    infAtk: Math.round(inf.adjustedAttack * 10) / 10,
    infLeth: Math.round(inf.adjustedLethality * 10) / 10,
    cavAtk: Math.round(cav.adjustedAttack * 10) / 10,
    cavLeth: Math.round(cav.adjustedLethality * 10) / 10,
    arcAtk: Math.round(arc.adjustedAttack * 10) / 10,
    arcLeth: Math.round(arc.adjustedLethality * 10) / 10,
  };
}

// ─── Bear Score Calculator ──────────────────────────────────────────────────

/**
 * Calculates the Bear Score for a player.
 *
 * Weights: Infantry ATK/Leth × 0.01, Cavalry ATK/Leth × 0.09, Archer ATK/Leth × 0.9
 * Amadeus multiplier: 1.1× fixed boost (hero skills are exceptional for bear rally).
 */
export function calculateBearScore(
  infantryHero: string, infantryEG: number, infAtk: number, infLeth: number,
  cavalryHero: string, cavalryEG: number, cavAtk: number, cavLeth: number,
  archerHero: string, archerEG: number, archAtk: number, archLeth: number,
): number {
  const heroSlots = [
    { name: infantryHero, egLevel: infantryEG },
    { name: cavalryHero, egLevel: cavalryEG },
    { name: archerHero, egLevel: archerEG },
  ];

  // Get adjusted stats for each troop type (cross-hero stacking)
  const inf = getAdjustedStats(heroSlots, infAtk, infLeth);
  const cav = getAdjustedStats(heroSlots, cavAtk, cavLeth);
  const arch = getAdjustedStats(heroSlots, archAtk, archLeth);

  // Weighted sum: archers are the primary damage dealers in bear rally
  const rawScore =
    inf.adjustedAttack * 0.01 + inf.adjustedLethality * 0.01 +
    cav.adjustedAttack * 0.09 + cav.adjustedLethality * 0.09 +
    arch.adjustedAttack * 0.9 + arch.adjustedLethality * 0.9;

  // Amadeus fixed 1.1× multiplier (exceptional offensive hero skills)
  const amadeusMultiplier = infantryHero === 'Amadeus' ? 1.1 : 1;

  return Math.round(rawScore * amadeusMultiplier * 100) / 100;
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
  if (score >= 2100) return 'SS';
  if (score >= 1900) return 'S';
  if (score >= 1700) return 'A';
  if (score >= 1500) return 'B';
  if (score >= 1300) return 'C';
  return 'D';
}

// ─── Score Recalculation (apply current formula to stored data) ──────────────

/**
 * Recalculates bearScore and tier for every player using the current formula.
 * Call this whenever loading players from storage/cloud to ensure scores
 * reflect the latest weight configuration.
 */
export function recalculateAllScores(players: BearPlayerEntry[]): BearPlayerEntry[] {
  if (players.length === 0) return players;

  // First pass: recalculate raw scores
  const withScores = players.map(p => {
    if (!isPlayerComplete(p)) return p; // skip incomplete players
    const newScore = calculateBearScore(
      p.infantryHero, p.infantryEGLevel, p.infantryAttack, p.infantryLethality,
      p.cavalryHero, p.cavalryEGLevel, p.cavalryAttack, p.cavalryLethality,
      p.archerHero, p.archerEGLevel, p.archerAttack, p.archerLethality,
    );
    return { ...p, bearScore: newScore };
  });

  // Second pass: reassign tiers based on recalculated scores
  const completePlayers = withScores.filter(isPlayerComplete);
  const allScores = completePlayers.map(p => p.bearScore);
  return withScores.map(p => {
    if (!isPlayerComplete(p)) return p;
    return { ...p, tier: assignBearTier(p.bearScore, allScores) };
  });
}

// ─── Multi-List Storage ─────────────────────────────────────────────────────

/** Master index key — stores the list of saved tier list metadata */
export const BEAR_LISTS_INDEX_KEY = 'kingshot_bear_rally_lists_index';

/** Prefix for individual list data keys */
export const BEAR_LIST_DATA_PREFIX = 'kingshot_bear_rally_list_';

/** Legacy key (single-list era) — migrated on first load */
export const BEAR_STORAGE_KEY_LEGACY = 'kingshot_bear_rally_tier_list';

/** Active list selection key */
export const BEAR_ACTIVE_LIST_KEY = 'kingshot_bear_rally_active_list';

export interface BearListMeta {
  id: string;
  name: string;
  createdAt: string;   // ISO date
  playerCount: number;
}

/** Returns a default list name based on current month */
export function getDefaultListName(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── Client-Side Validation ─────────────────────────────────────────────────

const VALID_TIERS: readonly string[] = ['SS', 'S', 'A', 'B', 'C', 'D'];
const MAX_PLAYERS_PER_LIST = 200;

/** Validates an array of BearPlayerEntry objects before Supabase save.
 *  Returns null if valid, or an error message string if invalid. */
export function validateBearPlayers(players: unknown): string | null {
  if (!Array.isArray(players)) return 'players must be an array';
  if (players.length > MAX_PLAYERS_PER_LIST) return `Too many players (max ${MAX_PLAYERS_PER_LIST})`;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p || typeof p !== 'object') return `Player #${i + 1} is not an object`;
    const entry = p as Record<string, unknown>;

    // Required string fields
    if (typeof entry.id !== 'string' || !entry.id) return `Player #${i + 1} missing id`;
    if (typeof entry.playerName !== 'string') return `Player #${i + 1} missing playerName`;

    // Required numeric fields
    const numFields = [
      'infantryEGLevel', 'cavalryEGLevel', 'archerEGLevel',
      'infantryAttack', 'infantryLethality',
      'cavalryAttack', 'cavalryLethality',
      'archerAttack', 'archerLethality',
      'bearScore',
    ] as const;
    for (const f of numFields) {
      if (typeof entry[f] !== 'number' || isNaN(entry[f] as number)) {
        return `Player #${i + 1} (${entry.playerName}) has invalid ${f}`;
      }
    }

    // EG levels 0-10
    for (const eg of ['infantryEGLevel', 'cavalryEGLevel', 'archerEGLevel'] as const) {
      const v = entry[eg] as number;
      if (v < 0 || v > 10) return `Player #${i + 1} (${entry.playerName}) has ${eg} out of range (0-10)`;
    }

    // Stats non-negative
    for (const s of ['infantryAttack', 'infantryLethality', 'cavalryAttack', 'cavalryLethality', 'archerAttack', 'archerLethality', 'bearScore'] as const) {
      if ((entry[s] as number) < 0) return `Player #${i + 1} (${entry.playerName}) has negative ${s}`;
    }

    // Tier validation
    if (entry.tier !== undefined && !VALID_TIERS.includes(entry.tier as string)) {
      return `Player #${i + 1} (${entry.playerName}) has invalid tier "${entry.tier}"`;
    }
  }
  return null;
}

// ─── Disclaimer ─────────────────────────────────────────────────────────────

export const BEAR_DISCLAIMER_KEY = 'bearRally.disclaimer';
export const BEAR_DISCLAIMER_DEFAULT = 'This tool is a guide only. Bear Scores are based on troop bonuses and Exclusive Gear adjustments — hero skills and talent trees are not factored in. Use this as a starting point, not the final word.';
