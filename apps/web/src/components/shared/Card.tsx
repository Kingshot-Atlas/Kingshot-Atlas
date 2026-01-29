import React, { useState, ReactNode } from 'react';
import { colors, radius, shadows, transition } from '../../utils/styles';

interface CardProps {
  children: ReactNode;
  /** Enable hover effects (border glow, shadow, lift) */
  hoverable?: boolean;
  /** Custom accent color for hover state */
  accentColor?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Additional CSS class names */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Padding preset: 'none' | 'sm' | 'md' | 'lg' */
  padding?: 'none' | 'sm' | 'md' | 'lg';
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
 * // Custom accent color
 * <Card hoverable accentColor="#22c55e">
 *   Success themed card
 * </Card>
 */
const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  accentColor = colors.primary,
  style,
  className = '',
  onClick,
  padding = 'md',
  variant = 'default',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyles: React.CSSProperties = {
    backgroundColor: variant === 'elevated' ? colors.surfaceHover : colors.surface,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    padding: paddingMap[padding],
    transition: transition.base,
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
