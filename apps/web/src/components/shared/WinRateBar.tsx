import React, { memo } from 'react';

interface WinRateBarProps {
  label: string;
  labelColor: string;
  winRate: number;
  wins: number;
  losses: number;
  streak: number;
  lossStreak: number;
  bestStreak: number;
  barColor: string;
}

const WinRateBar: React.FC<WinRateBarProps> = ({
  label,
  labelColor,
  winRate,
  wins,
  losses,
  streak,
  lossStreak,
  bestStreak,
  barColor
}) => {
  return (
    <div style={{ 
      backgroundColor: '#1a1a20',
      borderRadius: '10px',
      padding: '0.75rem',
      borderLeft: `3px solid ${barColor}`
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '0.5rem'
      }}>
        <span style={{ 
          fontSize: '0.7rem', 
          color: labelColor, 
          fontWeight: '600', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em' 
        }}>
          {label}
        </span>
        <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
          {Math.round(winRate * 100)}%
        </span>
      </div>
      <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.4rem' }}>
        {wins}W – {losses}L
        {streak >= 2 && (
          <span style={{ color: '#22c55e', marginLeft: '0.4rem', fontSize: '0.7rem' }}>
            ({streak}W Streak)
          </span>
        )}
        {streak < 2 && lossStreak >= 2 && (
          <span style={{ color: '#ef4444', marginLeft: '0.4rem', fontSize: '0.7rem' }}>
            ({lossStreak}L Streak)
          </span>
        )}
      </div>
      {bestStreak >= 3 && (
        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.3rem' }}>
          Best: {bestStreak}W
        </div>
      )}
      <div style={{ height: '4px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${winRate * 100}%`,
          backgroundColor: barColor,
          borderRadius: '2px',
          transition: 'width 0.5s ease'
        }} />
      </div>
    </div>
  );
};

export default memo(WinRateBar);
