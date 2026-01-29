import React, { memo, Suspense, lazy, useMemo, useState, useCallback } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { KingdomProfile } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';

// Lazy load RadarChart
const RadarChart = lazy(() => import('./RadarChart'));

interface CompareRadarChartProps {
  kingdom1: KingdomProfile;
  kingdom2: KingdomProfile;
}

// Helper to calculate radar data for a kingdom
const calculateRadarData = (kingdom: KingdomProfile) => {
  const totalKvks = kingdom.total_kvks || 1;
  const prepWinRate = Math.round(kingdom.prep_win_rate * 100);
  const battleWinRate = Math.round(kingdom.battle_win_rate * 100);
  const dominationRate = Math.round(((kingdom.dominations ?? 0) / totalKvks) * 100);
  const defeatRate = Math.round(((kingdom.defeats ?? 0) / totalKvks) * 100);
  
  const recentKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number).slice(0, 3);
  const recentWins = recentKvks.filter(k => 
    (k.prep_result === 'Win' || k.prep_result === 'W') && 
    (k.battle_result === 'Win' || k.battle_result === 'W')
  ).length;
  const recentPerformance = recentKvks.length > 0 ? Math.round((recentWins / recentKvks.length) * 100) : 50;
  const experienceFactor = Math.min(100, Math.round((totalKvks / 10) * 100));
  
  return [
    { label: 'Prep', value: prepWinRate },
    { label: 'Battle', value: battleWinRate },
    { label: 'Dom', value: dominationRate },
    { label: 'Recent', value: recentPerformance },
    { label: 'Exp', value: experienceFactor },
    { label: 'Resil', value: Math.max(0, 100 - defeatRate) },
  ];
};

const CompareRadarChart: React.FC<CompareRadarChartProps> = ({ kingdom1, kingdom2 }) => {
  const [showChart, setShowChart] = useState(false);
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  
  const radar1 = useMemo(() => calculateRadarData(kingdom1), [kingdom1]);
  const radar2 = useMemo(() => calculateRadarData(kingdom2), [kingdom2]);
  
  const handleToggle = useCallback(() => {
    const newState = !showChart;
    setShowChart(newState);
    if (newState) {
      trackFeature('Compare Radar Opened', {
        kingdom1: kingdom1.kingdom_number,
        kingdom2: kingdom2.kingdom_number
      });
    }
  }, [showChart, trackFeature, kingdom1.kingdom_number, kingdom2.kingdom_number]);

  return (
    <div style={{ marginTop: '1rem' }}>
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
        {showChart ? 'Hide Visual Comparison' : 'Show Visual Comparison'}
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
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            📊 Performance Radar Comparison
          </h4>
          
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.7rem', 
            textAlign: 'center', 
            marginBottom: '1rem',
            lineHeight: 1.4
          }}>
            Side-by-side visualization of key performance metrics
          </p>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
            gap: isMobile ? '1rem' : '0.5rem',
            alignItems: 'start'
          }}>
            {/* Kingdom 1 Radar */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '0.8rem', 
                fontWeight: '600', 
                color: '#22d3ee', 
                marginBottom: '0.5rem',
                fontFamily: "'Cinzel', serif"
              }}>
                Kingdom {kingdom1.kingdom_number}
              </div>
              <Suspense fallback={
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: isMobile ? '180px' : '200px',
                  color: '#6b7280',
                  fontSize: '0.75rem'
                }}>
                  Loading...
                </div>
              }>
                <RadarChart data={radar1} size={isMobile ? 180 : 200} accentColor="#22d3ee" />
              </Suspense>
            </div>
            
            {/* Kingdom 2 Radar */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '0.8rem', 
                fontWeight: '600', 
                color: '#a855f7', 
                marginBottom: '0.5rem',
                fontFamily: "'Cinzel', serif"
              }}>
                Kingdom {kingdom2.kingdom_number}
              </div>
              <Suspense fallback={
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: isMobile ? '180px' : '200px',
                  color: '#6b7280',
                  fontSize: '0.75rem'
                }}>
                  Loading...
                </div>
              }>
                <RadarChart data={radar2} size={isMobile ? 180 : 200} accentColor="#a855f7" />
              </Suspense>
            </div>
          </div>
          
          {/* Legend */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0.75rem',
            marginTop: '1rem',
            padding: '0.5rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '6px',
            fontSize: '0.6rem',
            color: '#6b7280'
          }}>
            <span><strong style={{ color: '#9ca3af' }}>Prep</strong> = Prep Win %</span>
            <span><strong style={{ color: '#9ca3af' }}>Battle</strong> = Battle Win %</span>
            <span><strong style={{ color: '#9ca3af' }}>Dom</strong> = Domination %</span>
            <span><strong style={{ color: '#9ca3af' }}>Recent</strong> = Last 3 KvKs</span>
            <span><strong style={{ color: '#9ca3af' }}>Exp</strong> = Experience</span>
            <span><strong style={{ color: '#9ca3af' }}>Resil</strong> = Resilience</span>
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

export default memo(CompareRadarChart);
