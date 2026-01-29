export interface Kingdom {
  kingdom_number: number;
  total_kvks: number;
  prep_wins: number;
  prep_losses: number;
  prep_win_rate: number;
  prep_streak: number;
  prep_loss_streak?: number;
  prep_best_streak?: number;
  battle_wins: number;
  battle_losses: number;
  battle_win_rate: number;
  battle_streak: number;
  battle_loss_streak?: number;
  battle_best_streak?: number;
  dominations: number;
  defeats: number;
  most_recent_status: string;
  overall_score: number;
  rank?: number;
  last_updated: string;
  recent_kvks?: KVKRecord[];
  high_kings?: number;  // deprecated, use dominations
  invader_kings?: number;  // deprecated, use defeats
  power_tier?: 'S' | 'A' | 'B' | 'C' | 'D';
  avg_rating?: number;
  review_count?: number;
}

export interface KVKRecord {
  id: number;
  kingdom_number: number;
  kvk_number: number;
  opponent_kingdom: number;
  prep_result: string;
  battle_result: string;
  overall_result: string;
  date_or_order_index: string;
  created_at: string;
}

export interface KingdomProfile extends Kingdom {
  recent_kvks: KVKRecord[];
}

export interface FilterOptions {
  status?: string;
  minKvKs?: number;
  maxKvKs?: number;
  minPrepWinRate?: number;
  minBattleWinRate?: number;
  tier?: string;
  minAtlasScore?: number;
}

export interface SortOptions {
  sortBy: 'overall_score' | 'overall_rank' | 'kingdom_number' | 'prep_win_rate' | 'battle_win_rate' | 'total_kvks';
  order: 'asc' | 'desc';
}

// Power Tier system using percentiles
// S: Top 10%
// A: Top 25% (10-25th percentile)
// B: Top 50% (25-50th percentile)
// C: Top 75% (50-75th percentile)
// D: Bottom 25% (below 75th percentile)
export type PowerTier = 'S' | 'A' | 'B' | 'C' | 'D';

// Score-based thresholds aligned with percentiles
// Based on data distribution: scores roughly 0-15 range
export const POWER_TIER_THRESHOLDS = {
  S: 10,   // Top 10%: Score 10+
  A: 7,    // Top 25%: Score 7-9.9
  B: 4.5,  // Top 50%: Score 4.5-6.9
  C: 2.5,  // Top 75%: Score 2.5-4.4
  D: 0,    // Bottom 25%: Score below 2.5
} as const;

export const getPowerTier = (score: number): PowerTier => {
  if (score >= POWER_TIER_THRESHOLDS.S) return 'S';
  if (score >= POWER_TIER_THRESHOLDS.A) return 'A';
  if (score >= POWER_TIER_THRESHOLDS.B) return 'B';
  if (score >= POWER_TIER_THRESHOLDS.C) return 'C';
  return 'D';
};

export const TIER_COLORS: Record<PowerTier, string> = {
  S: '#fbbf24',  // Gold
  A: '#22c55e',  // Green
  B: '#3b82f6',  // Blue
  C: '#f97316',  // Orange
  D: '#ef4444',  // Red
};

export const TIER_DESCRIPTIONS: Record<PowerTier, string> = {
  S: 'Elite (Top 10%)',
  A: 'Strong (Top 25%)',
  B: 'Average (Top 50%)',
  C: 'Below Average (Top 75%)',
  D: 'Developing (Bottom 25%)',
};

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  home_kingdom: number | null;
  alliance_tag: string;
  language: string;
  region: string;
  bio: string;
  theme_color: string;
  badge_style: string;
  created_at: string;
  linked_player_id?: string;
  linked_username?: string;
  linked_avatar_url?: string | null;
  linked_kingdom?: number;
  linked_tc_level?: number;
}

// Raw JSON data types for type safety
export interface RawKingdomData {
  kingdom_number: number;
  total_kvks: number;
  prep_wins: number;
  prep_losses: number;
  prep_win_rate: number;
  prep_streak: number;
  prep_loss_streak?: number;
  prep_best_streak?: number;
  battle_wins: number;
  battle_losses: number;
  battle_win_rate: number;
  battle_streak: number;
  battle_loss_streak?: number;
  battle_best_streak?: number;
  dominations: number;
  defeats: number;
  most_recent_status: string;
  overall_score: number;
}

export interface RawKvKRecord {
  kingdom_number: number;
  kvk_number: number;
  opponent_kingdom: number;
  prep_result: string;
  battle_result: string;
  overall_result: string;
  date_or_order_index: string;
}

export interface KingdomDataFile {
  kingdoms: RawKingdomData[];
  kvk_records: RawKvKRecord[];
}

// Leaderboard stat types
export interface KingdomWithStats extends Kingdom {
  prepStreak: number;
  battleStreak: number;
  dominations: number;
  defeats: number;
  reversals: number;
  comebacks: number;
}
