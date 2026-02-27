import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
          <span style={{ fontSize: '0.7rem', color: '#eab308', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('kingdomCard.prep')}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
            {Math.round(prepWinRate * 100)}%
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.25rem' }}>
          {prepWins}{t('stats.winAbbrev', 'W')} – {prepLosses}{t('stats.lossAbbrev', 'L')}
        </div>
        {prepStreak >= 2 && (
          <div style={{ fontSize: '0.7rem', color: '#22c55e', marginBottom: '0.25rem' }}>
            {t('stats.currentStreak')}: {prepStreak}{t('stats.winAbbrev', 'W')}
          </div>
        )}
        {prepStreak < 2 && prepLossStreak >= 2 && (
          <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '0.25rem' }}>
            {t('stats.currentStreak')}: {prepLossStreak}{t('stats.lossAbbrev', 'L')}
          </div>
        )}
        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.3rem' }}>
          {t('stats.bestStreak')}: {prepBestStreak}{t('stats.winAbbrev', 'W')}
        </div>
        <div style={{ height: '5px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
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
          <span style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('kingdomCard.battle')}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
            {Math.round(battleWinRate * 100)}%
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.25rem' }}>
          {battleWins}{t('stats.winAbbrev', 'W')} – {battleLosses}{t('stats.lossAbbrev', 'L')}
        </div>
        {battleStreak >= 2 && (
          <div style={{ fontSize: '0.7rem', color: '#22c55e', marginBottom: '0.25rem' }}>
            {t('stats.currentStreak')}: {battleStreak}{t('stats.winAbbrev', 'W')}
          </div>
        )}
        {battleStreak < 2 && battleLossStreak >= 2 && (
          <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '0.25rem' }}>
            {t('stats.currentStreak')}: {battleLossStreak}{t('stats.lossAbbrev', 'L')}
          </div>
        )}
        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.3rem' }}>
          {t('stats.bestStreak')}: {battleBestStreak}{t('stats.winAbbrev', 'W')}
        </div>
        <div style={{ height: '5px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
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
