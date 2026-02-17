import { KingdomData, KingdomFund, MatchDetail, formatTCLevel } from '../components/KingdomListingCard';

interface TransferProfile {
  power_million: number;
  tc_level: number;
  main_language: string;
  secondary_languages: string[];
  looking_for: string[];
  kvk_availability: string;
  saving_for_kvk: string;
  group_size: string;
  player_bio: string;
  play_schedule: unknown[];
  contact_method: string;
  visible_to_recruiters: boolean;
}

// ─── Weights ──────────────────────────────────────────────────
// Smart Matching v2: weighted factors with partial scoring
const WEIGHTS = {
  power: 0.30,
  tcLevel: 0.25,
  language: 0.25,
  vibe: 0.20,
} as const;

/**
 * Calculate a 0-1 partial score for power requirement.
 * Full match = 1.0, within 80% of requirement = partial credit.
 */
function scorePower(playerPower: number, minPower: number): number {
  if (minPower <= 0) return -1; // not applicable
  if (playerPower >= minPower) return 1.0;
  const ratio = playerPower / minPower;
  if (ratio >= 0.8) return 0.5 + (ratio - 0.8) * 2.5; // 0.5-1.0 for 80-100%
  return ratio * 0.5; // 0-0.5 below 80%
}

/**
 * Calculate a 0-1 partial score for TC level requirement.
 * Exact match or above = 1.0, within 2 levels = partial credit.
 */
function scoreTCLevel(playerTC: number, minTC: number): number {
  if (!minTC || minTC <= 0) return -1; // not applicable
  if (playerTC >= minTC) return 1.0;
  const diff = minTC - playerTC;
  if (diff <= 2) return 0.7;
  if (diff <= 5) return 0.3;
  return 0;
}

/**
 * Calculate a 0-1 score for language match.
 * Primary match = 1.0, secondary match = 0.6, no match = 0.
 */
function scoreLanguage(
  playerMain: string,
  playerSecondary: string[],
  fundMain: string | null,
  fundSecondary: string[]
): number {
  if (!fundMain) return -1; // not applicable
  if (fundMain === playerMain) return 1.0;
  if (fundSecondary.includes(playerMain)) return 0.8;
  if (playerSecondary.includes(fundMain)) return 0.6;
  // Check secondary-to-secondary overlap
  if (playerSecondary.some(l => fundSecondary.includes(l))) return 0.3;
  return 0;
}

/**
 * Calculate a 0-1 score for vibe/culture overlap.
 * Score scales with overlap ratio.
 */
function scoreVibe(playerLookingFor: string[], kingdomVibe: string[]): number {
  if (!kingdomVibe || kingdomVibe.length === 0 || playerLookingFor.length === 0) return -1;
  const overlap = playerLookingFor.filter(v => kingdomVibe.includes(v));
  if (overlap.length === 0) return 0;
  // More overlap = better score, but even 1 shared is decent
  const maxPossible = Math.min(playerLookingFor.length, kingdomVibe.length);
  return Math.min(1.0, 0.5 + (overlap.length / maxPossible) * 0.5);
}

/**
 * Lightweight match score for sorting (no details array allocation).
 * Returns 0-100 integer.
 */
export function calculateMatchScoreForSort(
  _kingdom: KingdomData,
  fund: KingdomFund | null,
  transferProfile: TransferProfile | null
): number {
  if (!transferProfile || !fund) return 0;

  const minPower = fund.min_power_million || (fund.min_power_range ? parseInt(fund.min_power_range, 10) || 0 : 0);
  const pScore = scorePower(transferProfile.power_million, minPower);
  const tScore = scoreTCLevel(transferProfile.tc_level, fund.min_tc_level || 0);
  const lScore = scoreLanguage(transferProfile.main_language, transferProfile.secondary_languages || [], fund.main_language, fund.secondary_languages || []);
  const vScore = scoreVibe(transferProfile.looking_for, fund.kingdom_vibe || []);

  // Collect applicable factors and their weights
  let totalWeight = 0;
  let weightedSum = 0;
  if (pScore >= 0) { totalWeight += WEIGHTS.power; weightedSum += pScore * WEIGHTS.power; }
  if (tScore >= 0) { totalWeight += WEIGHTS.tcLevel; weightedSum += tScore * WEIGHTS.tcLevel; }
  if (lScore >= 0) { totalWeight += WEIGHTS.language; weightedSum += lScore * WEIGHTS.language; }
  if (vScore >= 0) { totalWeight += WEIGHTS.vibe; weightedSum += vScore * WEIGHTS.vibe; }

  if (totalWeight === 0) {
    // No matching criteria — use recruiting status as soft signal
    return fund.is_recruiting ? 25 : 0;
  }

  return Math.round((weightedSum / totalWeight) * 100);
}

