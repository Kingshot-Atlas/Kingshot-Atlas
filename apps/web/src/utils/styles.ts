import React from 'react';

/**
 * Shared style utilities for Kingshot Atlas
 * These utilities ensure consistent styling across all components
 */

/**
 * Display font family - Trajan Pro with Cinzel fallback
 * Use for: Page titles, kingdom names, logo, headers
 */
export const FONT_DISPLAY = "'Trajan Pro', 'Cinzel', 'Times New Roman', serif";

/**
 * Accent colors for page titles
 */
export const PAGE_TITLE_COLORS = {
  default: '#22d3ee',  // Cyan - most pages
  support: '#ff6b8a',  // Pink - Support Atlas page
} as const;

/**
 * Creates a neon glow text effect
 * @param color - The color for the glow effect (hex format)
 * @returns CSS properties for text-shadow glow
 */
export const neonGlow = (color: string) => ({
  color: color,
  textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
});

/**
 * Creates a stronger neon glow for emphasis
 * @param color - The color for the glow effect (hex format)
 */
export const neonGlowStrong = (color: string) => ({
  color: color,
  textShadow: `0 0 10px ${color}60, 0 0 20px ${color}30, 0 0 30px ${color}15`
});

/**
 * Returns border style based on hover state
 * @param isHovered - Whether the element is hovered
 * @param accentColor - The accent color for hover state
 */
export const cardBorder = (isHovered: boolean, accentColor = '#22d3ee') => ({
  border: `1px solid ${isHovered ? `${accentColor}50` : '#2a2a2a'}`
});

/**
 * Returns box shadow based on hover state
 * @param isHovered - Whether the element is hovered
 */
export const cardShadow = (isHovered: boolean) => 
  isHovered 
    ? '0 12px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(34, 211, 238, 0.1)' 
    : '0 4px 20px rgba(0, 0, 0, 0.2)';

/**
 * Color palette - centralized color definitions
 */
export const colors = {
  // Backgrounds
  bg: '#0a0a0a',
  surface: '#111111',
  card: '#131318',
  cardAlt: '#111116',
  surfaceHover: '#1a1a1a',
  
  // Borders
  border: '#2a2a2a',
  borderSubtle: '#1f1f1f',
  borderStrong: '#3a3a3a',
  
  // Text
  text: '#ffffff',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  
  // Brand
  primary: '#22d3ee',
  primaryHover: '#06b6d4',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  purple: '#a855f7',
  pink: '#ec4899',
  blue: '#3b82f6',
  gold: '#fbbf24',
  bronze: '#cd7f32',
  discord: '#5865F2',
} as const;

/**
 * Power tier colors
 */
export const tierColors = {
  S: '#fbbf24',
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f97316',  // Orange
  D: '#ef4444',  // Red
} as const;

/**
 * Subscription tier colors - SINGLE SOURCE OF TRUTH
 * Import from constants.ts for the canonical definition
 */
export const subscriptionColors = {
  free: '#6b7280',      // Gray
  supporter: '#FF6B8A', // Pink - Atlas Supporter
  admin: '#f59e0b',     // Gold - Admin
} as const;

/**
 * Get color for a subscription tier
 */
export const getSubscriptionColor = (tier: string): string => {
  switch (tier) {
    case 'supporter':
    case 'pro':        // Legacy
    case 'recruiter':  // Legacy
      return subscriptionColors.supporter;
    case 'admin': return subscriptionColors.admin;
    default: return colors.textSecondary;
  }
};

/**
 * Get color for a power tier
 */
export const getTierColor = (tier: 'S' | 'A' | 'B' | 'C' | 'D' | string): string => {
  return tierColors[tier as keyof typeof tierColors] || tierColors.D;
};

/**
 * Status colors for kingdom transfer status
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Leading': return '#fbbf24';  // Golden
    case 'Ordinary': return '#c0c0c0'; // Silver
    case 'Unannounced': return colors.error;
    default: return colors.error;
  }
};

/**
 * Spacing scale (in rem) - matches CSS custom properties
 */
export const spacing = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
} as const;

/**
 * Border radius values
 */
export const radius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

/**
 * Transition durations - centralized for consistency
 */
export const transitions = {
  fast: '150ms',
  base: '200ms',
  slow: '300ms',
} as const;

/**
 * Transition presets with easing
 */
export const transition = {
  fast: `all ${transitions.fast} ease`,
  base: `all ${transitions.base} ease`,
  slow: `all ${transitions.slow} ease`,
  colors: `background-color ${transitions.base} ease, border-color ${transitions.base} ease, color ${transitions.base} ease`,
  transform: `transform ${transitions.fast} ease`,
} as const;

/**
 * Shadow presets
 */
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.2)',
  card: '0 4px 20px rgba(0, 0, 0, 0.2)',
  cardHover: '0 12px 40px rgba(0, 0, 0, 0.4)',
  tooltip: '0 4px 12px rgba(0, 0, 0, 0.4)',
  glow: '0 0 20px rgba(34, 211, 238, 0.1)',
  glowStrong: '0 0 20px rgba(34, 211, 238, 0.3)',
} as const;

/**
 * Common tooltip styles following the style guide
 */
