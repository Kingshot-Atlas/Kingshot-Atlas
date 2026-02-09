import React from 'react';
import { neonGlow } from '../../utils/styles';
import SmartTooltip from '../shared/SmartTooltip';

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
      marginBottom: isMobile ? '1.25rem' : '1.5rem',
      width: '100%'
    }}>
      {stats.map((stat, i) => (
        <SmartTooltip
          key={i}
          accentColor={stat.color}
          style={{ width: '100%', display: 'flex' }}
          content={
            <div style={{ fontSize: '0.7rem' }}>
              <div style={{ color: stat.color, fontWeight: 'bold', marginBottom: '2px' }}>{stat.icon} {stat.label}</div>
              <div style={{ color: '#9ca3af' }}>{stat.tooltip}</div>
            </div>
          }
        >
          <div 
            className="stat-card"
            style={{ 
              padding: isMobile ? '0.75rem 0.5rem' : '1rem', 
              textAlign: 'center',
              cursor: 'default',
              width: '100%'
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
          </div>
        </SmartTooltip>
      ))}
    </div>
  );
};

export default QuickStats;
