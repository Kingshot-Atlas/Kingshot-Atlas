import React, { memo } from 'react';
import SmartTooltip from './SmartTooltip';

interface TierBadgeProps {
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
}

const TIER_CONFIG = {
  S: { color: '#fbbf24', bg: '#fbbf2420', border: '#fbbf2450' },
  A: { color: '#22c55e', bg: '#22c55e20', border: '#22c55e50' },
  B: { color: '#3b82f6', bg: '#3b82f620', border: '#3b82f650' },
  C: { color: '#f97316', bg: '#f9731620', border: '#f9731650' },
  D: { color: '#ef4444', bg: '#ef444420', border: '#ef444450' },
} as const;

const TIER_RANGES: Record<string, string> = {
  S: '57+ (Top 3%)',
  A: '47 – 57 (Top 10%)',
  B: '38 – 47 (Top 25%)',
  C: '29 – 38 (Top 50%)',
  D: '< 29 (Bottom 50%)',
};

const TierBadge: React.FC<TierBadgeProps> = ({ tier }) => {
  const config = TIER_CONFIG[tier];

  return (
    <SmartTooltip
      accentColor={config.color}
      maxWidth={180}
      content={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
          <span style={{ color: config.color, fontWeight: 'bold' }}>{tier}-Tier</span>
          <span style={{ color: '#9ca3af' }}>{TIER_RANGES[tier]}</span>
        </div>
      }
    >
      <div
        className={tier === 'S' ? 's-tier-badge' : ''}
        style={{
          padding: '0.2rem 0.5rem',
          borderRadius: '6px',
          fontSize: '0.7rem',
          fontWeight: 'bold',
          cursor: 'default',
          backgroundColor: config.bg,
          color: config.color,
          border: `1px solid ${config.border}`
        }}
      >
        {tier}
        <style>{`
          @keyframes sTierPulse {
            0%, 100% { box-shadow: 0 0 8px #fbbf2440; }
            50% { box-shadow: 0 0 16px #fbbf2480, 0 0 24px #fbbf2430; }
          }
          .s-tier-badge {
            animation: sTierPulse 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    </SmartTooltip>
  );
};

export default memo(TierBadge);
