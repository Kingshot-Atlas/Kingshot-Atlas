import React, { useState, memo } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';

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

const TIER_DESCRIPTIONS = [
  { tier: 'S', range: '10+ (Top 10%)', color: '#fbbf24' },
  { tier: 'A', range: '7 – 9.9 (Top 25%)', color: '#22c55e' },
  { tier: 'B', range: '4.5 – 6.9 (Top 50%)', color: '#3b82f6' },
  { tier: 'C', range: '2.5 – 4.4 (Top 75%)', color: '#f97316' },
  { tier: 'D', range: '< 2.5 (Bottom 25%)', color: '#ef4444' },
];

const TierBadge: React.FC<TierBadgeProps> = ({ tier }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isMobile = useIsMobile();
  const config = TIER_CONFIG[tier];

  return (
    <div
      className={tier === 'S' ? 's-tier-badge' : ''}
      style={{
        position: 'relative',
        padding: '0.2rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        cursor: 'default',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`
      }}
      onMouseEnter={() => !isMobile && setShowTooltip(true)}
      onMouseLeave={() => !isMobile && setShowTooltip(false)}
      onClick={() => isMobile && setShowTooltip(!showTooltip)}
    >
      {tier}
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          backgroundColor: '#0a0a0a',
          border: `1px solid ${config.color}`,
          borderRadius: '8px',
          padding: '0.6rem 0.8rem',
          zIndex: 1000,
          whiteSpace: 'nowrap',
          fontSize: '0.75rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.4rem', color: '#fff', fontSize: '0.8rem' }}>
            Power Tiers
          </div>
          {TIER_DESCRIPTIONS.map(t => (
            <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ color: t.color, fontWeight: 'bold', width: '14px' }}>{t.tier}</span>
              <span style={{ color: '#9ca3af' }}>{t.range}</span>
            </div>
          ))}
        </div>
      )}
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
  );
};

export default memo(TierBadge);
