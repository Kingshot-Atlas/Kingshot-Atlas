import React, { useState, useCallback, useMemo } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { KingdomProfile } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';
import { usePremium } from '../contexts/PremiumContext';
import ComparisonRadarChart from './ComparisonRadarChart';
import SupporterBadge from './SupporterBadge';

interface PremiumComparisonChartProps {
  kingdoms: KingdomProfile[];
  maxKingdoms?: number;
  showUpgradePrompt?: boolean;
}

// Helper to calculate radar data for a kingdom
const calculateRadarData = (kingdom: KingdomProfile) => {
  const totalKvks = kingdom.total_kvks || 1;
  const prepWinRate = Math.round(kingdom.prep_win_rate * 100);
  const battleWinRate = Math.round(kingdom.battle_win_rate * 100);
  const dominationRate = Math.round(((kingdom.dominations ?? 0) / totalKvks) * 100);
  const invasionRate = Math.round(((kingdom.invasions ?? kingdom.defeats ?? 0) / totalKvks) * 100);
  
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
    { label: 'Resilience', value: Math.max(0, 100 - invasionRate) },
  ];
};

const PremiumComparisonChart: React.FC<PremiumComparisonChartProps> = ({ 
  kingdoms, 
  maxKingdoms = 5,
  showUpgradePrompt = true 
}) => {
  const [showChart, setShowChart] = useState(false);
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const { features, tier } = usePremium();
  
  // Color palette for multiple kingdoms
  const colorPalette = [
    '#22d3ee', // Cyan
    '#a855f7', // Purple  
    '#22c55e', // Green
    '#f97316', // Orange
    '#fbbf24', // Gold
  ];
  
  const availableSlots = features.multiCompare || 2;
  const canViewAll = kingdoms.length <= availableSlots;
  const needsUpgrade = kingdoms.length > availableSlots;
  
  const radarData = useMemo(() => {
    return kingdoms.slice(0, availableSlots).map((kingdom, index) => {
      const color = colorPalette[index % colorPalette.length];
      return {
        label: `Kingdom ${kingdom.kingdom_number}`,
        data: calculateRadarData(kingdom),
        color: color || '#22d3ee'
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kingdoms, availableSlots]);
  
  const handleToggle = useCallback(() => {
    if (!canViewAll && showUpgradePrompt) {
      // Don't show chart, just track upgrade intent
      trackFeature('Premium Comparison Upgrade Clicked', {
        currentTier: tier,
        requestedSlots: kingdoms.length,
        availableSlots
      });
      return;
    }
    
    const newState = !showChart;
    setShowChart(newState);
    if (newState) {
      trackFeature('Premium Comparison Opened', {
        kingdomCount: kingdoms.length,
        slotsUsed: availableSlots
      });
    }
  }, [showChart, trackFeature, kingdoms.length, availableSlots, canViewAll, showUpgradePrompt, tier]);
  
  if (kingdoms.length === 0) {
    return null;
  }
  
  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        onClick={handleToggle}
        disabled={!canViewAll && showUpgradePrompt}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.6rem 1rem',
          backgroundColor: (!canViewAll && showUpgradePrompt) ? '#2a2a2a' : 
                          showChart ? '#22d3ee15' : '#131318',
          border: `1px solid ${(!canViewAll && showUpgradePrompt) ? '#3a3a3a' : 
                              showChart ? '#22d3ee40' : '#2a2a2a'}`,
          borderRadius: '8px',
          color: (!canViewAll && showUpgradePrompt) ? '#6b7280' : 
                 showChart ? '#22d3ee' : '#9ca3af',
          fontSize: '0.8rem',
          fontWeight: '500',
          cursor: (!canViewAll && showUpgradePrompt) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          opacity: (!canViewAll && showUpgradePrompt) ? 0.7 : 1
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
        
        {!canViewAll && showUpgradePrompt ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SupporterBadge size="sm" />
            Upgrade for {kingdoms.length}-Way Comparison
          </span>
        ) : (
          <>
            {showChart ? 'Hide Premium Comparison' : `Show ${kingdoms.length}-Way Comparison`}
            <span style={{ 
              fontSize: '0.65rem', 
              padding: '0.15rem 0.4rem', 
              backgroundColor: '#22d3ee20', 
              borderRadius: '4px',
              color: '#22d3ee'
            }}>
              ⚡
            </span>
          </>
        )}
      </button>
      
      {showChart && canViewAll && (
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
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            <h4 style={{ 
              color: '#fff', 
              fontSize: isMobile ? '0.85rem' : '0.95rem', 
              fontWeight: '600', 
              margin: 0,
              textAlign: 'center'
            }}>
              ⚡ Premium Multi-Kingdom Analysis
            </h4>
            <SupporterBadge size="sm" />
          </div>
          
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.7rem', 
            textAlign: 'center', 
            marginBottom: '1rem',
            lineHeight: 1.4
          }}>
            Advanced comparison with {kingdoms.length} kingdoms. Hover over datasets to highlight specific kingdoms.
          </p>
          
          <ComparisonRadarChart
            datasets={radarData}
            size={isMobile ? 300 : 360}
            animated={true}
            ariaLabel={`Premium comparison of ${kingdoms.length} kingdoms`}
          />
          
          {/* Kingdom Legend */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${Math.min(kingdoms.length, 3)}, 1fr)`,
            gap: '0.5rem',
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px'
          }}>
            {radarData.map((dataset, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: isMobile ? '0.7rem' : '0.75rem',
                  padding: '0.25rem',
                  borderRadius: '4px',
                  backgroundColor: `${dataset.color}10`,
                  border: `1px solid ${dataset.color}30`
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: dataset.color,
                    borderRadius: '2px',
                    border: `1px solid ${dataset.color}60`
                  }}
                />
                <span style={{ color: '#fff', fontWeight: '500' }}>
                  {dataset.label}
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                  ({kingdoms[index]?.overall_score?.toFixed(1) || '0.0'})
                </span>
              </div>
            ))}
          </div>
          
          {needsUpgrade && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#22d3ee10',
              border: '1px solid #22d3ee30',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                ⚡ Pro Feature
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                Upgrade to compare up to {maxKingdoms} kingdoms simultaneously
              </div>
            </div>
          )}
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

export default PremiumComparisonChart;
