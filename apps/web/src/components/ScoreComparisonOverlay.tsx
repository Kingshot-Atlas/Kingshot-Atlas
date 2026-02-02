import React, { useMemo, memo } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { 
  KingdomProfile, 
  TIER_COLORS,
  extractStatsFromProfile,
  calculateAtlasScore
} from '../types';

interface ScoreComparisonOverlayProps {
  kingdom1: KingdomProfile;
  kingdom2: KingdomProfile;
}

const ScoreComparisonOverlay: React.FC<ScoreComparisonOverlayProps> = ({ kingdom1, kingdom2 }) => {
  const isMobile = useIsMobile();
  
  const comparison = useMemo(() => {
    const stats1 = extractStatsFromProfile(kingdom1);
    const stats2 = extractStatsFromProfile(kingdom2);
    const breakdown1 = calculateAtlasScore(stats1);
    const breakdown2 = calculateAtlasScore(stats2);
    
    const score1 = breakdown1.finalScore;
    const score2 = breakdown2.finalScore;
    const tier1 = breakdown1.tier;
    const tier2 = breakdown2.tier;
    
    // Calculate differences for each component
    const components = [
      {
        name: 'Base Score',
        k1: breakdown1.baseScore,
        k2: breakdown2.baseScore,
        diff: breakdown1.baseScore - breakdown2.baseScore,
        format: (v: number) => v.toFixed(2),
        description: 'Win rate composite'
      },
      {
        name: 'Dom/Inv',
        k1: breakdown1.domInvMultiplier,
        k2: breakdown2.domInvMultiplier,
        diff: breakdown1.domInvMultiplier - breakdown2.domInvMultiplier,
        format: (v: number) => `×${v.toFixed(2)}`,
        description: 'Pattern bonus'
      },
      {
        name: 'Recent Form',
        k1: breakdown1.recentFormMultiplier,
        k2: breakdown2.recentFormMultiplier,
        diff: breakdown1.recentFormMultiplier - breakdown2.recentFormMultiplier,
        format: (v: number) => `×${v.toFixed(2)}`,
        description: 'Last 5 KvKs'
      },
      {
        name: 'Streaks',
        k1: breakdown1.streakMultiplier,
        k2: breakdown2.streakMultiplier,
        diff: breakdown1.streakMultiplier - breakdown2.streakMultiplier,
        format: (v: number) => `×${v.toFixed(2)}`,
        description: 'Win streak bonus'
      },
      {
        name: 'Experience',
        k1: breakdown1.experienceFactor,
        k2: breakdown2.experienceFactor,
        diff: breakdown1.experienceFactor - breakdown2.experienceFactor,
        format: (v: number) => `×${v.toFixed(2)}`,
        description: 'KvK count factor'
      }
    ];
    
    // Determine winner for each component
    const k1Advantages = components.filter(c => c.diff > 0.01).length;
    const k2Advantages = components.filter(c => c.diff < -0.01).length;
    
    return {
      score1,
      score2,
      tier1,
      tier2,
      scoreDiff: score1 - score2,
      winner: score1 > score2 ? 1 : score2 > score1 ? 2 : 0,
      components,
      k1Advantages,
      k2Advantages
    };
  }, [kingdom1, kingdom2]);
  
  const getWinnerStyle = (winner: 1 | 2 | 0) => {
    if (winner === 0) return { color: '#6b7280' };
    return { 
      color: winner === 1 ? '#22d3ee' : '#a855f7',
      fontWeight: '600' as const
    };
  };
  
  return (
    <div style={{
      padding: isMobile ? '1rem' : '1.25rem',
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      marginTop: '1rem'
    }}>
      <h4 style={{
        color: '#fff',
        fontSize: isMobile ? '0.9rem' : '0.95rem',
        fontWeight: '600',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        ⚔️ Score Comparison
      </h4>
      
      {/* Score Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: '1rem',
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#0a0a0a',
        borderRadius: '10px'
      }}>
        {/* Kingdom 1 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#22d3ee', fontSize: '0.7rem', marginBottom: '0.25rem' }}>
            K{kingdom1.kingdom_number}
          </div>
          <div style={{ 
            color: TIER_COLORS[comparison.tier1], 
            fontSize: '1.5rem', 
            fontWeight: '700' 
          }}>
            {comparison.score1.toFixed(2)}
          </div>
          <div style={{ 
            color: TIER_COLORS[comparison.tier1], 
            fontSize: '0.7rem',
            marginTop: '0.25rem'
          }}>
            {comparison.tier1}-Tier
          </div>
        </div>
        
        {/* VS */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ 
            color: '#6b7280', 
            fontSize: '0.8rem',
            fontWeight: '600'
          }}>
            VS
          </div>
          <div style={{
            marginTop: '0.25rem',
            fontSize: '0.7rem',
            color: comparison.winner === 1 ? '#22d3ee' : comparison.winner === 2 ? '#a855f7' : '#6b7280'
          }}>
            {comparison.winner === 0 ? 'TIE' : 
             comparison.winner === 1 ? `+${comparison.scoreDiff.toFixed(2)}` : 
             `-${Math.abs(comparison.scoreDiff).toFixed(2)}`}
          </div>
        </div>
        
        {/* Kingdom 2 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#a855f7', fontSize: '0.7rem', marginBottom: '0.25rem' }}>
            K{kingdom2.kingdom_number}
          </div>
          <div style={{ 
            color: TIER_COLORS[comparison.tier2], 
            fontSize: '1.5rem', 
            fontWeight: '700' 
          }}>
            {comparison.score2.toFixed(2)}
          </div>
          <div style={{ 
            color: TIER_COLORS[comparison.tier2], 
            fontSize: '0.7rem',
            marginTop: '0.25rem'
          }}>
            {comparison.tier2}-Tier
          </div>
        </div>
      </div>
      
      {/* Component Breakdown */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.5rem' 
      }}>
        {comparison.components.map((comp, i) => {
          const winner = comp.diff > 0.01 ? 1 : comp.diff < -0.01 ? 2 : 0;
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 1fr',
                gap: '0.5rem',
                alignItems: 'center',
                padding: '0.4rem 0.6rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '6px'
              }}
            >
              {/* K1 Value */}
              <div style={{ 
                textAlign: 'right',
                ...getWinnerStyle(winner === 1 ? 1 : 0)
              }}>
                {comp.format(comp.k1)}
                {winner === 1 && <span style={{ marginLeft: '0.25rem' }}>✓</span>}
              </div>
              
              {/* Label */}
              <div style={{ 
                textAlign: 'center', 
                color: '#6b7280', 
                fontSize: '0.65rem' 
              }}>
                {comp.name}
              </div>
              
              {/* K2 Value */}
              <div style={{ 
                textAlign: 'left',
                ...getWinnerStyle(winner === 2 ? 2 : 0)
              }}>
                {winner === 2 && <span style={{ marginRight: '0.25rem' }}>✓</span>}
                {comp.format(comp.k2)}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Summary */}
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: '#0a0a0a',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
          Component Advantages
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '2rem',
          marginTop: '0.5rem'
        }}>
          <div style={{ color: '#22d3ee' }}>
            K{kingdom1.kingdom_number}: <strong>{comparison.k1Advantages}</strong>
          </div>
          <div style={{ color: '#a855f7' }}>
            K{kingdom2.kingdom_number}: <strong>{comparison.k2Advantages}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ScoreComparisonOverlay);
