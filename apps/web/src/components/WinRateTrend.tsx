import React, { useState } from 'react';
import { KVKRecord } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

interface WinRateTrendProps {
  records: KVKRecord[];
  type: 'prep' | 'battle';
}

const WinRateTrend: React.FC<WinRateTrendProps> = ({ records, type }) => {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const isMobile = useIsMobile();
  
  if (!records || records.length < 2) return null;

  const isWin = (result: string | null) => result === 'Win' || result === 'W';
  const last10 = records.filter(r => r.prep_result !== null && r.battle_result !== null).slice(0, 10);
  const wins = last10.map(r => type === 'prep' ? isWin(r.prep_result) : isWin(r.battle_result));
  
  // Calculate trend (positive = improving, negative = declining)
  const recentWins = wins.slice(0, 5).filter(Boolean).length;
  const olderWins = wins.slice(5, 10).filter(Boolean).length;
  const trend = wins.length >= 5 ? recentWins - olderWins : 0;
  
  const color = type === 'prep' ? '#eab308' : '#3b82f6';
  const maxHeight = 20;
  const reversedWins = [...wins].reverse();

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: maxHeight + 4, position: 'relative' }}>
      {reversedWins.map((won, i) => (
        <div
          key={i}
          style={{
            width: '4px',
            height: won ? `${maxHeight}px` : '6px',
            backgroundColor: won ? color : '#2a2a2a',
            borderRadius: '1px',
            transition: 'height 0.3s ease',
            cursor: 'default',
            position: 'relative'
          }}
          onMouseEnter={() => !isMobile && setHoveredBar(i)}
          onMouseLeave={() => !isMobile && setHoveredBar(null)}
          onClick={() => isMobile && setHoveredBar(hoveredBar === i ? null : i)}
        >
          {hoveredBar === i && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '6px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${won ? color : '#6b7280'}`,
              borderRadius: '6px',
              padding: '0.3rem 0.5rem',
              whiteSpace: 'nowrap',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              fontSize: '0.65rem',
              color: won ? color : '#9ca3af'
            }}>
              KvK {last10.length - i}: {won ? 'Win' : 'Loss'}
            </div>
          )}
        </div>
      ))}
      {trend !== 0 && (
        <span style={{ 
          fontSize: '0.65rem', 
          marginLeft: '4px',
          color: trend > 0 ? '#22c55e' : '#ef4444'
        }}>
          {trend > 0 ? '↑' : '↓'}
        </span>
      )}
    </div>
  );
};

export default WinRateTrend;
