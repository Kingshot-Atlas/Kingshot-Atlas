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
 * KvK Schedule: Every 4 weeks
 * - Prep Phase: Monday 00:00 UTC to Saturday 10:00 UTC
 * - Battle Phase: Saturday 10:00 UTC to Saturday 22:00 UTC
 * - Reference: KvK #10 started Monday, January 26, 2026 at 00:00 UTC
 */
export const KVK_CONFIG = {
  /** Current KvK number - UPDATE THIS AFTER EACH KVK */
  CURRENT_KVK: 10,
  /** Reference date for KvK #10 (used for calculations) */
  KVK_10_START: '2026-01-26T00:00:00Z',
  /** Days between KvK cycles */
  CYCLE_DAYS: 28,
  /** Total known kingdoms in the game */
  TOTAL_KINGDOMS: 1621,
} as const;

// Convenience export for direct import
export const CURRENT_KVK = KVK_CONFIG.CURRENT_KVK;
