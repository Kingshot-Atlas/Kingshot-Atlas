import React, { memo } from 'react';
import { KVKRecord } from '../../types';
import { getOutcome, OUTCOMES } from '../../utils/outcomes';
import SmartTooltip from '../shared/SmartTooltip';
import { useTranslation } from 'react-i18next';

interface RecentKvKsProps {
  recentKvks: KVKRecord[];
}

const RecentKvKs: React.FC<RecentKvKsProps> = ({ recentKvks }) => {
  const { t } = useTranslation();
  // Sort by kvk_number ascending (chronological order: oldest first)
  const sortedKvks = [...recentKvks].sort((a, b) => a.kvk_number - b.kvk_number);
  // Get last 5 for display (most recent 5, but in chronological order)
  const recentResults = sortedKvks.slice(-5);

  const isWinResult = (r: string | null) => r === 'Win' || r === 'W';

  if (recentResults.length === 0) {
    return (
      <span style={{ fontSize: '0.75rem', color: '#3a3a3a', fontStyle: 'italic' }}>
        {t('kingdomCard.noKvKHistory')}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {recentResults.map((kvk, index) => {
        // Pending: has opponent but missing results (incomplete matchup)
        const isPending = kvk.overall_result?.toLowerCase() === 'pending' ||
          (kvk.opponent_kingdom > 0 && (kvk.prep_result === null || kvk.battle_result === null) && kvk.prep_result !== 'B' && kvk.battle_result !== 'B');
        const isByeResult = !isPending && (
          kvk.overall_result?.toLowerCase() === 'bye' || kvk.opponent_kingdom === 0 || kvk.prep_result === 'B' || kvk.battle_result === 'B'
        );
        const noResults = isPending || isByeResult;
        
        // Override outcome info for Bye/Pending results
        const pendingInfo = { name: 'Pending', abbrev: '⏳', color: '#eab308', bgColor: '#eab30820', description: t('outcomes.pendingDesc', 'Results not yet reported') };
        const byeInfo = { name: 'Bye', abbrev: '⏸️', color: '#6b7280', bgColor: '#6b728020', description: 'No opponent this round' };
        const outcome = noResults ? (isPending ? 'Bye' : 'Bye') : getOutcome(kvk.prep_result!, kvk.battle_result!);
        const outcomeInfo = isPending ? pendingInfo : isByeResult ? byeInfo : OUTCOMES[outcome];
        
        const prepDisplay = noResults ? '-' : (isWinResult(kvk.prep_result) ? 'W' : 'L');
        const battleDisplay = noResults ? '-' : (isWinResult(kvk.battle_result) ? 'W' : 'L');
        
        const tooltipContent = (
          <div style={{ minWidth: '120px' }}>
            <div style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold', marginBottom: '0.35rem', textAlign: 'center' }}>
              KvK #{kvk.kvk_number} {isByeResult ? '' : `vs K${kvk.opponent_kingdom}`}
            </div>
            {isByeResult ? (
              <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.7rem' }}>{t('outcomes.noMatch', 'No match')}</div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '0.3rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>{t('kingdomCard.prep')}</div>
                  <div style={{ fontWeight: 'bold', color: isWinResult(kvk.prep_result) ? '#22c55e' : '#ef4444' }}>{prepDisplay}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>{t('kingdomCard.battle')}</div>
                  <div style={{ fontWeight: 'bold', color: isWinResult(kvk.battle_result) ? '#22c55e' : '#ef4444' }}>{battleDisplay}</div>
                </div>
              </div>
            )}
            <div style={{ 
              textAlign: 'center', 
              paddingTop: '0.3rem', 
              borderTop: '1px solid #2a2a2a',
              color: outcomeInfo.color,
              fontWeight: '600',
              fontSize: '0.7rem'
            }}>
              {t(`outcomes.${outcome}`, outcomeInfo.name)}
            </div>
          </div>
        );

        return (
          <SmartTooltip
            key={kvk.id || index}
            accentColor={outcomeInfo.color}
            maxWidth={180}
            content={tooltipContent}
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: outcomeInfo.bgColor,
              border: `1px solid ${outcomeInfo.color}50`,
              color: outcomeInfo.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}>
              {outcomeInfo.abbrev}
            </div>
          </SmartTooltip>
        );
      })}
    </div>
  );
};

export default memo(RecentKvKs);
