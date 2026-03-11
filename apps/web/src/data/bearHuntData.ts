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
  { name: 'Sophia',   troopType: 'cavalry',  egDirection: 'defensive',  egStat: 'lethality' },
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

/** Optional manual tier score cutoffs set by alliance managers */
export interface BearTierOverrides {
  SS: number;
  S: number;
  A: number;
  B: number;
  C: number;
}

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

// ─── Tier Assignment (Natural Breaks + Hybrid Caps) ─────────────────────────

const TIERS: BearTier[] = ['SS', 'S', 'A', 'B', 'C', 'D'];

/**
 * Assigns tiers using a natural-breaks algorithm that finds the largest gaps
 * between consecutive scores, placing tier boundaries where players are most
 * separated. This ensures players within a tier are similar in strength and
 * different tiers represent meaningful power differences.
 *
 * Hybrid caps prevent extreme distributions:
 *   - SS: 2–15% of roster (at least 1 player, at most ~15%)
 *   - S:  5–25%
 *   - A:  10–30%
 *   - B:  10–30%
 *   - C:  5–25%
 *   - D:  2–15%
 *
 * With < 6 players, each player gets a unique tier top-down.
 */
export function assignBearTier(score: number, allScores: number[], overrides?: BearTierOverrides | null): BearTier {
  if (allScores.length === 0) return 'D';
  if (allScores.length === 1) return 'SS';

  // Manual overrides take precedence
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

/**
 * Computes the score threshold for each tier using natural breaks.
 * Returns an array of 6 minimum-score boundaries: [SS_min, S_min, A_min, B_min, C_min, D_min].
 * A player with score >= boundary[i] belongs to TIERS[i].
 *
 * Algorithm:
 * 1. Sort scores descending and compute gaps between consecutive scores
 * 2. Take the top 15 largest gaps as candidates
 * 3. Try all C(15,5) = 3003 combinations to find the one that maximises
 *    total gap while keeping each tier within min/max player-count caps
 * 4. If no valid combination exists, fall back to percentile-based cutoffs
 */
export function computeTierBoundaries(allScores: number[]): number[] {
  const sorted = [...allScores].sort((a, b) => b - a); // descending
  const n = sorted.length;

  // Small rosters: one player per tier, top-down
  if (n <= 6) {
    const b = sorted.slice();
    while (b.length < 6) b.push(-Infinity);
    return b;
  }

  // ── Compute gaps between consecutive scores ──
  const gaps: { pos: number; gap: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    gaps.push({ pos: i, gap: (sorted[i] ?? 0) - (sorted[i + 1] ?? 0) });
  }

  // Take top 15 largest-gap positions as candidates
  const ranked = [...gaps].sort((a, b) => b.gap - a.gap);
  const K = Math.min(ranked.length, 15);
  const cands = ranked.slice(0, K);

  // Min/max players per tier (at least 1)
  const minPct = [0.02, 0.05, 0.10, 0.10, 0.05, 0.02]; // SS..D
  const maxPct = [0.20, 0.30, 0.30, 0.30, 0.25, 0.20];
  const minC = minPct.map(p => Math.max(1, Math.floor(p * n)));
  const maxC = maxPct.map(p => Math.max(2, Math.ceil(p * n)));

  // ── Search all C(K,5) combinations for best valid set ──
  let bestBreaks: number[] | null = null;
  let bestGapSum = -1;

  for (let a = 0; a < K - 4; a++) {
    for (let b = a + 1; b < K - 3; b++) {
      for (let c = b + 1; c < K - 2; c++) {
        for (let d = c + 1; d < K - 1; d++) {
          for (let e = d + 1; e < K; e++) {
            const positions = [
              cands[a]!.pos, cands[b]!.pos, cands[c]!.pos,
              cands[d]!.pos, cands[e]!.pos,
            ].sort((x, y) => x - y);

            if (tierSizesValid(positions, n, minC, maxC)) {
              const gapSum = cands[a]!.gap + cands[b]!.gap + cands[c]!.gap +
                             cands[d]!.gap + cands[e]!.gap;
              if (gapSum > bestGapSum) {
                bestGapSum = gapSum;
                bestBreaks = positions;
              }
            }
          }
        }
      }
    }
  }

  // ── Fallback: percentile-based cutoffs ──
  if (!bestBreaks) {
    const cumPct = [0.08, 0.22, 0.48, 0.72, 0.90];
    bestBreaks = cumPct.map(p => Math.min(Math.floor(p * n) - 1, n - 2));
  }

  // ── Build score boundaries ──
  const boundaries: number[] = [sorted[0] ?? 0];
  for (const pos of bestBreaks) {
    const val = sorted[pos + 1];
    if (val !== undefined) boundaries.push(val);
  }
  while (boundaries.length < 6) boundaries.push(-Infinity);
  return boundaries;
}

/** Checks that the 6 tier sizes produced by 5 break positions respect min/max caps */
function tierSizesValid(breaks: number[], n: number, minC: number[], maxC: number[]): boolean {
  let prev = -1;
  for (let i = 0; i < 5; i++) {
    const size = (breaks[i] ?? 0) - prev;
    if (size < (minC[i] ?? 1) || size > (maxC[i] ?? n)) return false;
    prev = breaks[i] ?? 0;
  }
  // Last tier (D)
  const lastSize = n - prev - 1;
  return lastSize >= (minC[5] ?? 1) && lastSize <= (maxC[5] ?? n);
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
 * Bump this version whenever the bear score formula weights change.
 * The UI compares stored version vs current to decide whether recalculation is needed.
 */
export const BEAR_FORMULA_VERSION = 3; // v1 = 10/10/80, v2 = 1/9/90, v3 = natural breaks + tier overrides
export const BEAR_FORMULA_VERSION_KEY = 'kingshot_bear_formula_version';

/**
 * Recalculates bearScore and tier for every player using the current formula.
 * Call this whenever loading players from storage/cloud to ensure scores
 * reflect the latest weight configuration.
 */
export function recalculateAllScores(players: BearPlayerEntry[], overrides?: BearTierOverrides | null): BearPlayerEntry[] {
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
    return { ...p, tier: assignBearTier(p.bearScore, allScores, overrides) };
  });
}

// ─── Multi-List Storage ─────────────────────────────────────────────────────

/**
 * Returns true if a recalculation is needed based on stored formula version.
 * After recalculating, call `markFormulaVersionCurrent()` to persist.
 */
export function needsRecalculation(): boolean {
  try {
    const stored = localStorage.getItem(BEAR_FORMULA_VERSION_KEY);
    return stored !== String(BEAR_FORMULA_VERSION);
  } catch { return true; }
}

/** Persist the current formula version to localStorage so future loads skip recalculation. */
export function markFormulaVersionCurrent(): void {
  try {
    localStorage.setItem(BEAR_FORMULA_VERSION_KEY, String(BEAR_FORMULA_VERSION));
  } catch { /* ignore */ }
}

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
export const BEAR_DISCLAIMER_DEFAULT = 'This tool is a guide only. Bear Scores are based on troop bonuses and Exclusive Gear adjustments — hero skills are not factored in. Use this as a starting point, not the final word.';
