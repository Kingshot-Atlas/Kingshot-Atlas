import React, { useState } from 'react';
import { Kingdom, getPowerTier, TIER_COLORS } from '../../types';

interface MiniKingdomCardProps {
  kingdom: Kingdom;
  rank: number;
  onRemove: () => void;
  themeColor: string;
  isMobile: boolean;
  navigate: (path: string) => void;
}

const neonGlow = (color: string) => ({
  color: color,
  textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
});

export const MiniKingdomCard: React.FC<MiniKingdomCardProps> = ({ 
  kingdom, 
  rank, 
  onRemove, 
  isMobile, 
  navigate 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showTierTooltip, setShowTierTooltip] = useState(false);

  const tier = kingdom.power_tier ?? getPowerTier(kingdom.overall_score);
  const tierColors = TIER_COLORS;
  
  const prepWins = kingdom.prep_wins;
  const prepLosses = kingdom.prep_losses;
  const battleWins = kingdom.battle_wins;
  const battleLosses = kingdom.battle_losses;

  return (
    <div
      style={{
        backgroundColor: '#131318',
        borderRadius: '16px',
        padding: isMobile ? '1rem' : '1.25rem',
        border: `1px solid ${isHovered ? '#22d3ee40' : '#2a2a2a'}`,
        position: 'relative',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(34, 211, 238, 0.08)' 
          : '0 4px 20px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0'
      }}
      onClick={() => navigate(`/kingdom/${kingdom.kingdom_number}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: 'none',
          border: 'none',
          color: '#ef4444',
          cursor: 'pointer',
          fontSize: '1rem',
          opacity: 0.6,
          transition: 'opacity 0.2s',
          padding: '0.25rem',
          zIndex: 10
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
      >
        ✕
      </button>

      {/* Header: Kingdom Name + Tier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ 
          fontSize: isMobile ? '1.2rem' : '1.4rem', 
          fontWeight: '700', 
          color: '#fff',
          fontFamily: "'Cinzel', serif",
          letterSpacing: '0.02em'
        }}>
          Kingdom {kingdom.kingdom_number}
        </span>
        <div
          style={{
            position: 'relative',
            padding: '0.2rem 0.5rem',
            borderRadius: '6px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            cursor: 'default',
            backgroundColor: `${tierColors[tier]}20`,
            color: tierColors[tier],
            border: `1px solid ${tierColors[tier]}50`
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setShowTierTooltip(true)}
          onMouseLeave={() => setShowTierTooltip(false)}
        >
          {tier}
          {showTierTooltip && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '8px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${tierColors[tier]}`,
              borderRadius: '8px',
              padding: '0.5rem 0.7rem',
              zIndex: 1000,
              whiteSpace: 'nowrap',
              fontSize: '0.75rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: tierColors[tier], fontWeight: 'bold' }}>{tier}-Tier</span>
                <span style={{ color: '#9ca3af' }}>
                  {tier === 'S' ? '57+ (Top 3%)' : tier === 'A' ? '47 – 57 (Top 10%)' : tier === 'B' ? '38 – 47 (Top 25%)' : tier === 'C' ? '29 – 38 (Top 50%)' : '< 29 (Bottom 50%)'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Atlas Score Row */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'baseline', 
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        <span style={{ 
          fontSize: '2rem', 
          fontWeight: '700', 
          ...neonGlow('#22d3ee'),
          fontFamily: 'system-ui',
          lineHeight: 1
        }}>
          {kingdom.overall_score.toFixed(2)}
        </span>
        <span style={{ 
          fontSize: '1rem', 
          color: '#22d3ee', 
          fontWeight: 'normal'
        }}>
          (#{rank})
        </span>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 'auto' }}>
          {kingdom.total_kvks} KvKs
        </span>
      </div>

      {/* Stats Section - Prep & Battle */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '1rem',
        padding: '0.75rem',
        backgroundColor: '#0d0d10',
        borderRadius: '10px',
        border: '1px solid #1f1f25'
      }}>
        {/* Prep Phase */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.9rem' }}>🛡️</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prep</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.4rem' }}>
            {prepWins}W – {prepLosses}L
          </div>
          <div style={{ height: '4px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${kingdom.prep_win_rate * 100}%`,
              backgroundColor: '#eab308',
              borderRadius: '2px',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: '#fff', marginTop: '0.25rem' }}>
            {Math.round(kingdom.prep_win_rate * 100)}%
          </div>
        </div>

        {/* Battle Phase */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.9rem' }}>⚔️</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Battle</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.4rem' }}>
            {battleWins}W – {battleLosses}L
          </div>
          <div style={{ height: '4px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${kingdom.battle_win_rate * 100}%`,
              backgroundColor: '#f97316',
              borderRadius: '2px',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: '#fff', marginTop: '0.25rem' }}>
            {Math.round(kingdom.battle_win_rate * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiniKingdomCard;
