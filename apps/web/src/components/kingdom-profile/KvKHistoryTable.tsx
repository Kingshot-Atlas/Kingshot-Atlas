import React from 'react';
import { useNavigate } from 'react-router-dom';
import MissingKvKPrompt from '../MissingKvKPrompt';
import SmartTooltip from '../shared/SmartTooltip';
import { getOutcome, OUTCOMES } from '../../utils/outcomes';
import { CURRENT_KVK } from '../../constants';
import { useTranslation } from 'react-i18next';

interface KvKRecord {
  kvk_number: number;
  opponent_kingdom: number;
  prep_result: string;
  battle_result: string;
  overall_result?: string;
}

interface KvKHistoryTableProps {
  kingdomNumber: number;
  kvkRecords: KvKRecord[];
  isMobile: boolean;
  onReportErrorClick: () => void;
}

const KvKHistoryTable: React.FC<KvKHistoryTableProps> = ({
  kingdomNumber,
  kvkRecords,
  isMobile,
  onReportErrorClick,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Sort by kvk_number descending (most recent first)
  const allKvks = [...kvkRecords].sort((a, b) => b.kvk_number - a.kvk_number);

  const getOutcomeStyle = (prepResult: string, battleResult: string) => {
    const outcome = getOutcome(prepResult, battleResult);
    const info = OUTCOMES[outcome];
    return { bg: info.bgColor, text: info.color, label: info.name, description: info.description };
  };

  const getOutcomeLetter = (prepResult: string, battleResult: string) => {
    const outcome = getOutcome(prepResult, battleResult);
    return OUTCOMES[outcome].abbrev;
  };

  const isWin = (r: string) => r === 'Win' || r === 'W';

  if (allKvks.length === 0) {
    return null;
  }

  return (
    <div style={{ 
      backgroundColor: '#131318', 
      borderRadius: '12px', 
      padding: isMobile ? '1rem' : '1.25rem', 
      border: '1px solid #2a2a2a',
      marginBottom: isMobile ? '1.25rem' : '1.5rem',
      overflow: 'visible',
      position: 'relative'
    }}>
      <h3 style={{ color: '#fff', fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '600', margin: '0 0 0.5rem 0', textAlign: 'center' }}>
        {t('kingdomProfile.kvkHistory', 'KvK History')}
      </h3>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <button
          onClick={onReportErrorClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: isMobile ? '0.5rem 0.85rem' : '0.3rem 0.6rem',
            minHeight: isMobile ? '44px' : 'auto',
            backgroundColor: '#ef444415',
            border: '1px solid #ef444430',
            borderRadius: '6px',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: isMobile ? '0.75rem' : '0.7rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ef444425';
            e.currentTarget.style.borderColor = '#ef444450';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ef444415';
            e.currentTarget.style.borderColor = '#ef444430';
          }}
        >
          {t('kingdomProfile.reportError', 'Report Error')}
        </button>
      </div>
      
      {/* Missing Latest KvK Prompt */}
      <MissingKvKPrompt
        kingdomNumber={kingdomNumber}
        kvkNumber={CURRENT_KVK}
        existingKvkNumbers={allKvks.map(k => k.kvk_number)}
      />
      
      {/* KvK Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'auto' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
              <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>{t('kingdomProfile.kvkNum', 'KvK #')}</th>
              <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>{t('kingdomProfile.opponent', 'Opponent')}</th>
              <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>{t('kingdomProfile.prep', 'Prep')}</th>
              <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>{t('kingdomProfile.battle', 'Battle')}</th>
              <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>{t('kingdomProfile.result', 'Result')}</th>
            </tr>
          </thead>
          <tbody>
            {allKvks.map((kvk, index) => {
              const isByeResult = kvk.overall_result?.toLowerCase() === 'bye' || kvk.prep_result === null || kvk.battle_result === null || kvk.opponent_kingdom === 0 || kvk.prep_result === 'B' || kvk.battle_result === 'B';
              
              // Override outcome style and letter for Bye results
              const byeStyle = { bg: '#6b728020', text: '#6b7280', label: 'Bye', description: 'No opponent this round' };
              const outcomeStyle = isByeResult ? byeStyle : getOutcomeStyle(kvk.prep_result, kvk.battle_result);
              const outcomeLetter = isByeResult ? '⏸️' : getOutcomeLetter(kvk.prep_result, kvk.battle_result);
              
              return (
                <tr 
                  key={index} 
                  style={{ 
                    backgroundColor: index % 2 === 0 ? '#0a0a0a' : 'transparent',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#151520'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#0a0a0a' : 'transparent'}
                >
                  <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.85rem', textAlign: 'center' }}>
                    {kvk.kvk_number}
                  </td>
                  <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', textAlign: 'center' }}>
                    {isByeResult ? (
                      <span style={{ 
                        color: '#6b7280', 
                        fontSize: isMobile ? '0.75rem' : '0.85rem',
                        fontStyle: 'italic'
                      }}>
                        {t('kingdomProfile.noMatch', 'No match')}
                      </span>
                    ) : (
                      <span 
                        onClick={() => navigate(`/kingdom/${kvk.opponent_kingdom}`)}
                        style={{ 
                          color: '#22d3ee', 
                          cursor: 'pointer',
                          fontSize: isMobile ? '0.75rem' : '0.85rem',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {`${t('common.kingdom', 'Kingdom')} ${kvk.opponent_kingdom}`}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ 
                      color: isByeResult ? '#6b7280' : (isWin(kvk.prep_result) ? '#22c55e' : '#ef4444'), 
                      fontWeight: '600',
                      fontSize: isMobile ? '0.75rem' : '0.85rem'
                    }}>
                      {isByeResult ? '-' : (isWin(kvk.prep_result) ? 'W' : 'L')}
                    </span>
                  </td>
                  <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ 
                      color: isByeResult ? '#6b7280' : (isWin(kvk.battle_result) ? '#22c55e' : '#ef4444'), 
                      fontWeight: '600',
                      fontSize: isMobile ? '0.75rem' : '0.85rem'
                    }}>
                      {isByeResult ? '-' : (isWin(kvk.battle_result) ? 'W' : 'L')}
                    </span>
                  </td>
                  <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', textAlign: 'center' }}>
                    <SmartTooltip
                      accentColor={outcomeStyle.text}
                      content={
                        <div style={{ fontSize: '0.7rem' }}>
                          <div style={{ fontWeight: 'bold', color: outcomeStyle.text, marginBottom: '2px' }}>{outcomeStyle.label}</div>
                          <div style={{ color: '#9ca3af' }}>{outcomeStyle.description}</div>
                        </div>
                      }
                    >
                      <span 
                        style={{
                          display: 'inline-block',
                          padding: isMobile ? '0.2rem 0.4rem' : '0.25rem 0.6rem',
                          borderRadius: '6px',
                          backgroundColor: outcomeStyle.bg,
                          border: `1px solid ${outcomeStyle.text}40`,
                          color: outcomeStyle.text,
                          fontSize: isMobile ? '0.7rem' : '0.8rem',
                          fontWeight: 'bold',
                          cursor: 'default',
                          boxShadow: `0 0 6px ${outcomeStyle.text}20`
                        }}
                      >
                        {outcomeLetter}
                      </span>
                    </SmartTooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Showing count at bottom right */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
          {t('kingdomProfile.showingKvks', 'Showing {{count}} of {{total}} KvKs', { count: allKvks.length, total: allKvks.length })}
        </span>
      </div>
    </div>
  );
};

export default KvKHistoryTable;
