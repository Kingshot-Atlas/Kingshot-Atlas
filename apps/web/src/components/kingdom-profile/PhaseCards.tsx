import React from 'react';
import { useTranslation } from 'react-i18next';

interface KvKRecord {
  kvk_number: number;
  prep_result: string;
  battle_result: string;
  overall_result?: string;
}

interface PhaseCardsProps {
  prepWins: number;
  prepLosses: number;
  prepWinRate: number;
  prepBestStreak: number;
  battleWins: number;
  battleLosses: number;
  battleWinRate: number;
  battleBestStreak: number;
  recentKvks: KvKRecord[];
  isMobile: boolean;
}

const PhaseCards: React.FC<PhaseCardsProps> = ({
  prepWins,
  prepLosses,
  prepWinRate,
  prepBestStreak,
  battleWins,
  battleLosses,
  battleWinRate,
  battleBestStreak,
  recentKvks,
  isMobile,
}) => {
  const { t } = useTranslation();
  // Calculate current streaks
  const sortedKvks = [...recentKvks].sort((a, b) => b.kvk_number - a.kvk_number);
  
  // Filter out Byes - they don't affect streaks
  const isByeResult = (kvk: KvKRecord) => 
    kvk.prep_result?.toLowerCase() === 'bye' || 
    kvk.battle_result?.toLowerCase() === 'bye' || 
    kvk.overall_result?.toLowerCase() === 'bye';
  const nonByeKvks = sortedKvks.filter(kvk => !isByeResult(kvk));

  // Calculate prep streak
  let prepStreak = 0;
  let prepStreakType = '';
  for (const kvk of nonByeKvks) {
    const isWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
    if (prepStreak === 0) { prepStreakType = isWin ? 'W' : 'L'; prepStreak = 1; }
    else if ((isWin && prepStreakType === 'W') || (!isWin && prepStreakType === 'L')) { prepStreak++; }
    else break;
  }
  const showPrepStreak = prepStreak >= 2;

  // Calculate battle streak
  let battleStreak = 0;
  let battleStreakType = '';
  for (const kvk of nonByeKvks) {
    const isWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
    if (battleStreak === 0) { battleStreakType = isWin ? 'W' : 'L'; battleStreak = 1; }
    else if ((isWin && battleStreakType === 'W') || (!isWin && battleStreakType === 'L')) { battleStreak++; }
    else break;
  }
  const showBattleStreak = battleStreak >= 2;

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
      gap: isMobile ? '0.75rem' : '1rem', 
      marginBottom: isMobile ? '1.25rem' : '1.5rem' 
    }}>
      {/* Prep Phase Card */}
      <div className="phase-card" style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
        <h3 style={{ 
          color: '#eab308', 
          fontSize: isMobile ? '0.85rem' : '0.95rem', 
          fontWeight: '600', 
          margin: '0 0 0.75rem 0', 
          textAlign: 'center'
        }}>
          {t('kingdomProfile.prepPhase', 'Preparation Phase')}
        </h3>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          padding: '0 0.5rem'
        }}>
          {/* Wins column */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#22c55e', fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 'bold', lineHeight: 1 }}>{prepWins}</div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>{t('common.wins', 'Wins')}</div>
            {showPrepStreak && prepStreakType === 'W' && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ 
                  padding: '0.2rem 0.5rem', 
                  backgroundColor: '#22c55e15', 
                  borderRadius: '6px', 
                  fontSize: '0.7rem', 
                  color: '#22c55e', 
                  fontWeight: 'bold',
                  border: '1px solid #22c55e30'
                }}>
                  {prepStreak}W Streak
                </span>
              </div>
            )}
          </div>
          
          {/* Win Rate column */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ 
              fontSize: isMobile ? '1.5rem' : '1.75rem', 
              fontWeight: 'bold', 
              color: '#fff'
            }}>
              {Math.round(prepWinRate * 100)}%
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>{t('kingdomProfile.winRate', 'Win Rate')}</div>
            {prepBestStreak >= 3 && (
              <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                Best: {prepBestStreak}W
              </div>
            )}
          </div>
          
          {/* Losses column */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#ef4444', fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 'bold', lineHeight: 1 }}>{prepLosses}</div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>{t('common.losses', 'Losses')}</div>
            {showPrepStreak && prepStreakType === 'L' && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ 
                  padding: '0.2rem 0.5rem', 
                  backgroundColor: '#ef444415', 
                  borderRadius: '6px', 
                  fontSize: '0.7rem', 
                  color: '#ef4444', 
                  fontWeight: 'bold',
                  border: '1px solid #ef444430'
                }}>
                  {prepStreak}L Streak
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Battle Phase Card */}
      <div className="phase-card" style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
        <h3 style={{ 
          color: '#f97316', 
          fontSize: isMobile ? '0.85rem' : '0.95rem', 
          fontWeight: '600', 
          margin: '0 0 0.75rem 0', 
          textAlign: 'center'
        }}>
          {t('kingdomProfile.battlePhase', 'Battle Phase')}
        </h3>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          padding: '0 0.5rem'
        }}>
          {/* Wins column */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#22c55e', fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 'bold', lineHeight: 1 }}>{battleWins}</div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>{t('common.wins', 'Wins')}</div>
            {showBattleStreak && battleStreakType === 'W' && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ 
                  padding: '0.2rem 0.5rem', 
                  backgroundColor: '#22c55e15', 
                  borderRadius: '6px', 
                  fontSize: '0.7rem', 
                  color: '#22c55e', 
                  fontWeight: 'bold',
                  border: '1px solid #22c55e30'
                }}>
                  {battleStreak}W Streak
                </span>
              </div>
            )}
          </div>
          
          {/* Win Rate column */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ 
              fontSize: isMobile ? '1.5rem' : '1.75rem', 
              fontWeight: 'bold', 
              color: '#fff'
            }}>
              {Math.round(battleWinRate * 100)}%
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>{t('kingdomProfile.winRate', 'Win Rate')}</div>
            {battleBestStreak >= 3 && (
              <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                Best: {battleBestStreak}W
              </div>
            )}
          </div>
          
          {/* Losses column */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#ef4444', fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 'bold', lineHeight: 1 }}>{battleLosses}</div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>{t('common.losses', 'Losses')}</div>
            {showBattleStreak && battleStreakType === 'L' && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ 
                  padding: '0.2rem 0.5rem', 
                  backgroundColor: '#ef444415', 
                  borderRadius: '6px', 
                  fontSize: '0.7rem', 
                  color: '#ef4444', 
                  fontWeight: 'bold',
                  border: '1px solid #ef444430'
                }}>
                  {battleStreak}L Streak
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhaseCards;
