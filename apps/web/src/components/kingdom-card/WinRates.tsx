import React, { memo } from 'react';

interface WinRatesProps {
  prepWinRate: number;
  prepWins: number;
  prepLosses: number;
  prepStreak: number;
  prepLossStreak: number;
  prepBestStreak: number;
  battleWinRate: number;
  battleWins: number;
  battleLosses: number;
  battleStreak: number;
  battleLossStreak: number;
  battleBestStreak: number;
}

const WinRates: React.FC<WinRatesProps> = ({
  prepWinRate,
  prepWins,
  prepLosses,
  prepStreak,
  prepLossStreak,
  prepBestStreak,
  battleWinRate,
  battleWins,
  battleLosses,
  battleStreak,
  battleLossStreak,
  battleBestStreak
}) => {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '0.75rem',
      marginBottom: '1rem'
    }}>
      {/* Prep Phase */}
      <div style={{ 
        backgroundColor: '#1a1a20',
        borderRadius: '10px',
        padding: '0.75rem',
        borderLeft: '3px solid #eab308'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '0.5rem'
        }}>
          <span style={{ fontSize: '0.7rem', color: '#eab308', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prep</span>
          <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
            {Math.round(prepWinRate * 100)}%
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.4rem' }}>
          {prepWins}W – {prepLosses}L
          {prepStreak >= 2 && (
            <span style={{ color: '#22c55e', marginLeft: '0.4rem', fontSize: '0.7rem' }}>
              ({prepStreak}W Streak)
            </span>
          )}
          {prepStreak < 2 && prepLossStreak >= 2 && (
            <span style={{ color: '#ef4444', marginLeft: '0.4rem', fontSize: '0.7rem' }}>
              ({prepLossStreak}L Streak)
            </span>
          )}
        </div>
        {prepBestStreak >= 3 && (
          <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.3rem' }}>
            Best: {prepBestStreak}W
          </div>
        )}
        <div style={{ height: '4px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${prepWinRate * 100}%`,
            backgroundColor: '#eab308',
            borderRadius: '2px',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>
      
      {/* Battle Phase */}
      <div style={{ 
        backgroundColor: '#1a1a20',
        borderRadius: '10px',
        padding: '0.75rem',
        borderLeft: '3px solid #f97316'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '0.5rem'
        }}>
          <span style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Battle</span>
          <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
            {Math.round(battleWinRate * 100)}%
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.4rem' }}>
          {battleWins}W – {battleLosses}L
          {battleStreak >= 2 && (
            <span style={{ color: '#22c55e', marginLeft: '0.4rem', fontSize: '0.7rem' }}>
              ({battleStreak}W Streak)
            </span>
          )}
          {battleStreak < 2 && battleLossStreak >= 2 && (
            <span style={{ color: '#ef4444', marginLeft: '0.4rem', fontSize: '0.7rem' }}>
              ({battleLossStreak}L Streak)
            </span>
          )}
        </div>
        {battleBestStreak >= 3 && (
          <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.3rem' }}>
            Best: {battleBestStreak}W
          </div>
        )}
        <div style={{ height: '4px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${battleWinRate * 100}%`,
            backgroundColor: '#f97316',
            borderRadius: '2px',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>
    </div>
  );
};

export default memo(WinRates);
