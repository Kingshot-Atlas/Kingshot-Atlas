import React, { useState, memo, Suspense, lazy, useMemo, useCallback } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { KingdomProfile } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';

// Lazy load RadarChart - only loaded when user expands the breakdown
const RadarChart = lazy(() => import('./RadarChart'));

interface AtlasScoreBreakdownProps {
  kingdom: KingdomProfile;
  rank?: number;
  totalKingdoms?: number;
}

const AtlasScoreBreakdown: React.FC<AtlasScoreBreakdownProps> = ({ kingdom, rank, totalKingdoms }) => {
  // Calculate percentile if rank and total are provided
  const percentile = useMemo(() => {
    if (!rank || !totalKingdoms || totalKingdoms === 0) return null;
    return Math.round(((totalKingdoms - rank) / totalKingdoms) * 100);
  }, [rank, totalKingdoms]);
  const [showChart, setShowChart] = useState(false);
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  
  // Track radar chart toggle with analytics
  const handleToggle = useCallback(() => {
    const newState = !showChart;
    setShowChart(newState);
    if (newState) {
      trackFeature('Radar Chart Opened', { 
        kingdom: kingdom.kingdom_number,
        atlasScore: kingdom.overall_score,
        tier: kingdom.power_tier || 'Unknown'
      });
    }
  }, [showChart, trackFeature, kingdom.kingdom_number, kingdom.overall_score, kingdom.power_tier]);
  
  // Memoize radar data calculations - only recalculate when kingdom data changes
  const radarData = useMemo(() => {
    const totalKvks = kingdom.total_kvks || 1;
    const prepWinRate = Math.round(kingdom.prep_win_rate * 100);
    const battleWinRate = Math.round(kingdom.battle_win_rate * 100);
    const dominationRate = Math.round(((kingdom.dominations ?? 0) / totalKvks) * 100);
    const defeatRate = Math.round(((kingdom.defeats ?? 0) / totalKvks) * 100);
    
    // Recent performance (last 3 KvKs)
    const recentKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number).slice(0, 3);
    const recentWins = recentKvks.filter(k => 
      (k.prep_result === 'Win' || k.prep_result === 'W') && 
      (k.battle_result === 'Win' || k.battle_result === 'W')
    ).length;
    const recentPerformance = recentKvks.length > 0 ? Math.round((recentWins / recentKvks.length) * 100) : 50;
    
    // Experience factor (more KvKs = more reliable data)
    const experienceFactor = Math.min(100, Math.round((totalKvks / 10) * 100));
    
    return [
      { label: 'Prep Win', value: prepWinRate },
      { label: 'Battle Win', value: battleWinRate },
      { label: 'Domination', value: dominationRate },
      { label: 'Recent', value: recentPerformance },
      { label: 'Experience', value: experienceFactor },
      { label: 'Resilience', value: Math.max(0, 100 - defeatRate) },
    ];
  }, [kingdom.total_kvks, kingdom.prep_win_rate, kingdom.battle_win_rate, kingdom.dominations, kingdom.defeats, kingdom.recent_kvks]);

  return (
    <div style={{ marginBottom: isMobile ? '1rem' : '1.25rem' }}>
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.6rem 1rem',
          backgroundColor: showChart ? '#22d3ee15' : '#131318',
          border: `1px solid ${showChart ? '#22d3ee40' : '#2a2a2a'}`,
          borderRadius: '8px',
          color: showChart ? '#22d3ee' : '#9ca3af',
          fontSize: '0.8rem',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{
            transform: showChart ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        {showChart ? 'Hide Score Breakdown' : 'Show Score Breakdown'}
        <span style={{ 
          fontSize: '0.65rem', 
          padding: '0.15rem 0.4rem', 
          backgroundColor: '#22d3ee20', 
          borderRadius: '4px',
          color: '#22d3ee'
        }}>
          📊
        </span>
      </button>
      
      {/* Expandable Chart Section */}
      {showChart && (
        <div 
          style={{
            marginTop: '0.75rem',
            padding: isMobile ? '1rem' : '1.25rem',
            backgroundColor: '#131318',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <h4 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '0.85rem' : '0.95rem', 
            fontWeight: '600', 
            marginBottom: '0.75rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            📊 Atlas Score Breakdown
          </h4>
          
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.7rem', 
            textAlign: 'center', 
            marginBottom: '1rem',
            lineHeight: 1.4
          }}>
            Visual representation of performance metrics contributing to the Atlas Score
          </p>
          
          {/* Weighted Score Contribution */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: '600', marginBottom: '0.25rem' }}>
              Score Contribution Breakdown
            </div>
            {[
              { label: 'Prep Win Rate', weight: 25, value: radarData[0]?.value || 0, color: '#22d3ee' },
              { label: 'Battle Win Rate', weight: 25, value: radarData[1]?.value || 0, color: '#a855f7' },
              { label: 'Recent Performance', weight: 30, value: radarData[3]?.value || 0, color: '#eab308' },
              { label: 'Domination Bonus', weight: 20, value: radarData[2]?.value || 0, color: '#22c55e', isBonus: true },
              { label: 'Invasion Penalty', weight: -20, value: 100 - (radarData[5]?.value || 100), color: '#ef4444', isPenalty: true },
            ].map((item, i) => {
              const contribution = (item.value / 100) * Math.abs(item.weight);
              const displayContribution = item.isPenalty ? -contribution : contribution;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6rem' }}>
                  <span style={{ color: '#6b7280', width: '90px', flexShrink: 0 }}>{item.label}</span>
                  <div style={{ 
                    flex: 1, 
                    height: '6px', 
                    backgroundColor: '#1a1a1a', 
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(100, Math.abs(contribution) * (100 / Math.abs(item.weight)))}%`,
                      height: '100%',
                      backgroundColor: item.color,
                      borderRadius: '3px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <span style={{ 
                    color: item.isPenalty ? '#ef4444' : item.isBonus ? '#22c55e' : item.color, 
                    fontWeight: '600',
                    width: '45px',
                    textAlign: 'right'
                  }}>
                    {displayContribution >= 0 ? '+' : ''}{displayContribution.toFixed(1)}%
                  </span>
                </div>
              );
            })}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #2a2a2a', 
              paddingTop: '0.35rem',
              marginTop: '0.25rem'
            }}>
              {/* Percentile Indicator */}
              {percentile !== null && (
                <span style={{ 
                  fontSize: '0.6rem', 
                  color: percentile >= 75 ? '#22c55e' : percentile >= 50 ? '#eab308' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  {percentile >= 90 ? '🏆' : percentile >= 75 ? '⭐' : percentile >= 50 ? '📈' : ''}
                  Better than <strong>{percentile}%</strong> of kingdoms
                </span>
              )}
              {percentile === null && <span />}
              <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                Final Score: <strong style={{ color: '#22d3ee' }}>{kingdom.overall_score?.toFixed(1) || '0.0'}</strong>
              </span>
            </div>
          </div>
          
          <Suspense fallback={
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: isMobile ? '200px' : '260px',
              color: '#6b7280',
              fontSize: '0.8rem'
            }}>
              Loading chart...
            </div>
          }>
            <RadarChart data={radarData} accentColor="#22d3ee" />
          </Suspense>
          
          {/* Legend with Tooltips */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '0.5rem',
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px'
          }}>
            {[
              { label: 'Prep Win', desc: 'Prep phase victories', tooltip: 'Percentage of KvKs where this kingdom won the Preparation Phase. Higher = better at resource gathering and early strategy.', weight: '25%' },
              { label: 'Battle Win', desc: 'Battle phase victories', tooltip: 'Percentage of KvKs where this kingdom won the Battle Phase. Higher = stronger combat performance.', weight: '25%' },
              { label: 'Domination', desc: 'Won both phases', tooltip: 'Percentage of KvKs where this kingdom achieved a Domination (won BOTH Prep and Battle). The ultimate flex.', weight: '+20% bonus' },
              { label: 'Recent', desc: 'Last 3 KvKs', tooltip: 'Performance in the most recent 3 KvKs. Recent results carry more weight—past glory fades.', weight: '30%' },
              { label: 'Experience', desc: 'KvKs played', tooltip: 'Total number of KvKs participated in. More data = more reliable score. Max at 10 KvKs.', weight: 'reliability' },
              { label: 'Resilience', desc: 'Avoids invasions', tooltip: 'Inverse of Invasion rate. Higher = rarely loses both phases. Kingdoms that avoid total defeats are more consistent.', weight: '-20% penalty' },
            ].map((item, i) => (
              <div 
                key={i} 
                style={{ 
                  fontSize: '0.65rem',
                  position: 'relative',
                  cursor: 'help',
                  padding: '0.25rem',
                  borderRadius: '4px',
                  transition: 'background-color 0.15s'
                }}
                title={`${item.tooltip}\n\nWeight: ${item.weight}`}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ color: '#22d3ee', fontWeight: '500' }}>{item.label}</span>
                <span style={{ color: '#4a4a4a' }}> — </span>
                <span style={{ color: '#6b7280' }}>{item.desc}</span>
                <span style={{ 
                  marginLeft: '0.25rem',
                  fontSize: '0.55rem',
                  color: '#4a4a4a',
                  verticalAlign: 'super'
                }}>ⓘ</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default memo(AtlasScoreBreakdown);
