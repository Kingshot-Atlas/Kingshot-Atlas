// localStorage keys - single source of truth
export const STORAGE_KEYS = {
  FAVORITES: 'kingshot_favorites',
  RECENTLY_VIEWED: 'kingshot_recently_viewed',
  COMPARE_HISTORY: 'kingshot_compare_history',
  TABLE_COLUMNS: 'kingshot_table_columns',
  KINGDOM_CACHE: 'kingshot_kingdom_cache',
  WATCHLIST: 'kingshot_watchlist',
  REVIEWS: 'kingshot_kingdom_reviews',
  NEWS_FEED: 'kingshot_news_feed',
  ACHIEVEMENTS: 'kingshot_achievements',
  AUTH_USER: 'kingshot_user',
  AUTH_PROFILE: 'kingshot_profile',
  THEME: 'kingshot_theme',
} as const;

// API configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
} as const;

// UI configuration
export const UI_CONFIG = {
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  CARDS_PER_PAGE: 20,
  MAX_COMPARE_KINGDOMS: 4,
  DEBOUNCE_MS: 300,
} as const;

// Color palette
export const COLORS = {
  // Background colors
  BG_PRIMARY: '#0a0a0a',
  BG_SECONDARY: '#111116',
  BG_TERTIARY: '#1a1a1f',
  
  // Border colors
  BORDER_DEFAULT: '#2a2a2a',
  BORDER_HOVER: '#3a3a3a',
  
  // Accent colors
  CYAN: '#22d3ee',
  YELLOW: '#fbbf24',
  ORANGE: '#f97316',
  GREEN: '#22c55e',
  BLUE: '#3b82f6',
  PURPLE: '#a855f7',
  RED: '#ef4444',
  GRAY: '#6b7280',
  
  // Status colors
  STATUS_LEADING: '#fbbf24',
  STATUS_ORDINARY: '#9ca3af',
  STATUS_UNANNOUNCED: '#ef4444',
} as const;

// Animation durations
export const ANIMATIONS = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

/**
 * KvK Configuration - SINGLE SOURCE OF TRUTH
 * Update CURRENT_KVK after each KvK battle phase ends
 * 
 * KvK Schedule: Every 28 days (4 weeks)
 * Reference: KvK #10 Prep Phase started Monday, January 26, 2026 at 00:00 UTC
 *
 * Cycle pattern (relative to Prep Phase start = Day 0):
 *   Day -1, 00:00 UTC  = Matchups announced → "Add Matchup" unlocks
 *   Day  0, 00:00 UTC  = Prep Phase begins
 *   Day  5, 10:00 UTC  = Prep Phase ends → "Add Prep Result" unlocks
 *   Day  5, 10:00 UTC  = Battle Phase begins
 *   Day  5, 12:00 UTC  = Castle Battle begins
 *   Day  5, 18:00 UTC  = Castle Battle ends → "Add Battle Result" unlocks
 *   Day  5, 22:00 UTC  = Battle Phase ends
 *   Day 12, 22:00 UTC  = Submission buttons lock (7 days after Battle Phase ends)
 *   Day 28             = Next KvK cycle begins
 */
export const KVK_CONFIG = {
  /** Current KvK number - UPDATE THIS AFTER EACH KVK */
  CURRENT_KVK: 11,
  /** Reference date for KvK #10 prep start (used for all schedule calculations) */
  KVK_10_START: '2026-01-26T00:00:00Z',
  /** Days between KvK cycles */
  CYCLE_DAYS: 28,
  /** Total known kingdoms in the game */
  TOTAL_KINGDOMS: 1699,
  /**
   * Highest kingdom number that participated in CURRENT_KVK.
   * Kingdoms above this number with no KvK history are treated as "too new"
   * and excluded from missing-data checks.
   * UPDATE THIS AFTER EACH KVK alongside CURRENT_KVK.
   */
  HIGHEST_KINGDOM_IN_KVK: 1304,
} as const;

