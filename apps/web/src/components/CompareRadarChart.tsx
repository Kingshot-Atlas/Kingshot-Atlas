import React, { memo, useState, useCallback, useMemo } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { KingdomProfile } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';
import ComparisonRadarChart from './ComparisonRadarChart';

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
    { label: 'Prep Win', value: prepWinRate },
    { label: 'Battle Win', value: battleWinRate },
    { label: 'Domination', value: dominationRate },
    { label: 'Recent', value: recentPerformance },
    { label: 'Experience', value: experienceFactor },
    { label: 'Resilience', value: Math.max(0, 100 - defeatRate) },
  ];
};

const CompareRadarChart: React.FC<CompareRadarChartProps> = ({ kingdom1, kingdom2 }) => {
  const [showChart, setShowChart] = useState(false);
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  
  const radarData = useMemo(() => ({
    kingdom1: {
      label: `Kingdom ${kingdom1.kingdom_number}`,
      data: calculateRadarData(kingdom1),
      color: '#22d3ee'
    },
    kingdom2: {
      label: `Kingdom ${kingdom2.kingdom_number}`,
      data: calculateRadarData(kingdom2),
      color: '#a855f7'
    }
  }), [kingdom1, kingdom2]);
  
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
          gap: '0.75rem',
          width: '100%',
          padding: '1rem 1.5rem',
          background: showChart 
            ? 'linear-gradient(135deg, #22d3ee20 0%, #a855f720 100%)' 
            : 'linear-gradient(135deg, #1a1a2e 0%, #131318 100%)',
          border: `2px solid ${showChart ? '#22d3ee' : '#22d3ee50'}`,
          borderRadius: '12px',
          color: showChart ? '#22d3ee' : '#fff',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: showChart 
            ? '0 0 20px rgba(34, 211, 238, 0.3), 0 0 40px rgba(168, 85, 247, 0.2)' 
            : '0 4px 15px rgba(34, 211, 238, 0.15)',
          animation: showChart ? 'none' : 'subtlePulse 2s ease-in-out infinite'
        }}
        onMouseEnter={(e) => {
          if (!showChart) {
            e.currentTarget.style.borderColor = '#22d3ee';
            e.currentTarget.style.boxShadow = '0 0 25px rgba(34, 211, 238, 0.4)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={(e) => {
          if (!showChart) {
            e.currentTarget.style.borderColor = '#22d3ee50';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(34, 211, 238, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
          }
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>🎯</span>
        <span>{showChart ? 'Hide Visual Comparison' : 'Show Overlapping Comparison'}</span>
        <svg 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5"
          style={{
            transform: showChart ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      
      <style>{`
        @keyframes subtlePulse {
          0%, 100% { box-shadow: 0 4px 15px rgba(34, 211, 238, 0.15); }
          50% { box-shadow: 0 4px 25px rgba(34, 211, 238, 0.3); }
        }
      `}</style>
      
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
            🎯 Overlapping Performance Comparison
          </h4>
          
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.7rem', 
            textAlign: 'center', 
            marginBottom: '1rem',
            lineHeight: 1.4
          }}>
            Direct visual comparison with overlapping metrics. Hover over datasets to highlight.
          </p>
          
          <ComparisonRadarChart
            datasets={[radarData.kingdom1, radarData.kingdom2]}
            size={isMobile ? 280 : 340}
            animated={true}
            ariaLabel={`Performance comparison between Kingdom ${kingdom1.kingdom_number} and Kingdom ${kingdom2.kingdom_number}`}
          />
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
