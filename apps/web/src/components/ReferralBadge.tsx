import React from 'react';
import { ReferralTier, REFERRAL_TIER_COLORS, REFERRAL_TIER_LABELS } from '../utils/constants';

interface ReferralBadgeProps {
  tier: ReferralTier;
  size?: 'sm' | 'md';
}

const ReferralBadge: React.FC<ReferralBadgeProps> = ({ tier, size = 'sm' }) => {
  const color = REFERRAL_TIER_COLORS[tier];
  const label = REFERRAL_TIER_LABELS[tier];
  const isAmbassador = tier === 'ambassador';
  
  const fontSize = size === 'sm' ? '0.6rem' : '0.7rem';
  const padding = size === 'sm' ? '0.15rem 0.4rem' : '0.2rem 0.5rem';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.2rem',
      fontSize,
      padding,
      backgroundColor: `${color}15`,
      border: `1px solid ${color}40`,
      borderRadius: '4px',
      color,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      ...(isAmbassador ? {
        boxShadow: `0 0 8px ${color}30`,
        border: `1px solid ${color}60`,
      } : {}),
    }}>
      {isAmbassador && '🏛️ '}
      {label.toUpperCase()}
    </span>
  );
};

export default ReferralBadge;
