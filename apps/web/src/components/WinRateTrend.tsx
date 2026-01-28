import React from 'react';
import { KVKRecord } from '../types';

interface WinRateTrendProps {
  records: KVKRecord[];
  type: 'prep' | 'battle';
}

const WinRateTrend: React.FC<WinRateTrendProps> = ({ records, type }) => {
  if (!records || records.length < 2) return null;

  const isWin = (result: string) => result === 'Win' || result === 'W';
  const last10 = records.slice(0, 10);
  const wins = last10.map(r => type === 'prep' ? isWin(r.prep_result) : isWin(r.battle_result));
  
  // Calculate trend (positive = improving, negative = declining)
  const recentWins = wins.slice(0, 5).filter(Boolean).length;
  const olderWins = wins.slice(5, 10).filter(Boolean).length;
  const trend = wins.length >= 5 ? recentWins - olderWins : 0;
  
  const color = type === 'prep' ? '#eab308' : '#3b82f6';
  const maxHeight = 20;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: maxHeight + 4 }}>
      {wins.reverse().map((won, i) => (
        <div
          key={i}
          style={{
            width: '4px',
            height: won ? `${maxHeight}px` : '6px',
            backgroundColor: won ? color : '#2a2a2a',
            borderRadius: '1px',
            transition: 'height 0.3s ease'
          }}
          title={`KvK ${last10.length - i}: ${won ? 'Win' : 'Loss'}`}
        />
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
