import React, { useState, memo } from 'react';
import { KVKRecord } from '../../types';
import { getOutcome, OUTCOMES } from '../../utils/outcomes';

interface RecentKvKsProps {
  recentKvks: KVKRecord[];
}

const RecentKvKs: React.FC<RecentKvKsProps> = ({ recentKvks }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Sort by kvk_number ascending (chronological order: oldest first)
  const sortedKvks = [...recentKvks].sort((a, b) => a.kvk_number - b.kvk_number);
  // Get last 5 for display (most recent 5, but in chronological order)
  const recentResults = sortedKvks.slice(-5);

  const isWinResult = (r: string) => r === 'Win' || r === 'W';

  if (recentResults.length === 0) {
    return (
      <span style={{ fontSize: '0.75rem', color: '#3a3a3a', fontStyle: 'italic' }}>
        No KvK history yet
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {recentResults.map((kvk, index) => {
        const isByeResult = kvk.overall_result?.toLowerCase() === 'bye' || kvk.prep_result === null || kvk.battle_result === null || kvk.opponent_kingdom === 0 || kvk.prep_result === 'B' || kvk.battle_result === 'B';
        
        // Override outcome info for Bye results
        const byeInfo = { name: 'Bye', abbrev: '⏸️', color: '#6b7280', bgColor: '#6b728020', description: 'No opponent this round' };
        const outcome = isByeResult ? 'Bye' : getOutcome(kvk.prep_result, kvk.battle_result);
        const outcomeInfo = isByeResult ? byeInfo : OUTCOMES[outcome];
        
        const prepDisplay = isByeResult ? '-' : (isWinResult(kvk.prep_result) ? 'W' : 'L');
        const battleDisplay = isByeResult ? '-' : (isWinResult(kvk.battle_result) ? 'W' : 'L');
        
        return (
          <div
            key={kvk.id || index}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
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
              transform: hoveredIndex === index ? 'scale(1.15)' : 'scale(1)',
              boxShadow: hoveredIndex === index ? `0 0 12px ${outcomeInfo.color}50` : 'none'
            }}>
              {outcomeInfo.abbrev}
            </div>
            
            {hoveredIndex === index && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${outcomeInfo.color}`,
                borderRadius: '8px',
                padding: '0.6rem 0.8rem',
                minWidth: '150px',
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                animation: 'fadeIn 0.15s ease'
              }}>
                <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
                  KvK #{kvk.kvk_number} {isByeResult ? '' : `vs K${kvk.opponent_kingdom}`}
                </div>
                {isByeResult ? (
                  <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                    No match
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '0.4rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '2px' }}>Prep</div>
                      <div style={{ fontWeight: 'bold', color: isWinResult(kvk.prep_result) ? '#22c55e' : '#ef4444' }}>{prepDisplay}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '2px' }}>Battle</div>
                      <div style={{ fontWeight: 'bold', color: isWinResult(kvk.battle_result) ? '#22c55e' : '#ef4444' }}>{battleDisplay}</div>
                    </div>
                  </div>
                )}
                <div style={{ 
                  textAlign: 'center', 
                  paddingTop: '0.4rem', 
                  borderTop: '1px solid #2a2a2a',
                  color: outcomeInfo.color,
                  fontWeight: '600',
                  fontSize: '0.75rem'
                }}>
                  {outcomeInfo.name}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default memo(RecentKvKs);
