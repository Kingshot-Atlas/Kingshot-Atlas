import React from 'react';
import { SubscriptionTier } from '../contexts/PremiumContext';

interface ProBadgeProps {
  tier?: SubscriptionTier;
  size?: 'sm' | 'md' | 'lg';
}

const ProBadge: React.FC<ProBadgeProps> = ({ tier = 'pro', size = 'sm' }) => {
  const isRecruiter = tier === 'recruiter';
  const color = isRecruiter ? '#a855f7' : '#22d3ee';
  const label = isRecruiter ? 'RECRUITER' : 'PRO';
  
  const sizes = {
    sm: { padding: '0.15rem 0.4rem', fontSize: '0.65rem', iconSize: 8, gap: '0.2rem' },
    md: { padding: '0.25rem 0.5rem', fontSize: '0.75rem', iconSize: 10, gap: '0.25rem' },
    lg: { padding: '0.35rem 0.65rem', fontSize: '0.85rem', iconSize: 12, gap: '0.3rem' },
  };
  
  const s = sizes[size];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: s.gap,
      padding: s.padding,
      backgroundColor: `${color}20`,
      border: `1px solid ${color}50`,
      borderRadius: '4px',
      fontSize: s.fontSize,
      color: color,
      fontWeight: '700',
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    }}>
      <svg width={s.iconSize} height={s.iconSize} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
      </svg>
      {label}
    </span>
  );
};

export default ProBadge;
