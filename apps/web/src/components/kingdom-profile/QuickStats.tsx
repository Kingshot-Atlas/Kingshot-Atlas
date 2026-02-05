import React, { useState } from 'react';
import { neonGlow } from '../../utils/styles';

interface StatItem {
  label: string;
  value: number;
  color: string;
  icon: string;
  tooltip: string;
  percent: number;
}

interface QuickStatsProps {
  totalKvks: number;
  dominations: number;
  invasions: number;
  prepWins: number;
  battleWins: number;
  isMobile: boolean;
}

const QuickStats: React.FC<QuickStatsProps> = ({
  totalKvks,
  dominations,
  invasions,
  prepWins,
  battleWins,
  isMobile,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const handleTooltipToggle = (id: string) => {
    setActiveTooltip(activeTooltip === id ? null : id);
  };

  const kvks = totalKvks || 1;
  const reversals = prepWins - dominations;
  const comebacks = battleWins - dominations;

  const stats: StatItem[] = [
    { label: 'Dominations', value: dominations, color: '#22c55e', icon: '👑', tooltip: 'Won both Prep and Battle', percent: Math.round((dominations / kvks) * 100) },
    { label: 'Comebacks', value: comebacks, color: '#3b82f6', icon: '💪', tooltip: 'Lost Prep but won Battle', percent: Math.round((comebacks / kvks) * 100) },
    { label: 'Reversals', value: reversals, color: '#a855f7', icon: '🔄', tooltip: 'Won Prep but lost Battle', percent: Math.round((reversals / kvks) * 100) },
    { label: 'Invasions', value: invasions, color: '#ef4444', icon: '💀', tooltip: 'Lost both Prep and Battle', percent: Math.round((invasions / kvks) * 100) },
  ];

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
      gap: isMobile ? '0.5rem' : '0.75rem', 
      marginBottom: isMobile ? '1.25rem' : '1.5rem' 
    }}>
      {stats.map((stat, i) => (
        <div 
          key={i}
          className="stat-card"
          onClick={() => isMobile && handleTooltipToggle(`stat-${i}`)}
          onMouseEnter={() => !isMobile && setActiveTooltip(`stat-${i}`)}
          onMouseLeave={() => !isMobile && setActiveTooltip(null)}
          style={{ 
            padding: isMobile ? '0.75rem 0.5rem' : '1rem', 
            textAlign: 'center',
            position: 'relative',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: isMobile ? '0.9rem' : '1rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
          <div style={{ 
            fontSize: isMobile ? '1.25rem' : '1.5rem', 
            fontWeight: 'bold', 
            ...neonGlow(stat.color), 
            fontFamily: 'system-ui',
            lineHeight: 1
          }}>
            {stat.value}<span style={{ fontSize: '0.65rem', color: stat.color, fontWeight: 'normal', marginLeft: '0.25rem' }}>({stat.percent}%)</span>
          </div>
          <div style={{ color: '#6b7280', fontSize: isMobile ? '0.65rem' : '0.7rem', marginTop: '0.25rem' }}>{stat.label}</div>
          {activeTooltip === `stat-${i}` && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${stat.color}`,
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#fff',
              whiteSpace: 'nowrap',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
            }}>
              <div style={{ color: stat.color, fontWeight: 'bold', marginBottom: '0.15rem' }}>{stat.icon} {stat.label}</div>
              <div style={{ color: '#9ca3af', fontSize: '0.65rem' }}>{stat.tooltip}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default QuickStats;
