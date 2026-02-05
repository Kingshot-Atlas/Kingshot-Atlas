/**
 * Shared Chart Constants
 * Used across ScoreHistoryChart, RankingHistoryChart, and TrendChart
 */

// Chart dimensions
export const CHART_WIDTH = 400;

// Unified padding for all charts
export const CHART_PADDING = {
  top: 30,
  right: 30,
  bottom: 55, // Space for X-axis labels + "KvKs" title
  left: 50
};

// Font sizes
export const CHART_FONTS = {
  axisLabel: 10,      // X and Y axis labels
  axisTitle: 11,      // "KvKs" title below X-axis
  tooltipTitle: 11,   // Desktop tooltip title
  tooltipBody: 10,    // Desktop tooltip body
  tooltipTitleMobile: 12,
  tooltipBodyMobile: 11
};

// Grid line count (creates evenly spaced lines)
export const Y_AXIS_GRID_COUNT = 5; // Creates 5 evenly spaced lines (0%, 25%, 50%, 75%, 100%)

// Colors
export const CHART_COLORS = {
  gridLine: '#2a2a2a',
  axisLabel: '#6b7280',
  axisTitle: '#9ca3af',
  background: '#1a1a20',
  border: '#2a2a2a',
  
  // Chart-specific accent colors
  scoreHistory: '#22d3ee',   // Cyan for Atlas Score
  rankingHistory: '#a855f7', // Purple for Ranking
  prepWinRate: '#eab308',    // Yellow for Prep
  battleWinRate: '#f97316',  // Orange for Battle
  
  // Trend indicators
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#6b7280'
};

// Data point sizes
export const POINT_SIZES = {
  desktop: {
    normal: 4,
    active: 6,
    hitArea: 8
  },
  mobile: {
    normal: 6,
    active: 8,
    hitArea: 16
  }
};

// X-axis label positioning
export const X_AXIS_LABEL_OFFSET = 18; // Distance from chart bottom to number labels
export const X_AXIS_TITLE_OFFSET = 38; // Distance from chart bottom to "KvKs" title
