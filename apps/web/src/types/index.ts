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
  reversals?: number;
  comebacks?: number;
  invasions: number;
  defeats?: number;  // deprecated, use invasions
  most_recent_status: string;
  overall_score: number;
  rank?: number;
  last_updated: string;
  score_updated_at?: string;  // When atlas_score was last calculated
  recent_kvks?: KVKRecord[];
  high_kings?: number;  // deprecated, use dominations
  invader_kings?: number;  // deprecated, use invasions
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

// Re-export Atlas Score formula types and functions from centralized module
// This ensures a single source of truth for all score calculations
export {
  type PowerTier,
  TIER_THRESHOLDS as POWER_TIER_THRESHOLDS,
  TIER_COLORS,
  TIER_PERCENTILES,
  getPowerTier,
  getTierColorFromScore,
  getTierDescription,
  calculateAtlasScore,
  calculateAtlasScoreSimple,
  extractStatsFromProfile,
  getScoreComponents,
  getKvKOutcome,
  KVK_OUTCOME_SCORES,
  SCORE_TOOLTIPS,
  type ScoreBreakdown,
  type ScoreComponents,
  type KingdomStats,
} from '../utils/atlasScoreFormula';

// Legacy tier descriptions for backward compatibility
export const TIER_DESCRIPTIONS: Record<'S' | 'A' | 'B' | 'C' | 'D', string> = {
  S: 'Elite (Top 3%)',
  A: 'Strong (Top 10%)',
  B: 'Above Average (Top 25%)',
  C: 'Average (Top 50%)',
  D: 'Below Average (Bottom 50%)',
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
  invasions?: number;
  defeats?: number;  // deprecated, use invasions
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
  invasions: number;
  reversals: number;
  comebacks: number;
}