// Convenience exports for direct import
export const CURRENT_KVK = KVK_CONFIG.CURRENT_KVK;
export const HIGHEST_KINGDOM_IN_KVK = KVK_CONFIG.HIGHEST_KINGDOM_IN_KVK;

/**
 * KvK Schedule for any KvK number, auto-computed from the reference date.
 * All dates are in UTC.
 */
export interface KvKScheduleDates {
  kvkNumber: number;
  matchupsAnnounced: Date;  // Day -1, 00:00 UTC
  prepStart: Date;          // Day 0, 00:00 UTC
  prepEnd: Date;            // Day 5, 10:00 UTC
  battleStart: Date;        // Day 5, 10:00 UTC
  castleBattleStart: Date;  // Day 5, 12:00 UTC
  castleBattleEnd: Date;    // Day 5, 18:00 UTC
  battleEnd: Date;          // Day 5, 22:00 UTC
  buttonsLock: Date;        // Day 12, 22:00 UTC (7 days after battle end)
}

export function getKvKSchedule(kvkNumber: number): KvKScheduleDates {
  const ref = new Date(KVK_CONFIG.KVK_10_START);
  const offsetDays = (kvkNumber - 10) * KVK_CONFIG.CYCLE_DAYS;

  const addDaysHours = (baseDays: number, hours: number): Date => {
    const d = new Date(ref);
    d.setUTCDate(d.getUTCDate() + offsetDays + baseDays);
    d.setUTCHours(hours, 0, 0, 0);
    return d;
  };

  return {
    kvkNumber,
    matchupsAnnounced: addDaysHours(-1, 0),
    prepStart:         addDaysHours(0, 0),
    prepEnd:           addDaysHours(5, 10),
    battleStart:       addDaysHours(5, 10),
    castleBattleStart: addDaysHours(5, 12),
    castleBattleEnd:   addDaysHours(5, 18),
    battleEnd:         addDaysHours(5, 22),
    buttonsLock:       addDaysHours(12, 22),
  };
}

export type LockReason = 'not_announced' | 'prep_not_ended' | 'battle_not_ended' | 'closed' | '';

export interface ButtonState {
  unlocked: boolean;
  reasonKey: LockReason;
  unlocksAt: Date | null;
}

export interface KvKButtonStates {
  matchup: ButtonState;
  prep:    ButtonState;
  battle:  ButtonState;
}

export function getKvKButtonStates(kvkNumber: number, now: Date = new Date()): KvKButtonStates {
  const s = getKvKSchedule(kvkNumber);
  const nowMs = now.getTime();

  const matchupUnlocked = nowMs >= s.matchupsAnnounced.getTime() && nowMs < s.buttonsLock.getTime();
  const prepUnlocked = nowMs >= s.prepEnd.getTime() && nowMs < s.buttonsLock.getTime();
  const battleUnlocked = nowMs >= s.castleBattleEnd.getTime() && nowMs < s.buttonsLock.getTime();

  return {
    matchup: {
      unlocked: matchupUnlocked,
      reasonKey: nowMs < s.matchupsAnnounced.getTime() ? 'not_announced' : nowMs >= s.buttonsLock.getTime() ? 'closed' : '',
      unlocksAt: nowMs < s.matchupsAnnounced.getTime() ? s.matchupsAnnounced : null,
    },
    prep: {
      unlocked: prepUnlocked,
      reasonKey: nowMs < s.prepEnd.getTime() ? 'prep_not_ended' : nowMs >= s.buttonsLock.getTime() ? 'closed' : '',
      unlocksAt: nowMs < s.prepEnd.getTime() ? s.prepEnd : null,
    },
    battle: {
      unlocked: battleUnlocked,
      reasonKey: nowMs < s.castleBattleEnd.getTime() ? 'battle_not_ended' : nowMs >= s.buttonsLock.getTime() ? 'closed' : '',
      unlocksAt: nowMs < s.castleBattleEnd.getTime() ? s.castleBattleEnd : null,
    },
  };
}
