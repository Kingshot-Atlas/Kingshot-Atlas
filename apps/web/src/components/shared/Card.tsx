import React, { useState, ReactNode } from 'react';
import { colors, radius, shadows, transition } from '../../utils/styles';
import { useIsMobile } from '../../hooks/useMediaQuery';

/** Responsive padding: different values for mobile and desktop */
interface ResponsivePadding {
  mobile: string;
  desktop: string;
}

interface CardProps {
  children: ReactNode;
  /** Enable hover effects (border glow, shadow, lift) */
  hoverable?: boolean;
  /** Custom accent color for hover state */
  accentColor?: string;
  /** Custom border color (default: colors.border) */
  borderColor?: string;
  /** Bottom margin shorthand */
  marginBottom?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Additional CSS class names */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Padding preset or responsive object { mobile, desktop } */
  padding?: 'none' | 'sm' | 'md' | 'lg' | ResponsivePadding;
  /** Card variant */
  variant?: 'default' | 'elevated' | 'outlined';
}

const paddingMap = {
  none: '0',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
};

/**
 * Reusable Card component following the Kingshot Atlas style guide.
 * 
 * @example
 * // Basic card
 * <Card>Content here</Card>
 * 
 * @example
 * // Hoverable card with click
 * <Card hoverable onClick={() => navigate('/somewhere')}>
 *   Clickable content
 * </Card>
 * 
 * @example
 * // Custom border color and margin
 * <Card borderColor={`${colors.success}40`} marginBottom="1.5rem">
 *   Success themed card
 * </Card>
 * 
 * @example
 * // Responsive padding
 * <Card padding={{ mobile: '1rem', desktop: '1.5rem' }}>
 *   Responsive content
 * </Card>
 */
const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  accentColor = colors.primary,
  borderColor: borderColorProp,
  marginBottom,
  style,
  className = '',
  onClick,
  padding = 'md',
  variant = 'default',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();

  const resolvedBorderColor = borderColorProp ?? colors.border;
  const resolvedPadding = typeof padding === 'object'
    ? (isMobile ? padding.mobile : padding.desktop)
    : paddingMap[padding];

  const baseStyles: React.CSSProperties = {
    backgroundColor: variant === 'elevated' ? colors.surfaceHover : colors.surface,
    borderRadius: radius.lg,
    border: `1px solid ${resolvedBorderColor}`,
    padding: resolvedPadding,
    transition: transition.base,
    ...(marginBottom ? { marginBottom } : {}),
  };

  const hoverStyles: React.CSSProperties = hoverable && isHovered ? {
    borderColor: `${accentColor}50`,
    boxShadow: `${shadows.cardHover}, 0 0 20px ${accentColor}10`,
    transform: 'translateY(-2px)',
  } : {};

  const interactiveStyles: React.CSSProperties = (hoverable || onClick) ? {
    cursor: 'pointer',
  } : {};

  return (
    <div
      className={className}
      style={{
        ...baseStyles,
        ...hoverStyles,
        ...interactiveStyles,
        ...style,
      }}
      onMouseEnter={() => hoverable && setIsHovered(true)}
      onMouseLeave={() => hoverable && setIsHovered(false)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {children}
    </div>
  );
};

export default React.memo(Card);
