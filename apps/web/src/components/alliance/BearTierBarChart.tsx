import React from 'react';
import { BEAR_TIER_COLORS } from '../../data/bearHuntData';

// ─── Bear Tier Bar Chart (color-coded per tier) ───
const BearTierBarChart: React.FC<{ data: [string, number][]; isMobile: boolean }> = ({ data, isMobile }) => {
  const max = Math.max(...data.map(d => d[1]), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      {data.map(([label, count]) => {
        const color = BEAR_TIER_COLORS[label as keyof typeof BEAR_TIER_COLORS] ?? '#6b7280';
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color, fontSize: '0.65rem', fontWeight: 800, width: isMobile ? '52px' : '60px', textAlign: 'right', flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: '14px', backgroundColor: '#1a1a20', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(count / max) * 100}%`, backgroundColor: color, borderRadius: '3px', opacity: 0.75, minWidth: '2px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ color: '#e5e7eb', fontSize: '0.65rem', fontWeight: 700, width: '22px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
};

export default BearTierBarChart;
