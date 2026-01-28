/**
 * Shared style utilities for Kingshot Atlas
 * These utilities ensure consistent styling across all components
 */

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
  purple: '#a855f7',
  blue: '#3b82f6',
  gold: '#fbbf24',
  discord: '#5865F2',
} as const;

/**
 * Power tier colors
 */
export const tierColors = {
  S: '#fbbf24',
  A: '#22c55e',
  B: '#3b82f6',
  C: '#9ca3af',
  D: '#6b7280',
} as const;

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
    case 'Leading': return colors.gold;
    case 'Ordinary': return colors.textSecondary;
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
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
});
