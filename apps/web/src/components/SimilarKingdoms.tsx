import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Kingdom, getPowerTier } from '../types';
import { getTierColor, colors } from '../utils/styles';
import { useIsMobile } from '../hooks/useMediaQuery';

interface SimilarKingdomsProps {
  currentKingdom: Kingdom;
  allKingdoms: Kingdom[];
  limit?: number;
}

const SimilarKingdoms: React.FC<SimilarKingdomsProps> = ({ 
  currentKingdom, 
  allKingdoms, 
  limit = 5 
}) => {
  const isMobile = useIsMobile();
  const [showTooltip, setShowTooltip] = useState(false);
  
  const similarKingdoms = useMemo(() => {
    const currentTier = getPowerTier(currentKingdom.overall_score);
    const currentNum = currentKingdom.kingdom_number;
    
    // Only compare with kingdoms within ±50 range
    const minKingdom = currentNum - 50;
    const maxKingdom = currentNum + 50;
    
    // Calculate similarity as a percentage (100% = identical)
    const scored = allKingdoms
      .filter(k => k.kingdom_number !== currentKingdom.kingdom_number)
      .filter(k => k.kingdom_number >= minKingdom && k.kingdom_number <= maxKingdom)
      .map(k => {
        // Weighted similarity calculation
        // Atlas Score similarity (max 100 point difference in data, weight: 40%)
        const maxScoreDiff = 100;
        const scoreSim = Math.max(0, 1 - Math.abs(k.overall_score - currentKingdom.overall_score) / maxScoreDiff);
        
        // Win rate similarity (weight: 25% each)
        const prepWRSim = 1 - Math.abs(k.prep_win_rate - currentKingdom.prep_win_rate);
        const battleWRSim = 1 - Math.abs(k.battle_win_rate - currentKingdom.battle_win_rate);
        
        // Tier match bonus (weight: 10%)
        const tierMatch = getPowerTier(k.overall_score) === currentTier ? 1 : 0.5;
        
        // Calculate weighted average (0-100%)
        const similarity = (
          scoreSim * 0.40 +
          prepWRSim * 0.25 +
          battleWRSim * 0.25 +
          tierMatch * 0.10
        ) * 100;
        
        return { kingdom: k, similarity };
      })
      // Filter to only show kingdoms with >70% similarity
      .filter(k => k.similarity >= 70)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }, [currentKingdom, allKingdoms, limit]);

  if (similarKingdoms.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <div 
        style={{ 
          position: 'relative',
          textAlign: 'center',
          marginBottom: '0.75rem',
          cursor: 'help'
        }}
        onMouseEnter={() => !isMobile && setShowTooltip(true)}
        onMouseLeave={() => !isMobile && setShowTooltip(false)}
        onClick={() => isMobile && setShowTooltip(!showTooltip)}
      >
        <h3 style={{ 
          color: '#fff', 
          fontSize: '0.95rem', 
          fontWeight: '600', 
          margin: 0,
        }}>
          Nearby Kingdoms
        </h3>
        
        {showTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            backgroundColor: '#0a0a0a',
            border: `1px solid ${colors.primary}`,
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.7rem',
            color: '#fff',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            <div style={{ color: colors.primary, fontWeight: 'bold', marginBottom: '2px' }}>How it works</div>
            <div style={{ color: '#9ca3af', fontSize: '0.65rem', whiteSpace: 'normal', maxWidth: '200px', textAlign: 'left' }}>
              Shows kingdoms with similar Atlas Score, win rates, and tier within ±50 of K-{currentKingdom.kingdom_number}
            </div>
          </div>
        )}
      </div>
      
      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr auto 1.5fr auto',
        gap: '0.75rem',
        padding: '0 0.75rem 0.5rem',
        borderBottom: '1px solid #2a2a2a',
        marginBottom: '0.5rem'
      }}>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '500', textAlign: 'left' }}>Kingdom</span>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '500', textAlign: 'left', paddingLeft: '0.25rem' }}>Tier</span>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '500', textAlign: 'center' }}>Atlas Score</span>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '500', textAlign: 'center' }}>Match</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {similarKingdoms.map(({ kingdom, similarity }) => {
          const tier = getPowerTier(kingdom.overall_score);
          const tierColor = getTierColor(tier);
          
          return (
            <Link
              key={kingdom.kingdom_number}
              to={`/kingdom/${kingdom.kingdom_number}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr auto 1.5fr auto',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.4rem 0.75rem',
                backgroundColor: '#1a1a20',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#222230';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a20';
              }}
            >
              {/* Kingdom */}
              <span style={{ 
                color: '#fff', 
                fontWeight: '600',
                fontSize: '0.85rem',
                textAlign: 'left'
              }}>
                Kingdom {kingdom.kingdom_number}
              </span>
              
              {/* Tier */}
              <span style={{
                padding: '0.15rem 0.35rem',
                backgroundColor: `${tierColor}20`,
                color: tierColor,
                fontSize: '0.65rem',
                fontWeight: '600',
                borderRadius: '3px',
                textAlign: 'center',
                marginLeft: '0.25rem'
              }}>
                {tier}
              </span>
              
              {/* Atlas Score with Rank */}
              <span style={{ 
                color: '#22d3ee', 
                fontSize: '0.85rem', 
                fontWeight: '600',
                textShadow: '0 0 8px rgba(34, 211, 238, 0.5)',
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                {kingdom.overall_score.toFixed(2)}
                <span style={{ 
                  color: '#22d3ee', 
                  fontWeight: '400',
                  marginLeft: '0.25rem'
                }}>
                  (#{kingdom.rank || '—'})
                </span>
              </span>
              
              {/* Match % */}
              <span style={{ 
                color: '#22c55e', 
                fontSize: '0.75rem',
                fontWeight: '500',
                textAlign: 'center'
              }}>
                {Math.round(similarity)}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SimilarKingdoms;