export const tooltipStyles = (accentColor: string = colors.primary) => ({
  position: 'absolute' as const,
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: '6px',
  backgroundColor: colors.bg,
  border: `1px solid ${accentColor}`,
  borderRadius: radius.md,
  padding: '0.5rem 0.75rem',
  fontSize: '0.7rem',
  color: colors.text,
  whiteSpace: 'nowrap' as const,
  zIndex: 100,
  boxShadow: shadows.tooltip,
});

/**
 * Card base styles - use for consistent card appearance
 */
export const cardStyles = {
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    transition: transition.base,
  } as React.CSSProperties,
  
  hover: {
    borderColor: `${colors.primary}50`,
    boxShadow: shadows.cardHover,
    transform: 'translateY(-2px)',
  } as React.CSSProperties,
};

/**
 * Get card styles with hover state
 */
export const getCardStyles = (isHovered: boolean): React.CSSProperties => ({
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  border: `1px solid ${isHovered ? `${colors.primary}50` : colors.border}`,
  boxShadow: isHovered ? shadows.cardHover : shadows.card,
  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
  transition: transition.base,
});

/**
 * Outcome colors for KvK results
 */
export const outcomeColors = {
  domination: colors.success,   // Won both phases
  comeback: colors.blue,        // Lost prep, won battle
  reversal: colors.purple,      // Won prep, lost battle
  invasion: colors.error,       // Lost both phases
  prepWin: colors.warning,      // Prep phase win
  battleWin: colors.orange,     // Battle phase win
} as const;

/**
 * Stat Type Styles — SINGLE SOURCE OF TRUTH
 * Use these for ALL colored text and emojis related to stat types
 * across the entire application (rankings, profiles, cards, etc.)
 */
export const statTypeStyles = {
  atlasScore:   { color: '#22d3ee', emoji: '💎', label: 'Atlas Score' },
  prepPhase:    { color: '#eab308', emoji: '🛡️', label: 'Preparation Phase' },
  battlePhase:  { color: '#f97316', emoji: '⚔️', label: 'Battle Phase' },
  domination:   { color: '#22c55e', emoji: '👑', label: 'Domination' },
  comeback:     { color: '#3b82f6', emoji: '💪', label: 'Comeback' },
  reversal:     { color: '#a855f7', emoji: '🔄', label: 'Reversal' },
  invasion:     { color: '#ef4444', emoji: '💀', label: 'Invasion' },
} as const;

/**
 * Get stat type style by key
 */
export const getStatTypeStyle = (key: keyof typeof statTypeStyles) => statTypeStyles[key];

/**
 * Button styles - ALL buttons must be center/middle aligned
 * Import and spread these styles for consistent buttons
 */
export const buttonStyles = {
  // Base styles for ALL buttons - includes mandatory alignment
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.25rem',
    borderRadius: radius.md,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: transition.fast,
    border: 'none',
  } as React.CSSProperties,

  // Primary variant (cyan)
  primary: {
    backgroundColor: colors.primary,
    color: '#000',
  } as React.CSSProperties,

  // Secondary variant (outline)
  secondary: {
    backgroundColor: 'transparent',
    color: colors.primary,
    border: `1px solid ${colors.primary}40`,
  } as React.CSSProperties,

  // Danger variant (red outline)
  danger: {
    backgroundColor: 'transparent',
    color: colors.error,
    border: `1px solid ${colors.error}40`,
  } as React.CSSProperties,

  // Ghost variant (subtle)
  ghost: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
  } as React.CSSProperties,

  // Disabled state
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,
} as const;

/**
 * Chip/tag styles - ALL chips must be center/middle aligned
 */
export const chipStyles = {
  // Base styles for ALL chips - includes mandatory alignment
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    padding: '0.2rem 0.5rem',
    borderRadius: radius.sm,
    fontSize: '0.7rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  // Primary chip (cyan)
  primary: {
    backgroundColor: `${colors.primary}15`,
    color: colors.primary,
    border: `1px solid ${colors.primary}40`,
  } as React.CSSProperties,

  // Success chip (green)
  success: {
    backgroundColor: `${colors.success}15`,
    color: colors.success,
    border: `1px solid ${colors.success}40`,
  } as React.CSSProperties,

  // Warning chip (yellow)
  warning: {
    backgroundColor: `${colors.warning}15`,
    color: colors.warning,
    border: `1px solid ${colors.warning}40`,
  } as React.CSSProperties,

  // Error chip (red)
  error: {
    backgroundColor: `${colors.error}15`,
    color: colors.error,
    border: `1px solid ${colors.error}40`,
  } as React.CSSProperties,

  // Neutral chip (gray)
  neutral: {
    backgroundColor: colors.surface,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
  } as React.CSSProperties,
} as const;

/**
 * Helper to get complete button styles
 */
export const getButtonStyles = (
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary',
  disabled = false
): React.CSSProperties => ({
  ...buttonStyles.base,
  ...buttonStyles[variant],
  ...(disabled ? buttonStyles.disabled : {}),
});

/**
 * Helper to get complete chip styles
 */
export const getChipStyles = (
  variant: 'primary' | 'success' | 'warning' | 'error' | 'neutral' = 'primary'
): React.CSSProperties => ({
  ...chipStyles.base,
  ...chipStyles[variant],
});
