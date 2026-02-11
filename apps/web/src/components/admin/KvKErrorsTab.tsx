import React from 'react';
import type { KvKError } from './types';
import { downloadCSV } from '../../utils/csvExport';

interface KvKErrorsTabProps {
  kvkErrors: KvKError[];
  filter: string;
  selectedItems: Set<string>;
  onReviewError: (id: string, status: 'approved' | 'rejected', notes?: string) => void;
  onRejectOpen: (id: string) => void;
  onSelectAllPending: () => void;
  onToggleItem: (id: string) => void;
  onBulkReview: (status: 'approved' | 'rejected') => void;
  onClearSelection: () => void;
}

export const KvKErrorsTab: React.FC<KvKErrorsTabProps> = ({
  kvkErrors, filter, selectedItems,
  onReviewError, onRejectOpen, onSelectAllPending,
  onToggleItem, onBulkReview, onClearSelection,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* CSV export */}
      {kvkErrors.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => downloadCSV(kvkErrors.map(e => ({ kingdom: e.kingdom_number, kvk: e.kvk_number, error_type: e.error_type_label, description: e.description, status: e.status, submitter: e.submitted_by_name, date: e.submitted_at })), 'kvk_errors')}
            style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#6b7280', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            📥 Export CSV
          </button>
        </div>
      )}
      {/* Bulk Actions Toolbar */}
      {filter === 'pending' && kvkErrors.some(e => e.status === 'pending') && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', backgroundColor: '#111116', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
          <button onClick={onSelectAllPending} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '6px', color: '#22d3ee', fontSize: '0.8rem', cursor: 'pointer' }}>
            Select All ({kvkErrors.filter(e => e.status === 'pending').length})
          </button>
          {selectedItems.size > 0 && (
            <>
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{selectedItems.size} selected</span>
              <button onClick={() => onBulkReview('approved')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ✓ Approve All
              </button>
              <button onClick={() => onBulkReview('rejected')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ✗ Reject All
              </button>
              <button onClick={onClearSelection} style={{ padding: '0.4rem 0.75rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '6px', color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer' }}>
                Clear
              </button>
            </>
          )}
        </div>
      )}
      {kvkErrors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          No {filter} KvK error reports
        </div>
      ) : (
        kvkErrors.map((error) => (
          <div key={error.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: selectedItems.has(error.id) ? '2px solid #22d3ee' : '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {error.status === 'pending' && (
                  <input type="checkbox" checked={selectedItems.has(error.id)} onChange={() => onToggleItem(error.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                )}
                <span style={{ color: '#22d3ee', fontWeight: 600 }}>K{error.kingdom_number}</span>
                {error.kvk_number && <span style={{ color: '#6b7280' }}> - KvK #{error.kvk_number}</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ 
                  padding: '0.2rem 0.5rem',
                  backgroundColor: '#ef444420',
                  color: '#ef4444',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600
                }}>
                  {error.error_type_label}
                </span>
                <div style={{ 
                  padding: '0.25rem 0.75rem',
                  backgroundColor: error.status === 'pending' ? '#fbbf2420' : error.status === 'approved' ? '#22c55e20' : '#ef444420',
                  color: error.status === 'pending' ? '#fbbf24' : error.status === 'approved' ? '#22c55e' : '#ef4444',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {error.status.toUpperCase()}
                </div>
              </div>
            </div>
            
            {error.current_data && (() => {
              const willFlipPrep = error.error_type === 'wrong_prep_result' || error.error_type === 'wrong_both_results';
              const willFlipBattle = error.error_type === 'wrong_battle_result' || error.error_type === 'wrong_both_results';
              const newPrep = willFlipPrep 
                ? (error.current_data.prep_result === 'Win' ? 'Loss' : 'Win')
                : error.current_data.prep_result;
              const newBattle = willFlipBattle
                ? (error.current_data.battle_result === 'Win' ? 'Loss' : 'Win')
                : error.current_data.battle_result;
              const prepWin = newPrep === 'Win';
              const battleWin = newBattle === 'Win';
              const newOverall = prepWin && battleWin ? 'Domination' 
                : !prepWin && battleWin ? 'Comeback'
                : prepWin && !battleWin ? 'Prep Only'
                : 'Invasion';
              
              return (
                <div style={{ 
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '8px',
                  border: '1px solid #1f1f1f'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#ef4444', fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 600 }}>❌ CURRENT (WRONG)</div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                        <div>
                          <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep</div>
                          <div style={{ 
                            color: error.current_data.prep_result === 'Win' ? '#22c55e' : '#ef4444',
                            textDecoration: willFlipPrep ? 'line-through' : 'none',
                            opacity: willFlipPrep ? 0.5 : 1
                          }}>
                            {error.current_data.prep_result === 'Win' ? 'W' : 'L'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle</div>
                          <div style={{ 
                            color: error.current_data.battle_result === 'Win' ? '#22c55e' : '#ef4444',
                            textDecoration: willFlipBattle ? 'line-through' : 'none',
                            opacity: willFlipBattle ? 0.5 : 1
                          }}>
                            {error.current_data.battle_result === 'Win' ? 'W' : 'L'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ color: '#22d3ee', fontSize: '1.5rem', fontWeight: 700 }}>→</div>
                    
                    <div>
                      <div style={{ color: '#22c55e', fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 600 }}>✓ AFTER APPROVAL</div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                        <div>
                          <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep</div>
                          <div style={{ 
                            color: newPrep === 'Win' ? '#22c55e' : '#ef4444',
                            fontWeight: willFlipPrep ? 700 : 400
                          }}>
                            {newPrep === 'Win' ? 'W' : 'L'}
                            {willFlipPrep && <span style={{ color: '#fbbf24', marginLeft: '0.25rem' }}>⚡</span>}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle</div>
                          <div style={{ 
                            color: newBattle === 'Win' ? '#22c55e' : '#ef4444',
                            fontWeight: willFlipBattle ? 700 : 400
                          }}>
                            {newBattle === 'Win' ? 'W' : 'L'}
                            {willFlipBattle && <span style={{ color: '#fbbf24', marginLeft: '0.25rem' }}>⚡</span>}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Result</div>
                          <div style={{ 
                            color: newOverall === 'Domination' ? '#22c55e' : newOverall === 'Invasion' ? '#ef4444' : '#fbbf24',
                            fontWeight: 600,
                            fontSize: '0.75rem'
                          }}>
                            {newOverall}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #1f1f1f', color: '#6b7280', fontSize: '0.75rem' }}>
                    vs <span style={{ color: '#22d3ee' }}>K{error.current_data.opponent}</span>
                    {' '}• Also updates K{error.current_data.opponent}&apos;s record (inverse)
                  </div>
                </div>
              );
            })()}

            <div style={{ color: '#fff', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#1a1a20', borderRadius: '6px' }}>
              <span style={{ color: '#6b7280' }}>Description: </span>
              {error.description}
            </div>

            {error.review_notes && (
              <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee30', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '0.7rem' }}>ADMIN NOTE: </span>
                <span style={{ color: '#9ca3af' }}>{error.review_notes}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                By {error.submitted_by_name} • {new Date(error.submitted_at).toLocaleDateString()}
              </div>
              
              {error.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => onReviewError(error.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Approve
                  </button>
                  <button onClick={() => onRejectOpen(error.id)} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default KvKErrorsTab;
