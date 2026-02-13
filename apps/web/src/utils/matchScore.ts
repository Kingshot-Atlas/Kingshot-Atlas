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
  let matched = 0;
  let total = 0;
  const minPower = fund.min_power_million || (fund.min_power_range ? parseInt(fund.min_power_range, 10) || 0 : 0);
  if (minPower > 0) { total++; if (transferProfile.power_million >= minPower) matched++; }
  if (fund.min_tc_level && fund.min_tc_level > 0) { total++; if (transferProfile.tc_level >= fund.min_tc_level) matched++; }
  if (fund.main_language) { total++; if (fund.main_language === transferProfile.main_language || (fund.secondary_languages || []).includes(transferProfile.main_language) || fund.main_language === (transferProfile.secondary_languages?.[0] || '')) matched++; }
  if (fund.kingdom_vibe && fund.kingdom_vibe.length > 0 && transferProfile.looking_for.length > 0) { total++; if (transferProfile.looking_for.some(v => fund.kingdom_vibe.includes(v))) matched++; }
  if (total === 0) {
    // Fallback: soft heuristic when no explicit requirements set
    let fallback = 0, fallbackTotal = 0;
    if (fund.main_language) { fallbackTotal++; if (fund.main_language === transferProfile.main_language) fallback++; }
    if (fund.kingdom_vibe && fund.kingdom_vibe.length > 0 && transferProfile.looking_for.length > 0) {
      fallbackTotal++; if (transferProfile.looking_for.some(v => fund.kingdom_vibe.includes(v))) fallback++;
    }
    if (fund.is_recruiting) { fallbackTotal++; fallback++; }
    return fallbackTotal === 0 ? 0 : Math.round((fallback / fallbackTotal) * 100);
  }
  return Math.round((matched / total) * 100);
}

/**
 * Full match score calculation with detailed breakdown.
 * Returns score (0-100) and array of match details.
 */
export function calculateMatchScore(
  _kingdom: KingdomData,
  fund: KingdomFund | null,
  transferProfile: TransferProfile | null
): { score: number; details: MatchDetail[] } {
  if (!transferProfile || !fund) return { score: 0, details: [] };

  const details: MatchDetail[] = [];
  let matched = 0;
  let total = 0;

  // 1. Power check
  const minPower = fund.min_power_million || (fund.min_power_range ? parseInt(fund.min_power_range, 10) || 0 : 0);
  if (minPower > 0) {
    total++;
    const powerOk = transferProfile.power_million >= minPower;
    if (powerOk) matched++;
    details.push({ label: 'Power', matched: powerOk, detail: powerOk ? `${transferProfile.power_million}M ≥ ${minPower}M required` : `${transferProfile.power_million}M < ${minPower}M required` });
  }

  // 2. TC Level check
  if (fund.min_tc_level && fund.min_tc_level > 0) {
    total++;
    const tcOk = transferProfile.tc_level >= fund.min_tc_level;
    if (tcOk) matched++;
    details.push({ label: 'TC Level', matched: tcOk, detail: tcOk ? `${formatTCLevel(transferProfile.tc_level)} ≥ ${formatTCLevel(fund.min_tc_level)} required` : `${formatTCLevel(transferProfile.tc_level)} < ${formatTCLevel(fund.min_tc_level)} required` });
  }

  // 3. Language check
  if (fund.main_language) {
    total++;
    const langMatch = fund.main_language === transferProfile.main_language
      || (fund.secondary_languages || []).includes(transferProfile.main_language)
      || fund.main_language === (transferProfile.secondary_languages?.[0] || '');
    if (langMatch) matched++;
    details.push({ label: 'Language', matched: langMatch, detail: langMatch ? `${transferProfile.main_language} matches` : `${transferProfile.main_language} ≠ ${fund.main_language}` });
  }

  // 4. Kingdom Vibe / Looking For overlap
  if (fund.kingdom_vibe && fund.kingdom_vibe.length > 0 && transferProfile.looking_for.length > 0) {
    total++;
    const overlap = transferProfile.looking_for.filter(v => fund.kingdom_vibe.includes(v));
    const vibeMatch = overlap.length > 0;
    if (vibeMatch) matched++;
    details.push({ label: 'Vibe Match', matched: vibeMatch, detail: vibeMatch ? `${overlap.length} shared: ${overlap.join(', ')}` : 'No overlapping vibes' });
  }

  if (total === 0) {
    // Fallback heuristic when no explicit min requirements are set
    const fbDetails: MatchDetail[] = [];
    let fbMatched = 0, fbTotal = 0;
    if (fund.main_language) {
      fbTotal++;
      const langOk = fund.main_language === transferProfile.main_language
        || (fund.secondary_languages || []).includes(transferProfile.main_language);
      if (langOk) fbMatched++;
      fbDetails.push({ label: 'Language', matched: langOk, detail: langOk ? `${transferProfile.main_language} matches` : `${transferProfile.main_language} ≠ ${fund.main_language}` });
    }
    if (fund.kingdom_vibe && fund.kingdom_vibe.length > 0 && transferProfile.looking_for.length > 0) {
      fbTotal++;
      const overlap = transferProfile.looking_for.filter(v => fund.kingdom_vibe.includes(v));
      const vibeOk = overlap.length > 0;
      if (vibeOk) fbMatched++;
      fbDetails.push({ label: 'Vibe Match', matched: vibeOk, detail: vibeOk ? `${overlap.length} shared: ${overlap.join(', ')}` : 'No overlapping vibes' });
    }
    if (fund.is_recruiting) {
      fbTotal++; fbMatched++;
      fbDetails.push({ label: 'Recruiting', matched: true, detail: 'Kingdom is actively recruiting' });
    }
    if (fbTotal === 0) return { score: 0, details: [] };
    return { score: Math.round((fbMatched / fbTotal) * 100), details: fbDetails };
  }
  const score = Math.round((matched / total) * 100);
  return { score, details };
}
