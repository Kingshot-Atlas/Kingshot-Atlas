// =============================================
// TYPES (shared with TransferBoard)
// =============================================

export interface KingdomData {
  kingdom_number: number;
  atlas_score: number;
  current_rank: number;
  total_kvks: number;
  prep_wins: number;
  prep_losses: number;
  prep_win_rate: number;
  battle_wins: number;
  battle_losses: number;
  battle_win_rate: number;
  dominations: number;
  comebacks: number;
  reversals: number;
  invasions: number;
  most_recent_status: string | null;
}

export interface KingdomFund {
  kingdom_number: number;
  balance: number;
  tier: 'standard' | 'bronze' | 'silver' | 'gold';
  is_recruiting: boolean;
  recruitment_tags: string[];
  contact_link: string | null;
  min_tc_level: number | null;
  min_power_range: string | null;
  min_power_million: number | null;
  recruitment_pitch: string | null;
  main_language: string | null;
  secondary_languages: string[];
  event_times: Array<{ start: string; end: string }>;
  what_we_offer: string | null;
  what_we_want: string | null;
  highlighted_stats: string[];
  banner_theme: string;
  alliance_events: {
    alliances: string[];
    schedule: Record<string, string[][]>;
  } | null;
  kingdom_vibe: string[];
  nap_policy: boolean | null;
  sanctuary_distribution: boolean | null;
  castle_rotation: boolean | null;
  alliance_details: Record<string, { language?: string; secondary_language?: string; spots?: number }> | null;
  updated_at?: string | null;
}

export interface KingdomReviewSummary {
  kingdom_number: number;
  avg_rating: number;
  review_count: number;
  top_review_comment: string | null;
  top_review_author: string | null;
}

export interface MatchDetail {
  label: string;
  matched: boolean;
  detail: string;
}

export type BoardMode = 'transferring' | 'recruiting' | 'browsing';

// =============================================
// CONSTANTS
// =============================================

export const formatTCLevel = (tcLevel: number): string => {
  if (tcLevel <= 0) return '—';
  if (tcLevel <= 30) return `TC${tcLevel}`;
  if (tcLevel <= 34) return 'TC30';
  const tgLevel = Math.floor((tcLevel - 35) / 5) + 1;
  return `TG${tgLevel}`;
};
