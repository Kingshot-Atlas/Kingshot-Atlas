import React from 'react';
import { colors, radius } from '../../utils/styles';

export type ChipVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'purple' | 'gold';
export type ChipSize = 'sm' | 'md';

export interface ChipProps {
  variant?: ChipVariant;
  size?: ChipSize;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

const sizeStyles: Record<ChipSize, React.CSSProperties> = {
  sm: {
    padding: '0.15rem 0.4rem',
    fontSize: '0.6rem',
    gap: '0.2rem',
  },
  md: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.7rem',
    gap: '0.25rem',
  },
};

const variantStyles: Record<ChipVariant, { bg: string; color: string; border: string }> = {
  primary: {
    bg: `${colors.primary}15`,
    color: colors.primary,
    border: `${colors.primary}40`,
  },
  success: {
    bg: `${colors.success}15`,
    color: colors.success,
    border: `${colors.success}40`,
  },
  warning: {
    bg: `${colors.warning}15`,
    color: colors.warning,
    border: `${colors.warning}40`,
  },
  error: {
    bg: `${colors.error}15`,
    color: colors.error,
    border: `${colors.error}40`,
  },
  neutral: {
    bg: colors.surface,
    color: colors.textSecondary,
    border: colors.border,
  },
  purple: {
    bg: `${colors.purple}15`,
    color: colors.purple,
    border: `${colors.purple}40`,
  },
  gold: {
    bg: `${colors.gold}15`,
    color: colors.gold,
    border: `${colors.gold}40`,
  },
};

export const Chip: React.FC<ChipProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  onDismiss,
  children,
  style,
  className,
}) => {
  const variantStyle = variantStyles[variant];

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    backgroundColor: variantStyle.bg,
    color: variantStyle.color,
    border: `1px solid ${variantStyle.border}`,
    ...sizeStyles[size],
  };

  return (
    <span style={{ ...baseStyles, ...style }} className={className}>
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            marginLeft: '0.25rem',
            opacity: 0.7,
            fontSize: 'inherit',
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </span>
  );
};

export const TierChip: React.FC<{ tier: 'S' | 'A' | 'B' | 'C' | 'D'; size?: ChipSize }> = ({
  tier,
  size = 'md',
}) => {
  const tierVariants: Record<string, ChipVariant> = {
    S: 'gold',
    A: 'success',
    B: 'primary',
    C: 'warning',
    D: 'error',
  };

  return (
    <Chip variant={tierVariants[tier] || 'neutral'} size={size}>
      {tier}-Tier
    </Chip>
  );
};

// SupporterChip - Pink color for Atlas Supporter tier
export const ProChip: React.FC<{ size?: ChipSize }> = ({ size = 'sm' }) => (
  <Chip 
    variant="primary" 
    size={size} 
    icon={<span>💖</span>}
    style={{ backgroundColor: '#FF6B8A15', color: '#FF6B8A', border: '1px solid #FF6B8A40' }}
  >
    SUPPORTER
  </Chip>
);

// Alias for backwards compatibility
export const SupporterChip = ProChip;

// RecruiterChip - Purple color for Atlas Recruiter tier
export const RecruiterChip: React.FC<{ size?: ChipSize }> = ({ size = 'sm' }) => (
  <Chip 
    variant="purple" 
    size={size} 
    icon={<span>�</span>}
    style={{ backgroundColor: '#a855f715', color: '#a855f7', border: '1px solid #a855f740' }}
  >
    RECRUITER
  </Chip>
);

export const VerifiedChip: React.FC<{ size?: ChipSize }> = ({ size = 'sm' }) => (
  <Chip variant="success" size={size}>
    Verified
  </Chip>
);

export default Chip;