/**
 * Full match score calculation with detailed breakdown.
 * Returns score (0-100) and array of match details with weighted scoring.
 */
export function calculateMatchScore(
  _kingdom: KingdomData,
  fund: KingdomFund | null,
  transferProfile: TransferProfile | null
): { score: number; details: MatchDetail[] } {
  if (!transferProfile || !fund) return { score: 0, details: [] };

  const details: MatchDetail[] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  // 1. Power (30%)
  const minPower = fund.min_power_million || (fund.min_power_range ? parseInt(fund.min_power_range, 10) || 0 : 0);
  const pScore = scorePower(transferProfile.power_million, minPower);
  if (pScore >= 0) {
    totalWeight += WEIGHTS.power;
    weightedSum += pScore * WEIGHTS.power;
    const pPct = Math.round(pScore * 100);
    details.push({
      label: `Power (${Math.round(WEIGHTS.power * 100)}%)`,
      matched: pScore >= 0.7,
      detail: pScore >= 1.0
        ? `${transferProfile.power_million}M ≥ ${minPower}M required`
        : `${transferProfile.power_million}M vs ${minPower}M required (${pPct}% fit)`,
    });
  }

  // 2. TC Level (25%)
  const tScore = scoreTCLevel(transferProfile.tc_level, fund.min_tc_level || 0);
  if (tScore >= 0) {
    totalWeight += WEIGHTS.tcLevel;
    weightedSum += tScore * WEIGHTS.tcLevel;
    details.push({
      label: `TC Level (${Math.round(WEIGHTS.tcLevel * 100)}%)`,
      matched: tScore >= 0.7,
      detail: tScore >= 1.0
        ? `${formatTCLevel(transferProfile.tc_level)} ≥ ${formatTCLevel(fund.min_tc_level!)} required`
        : `${formatTCLevel(transferProfile.tc_level)} vs ${formatTCLevel(fund.min_tc_level!)} required (${Math.round(tScore * 100)}% fit)`,
    });
  }

  // 3. Language (25%)
  const lScore = scoreLanguage(transferProfile.main_language, transferProfile.secondary_languages || [], fund.main_language, fund.secondary_languages || []);
  if (lScore >= 0) {
    totalWeight += WEIGHTS.language;
    weightedSum += lScore * WEIGHTS.language;
    const langDetail = lScore >= 1.0 ? `${transferProfile.main_language} — primary match`
      : lScore >= 0.6 ? `${transferProfile.main_language} — secondary match`
      : lScore > 0 ? `Partial language overlap`
      : `${transferProfile.main_language} ≠ ${fund.main_language}`;
    details.push({ label: `Language (${Math.round(WEIGHTS.language * 100)}%)`, matched: lScore >= 0.6, detail: langDetail });
  }

  // 4. Kingdom Vibe (20%)
  const vScore = scoreVibe(transferProfile.looking_for, fund.kingdom_vibe || []);
  if (vScore >= 0) {
    totalWeight += WEIGHTS.vibe;
    weightedSum += vScore * WEIGHTS.vibe;
    const overlap = transferProfile.looking_for.filter(v => (fund.kingdom_vibe || []).includes(v));
    details.push({
      label: `Vibe Match (${Math.round(WEIGHTS.vibe * 100)}%)`,
      matched: vScore >= 0.5,
      detail: overlap.length > 0 ? `${overlap.length} shared: ${overlap.join(', ')}` : 'No overlapping vibes',
    });
  }

  if (totalWeight === 0) {
    // Fallback when no criteria apply
    const fbDetails: MatchDetail[] = [];
    if (fund.is_recruiting) {
      fbDetails.push({ label: 'Recruiting', matched: true, detail: 'Kingdom is actively recruiting' });
      return { score: 25, details: fbDetails };
    }
    return { score: 0, details: [] };
  }

  const score = Math.round((weightedSum / totalWeight) * 100);
  return { score, details };
}
