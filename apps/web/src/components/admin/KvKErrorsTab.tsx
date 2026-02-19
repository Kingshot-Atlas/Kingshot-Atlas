import React from 'react';
import type { KvKError } from './types';
import { useTranslation } from 'react-i18next';
import { downloadCSV } from '../../utils/csvExport';
import { colors } from '../../utils/styles';

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
  const { t: _t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* CSV export */}
      {kvkErrors.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => downloadCSV(kvkErrors.map(e => ({ kingdom: e.kingdom_number, kvk: e.kvk_number, error_type: e.error_type_label, description: e.description, status: e.status, submitter: e.submitted_by_name, date: e.submitted_at })), 'kvk_errors')}
            style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            📥 Export CSV
          </button>
        </div>
      )}
      {/* Bulk Actions Toolbar */}
      {filter === 'pending' && kvkErrors.some(e => e.status === 'pending') && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', backgroundColor: colors.cardAlt, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
          <button onClick={onSelectAllPending} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.primary}20`, border: `1px solid ${colors.primary}50`, borderRadius: '6px', color: colors.primary, fontSize: '0.8rem', cursor: 'pointer' }}>
            Select All ({kvkErrors.filter(e => e.status === 'pending').length})
          </button>
          {selectedItems.size > 0 && (
            <>
              <span style={{ color: colors.textSecondary, fontSize: '0.8rem' }}>{selectedItems.size} selected</span>
              <button onClick={() => onBulkReview('approved')} style={{ padding: '0.4rem 0.75rem', backgroundColor: colors.success, border: 'none', borderRadius: '6px', color: colors.text, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ✓ Approve All
              </button>
              <button onClick={() => onBulkReview('rejected')} style={{ padding: '0.4rem 0.75rem', backgroundColor: colors.error, border: 'none', borderRadius: '6px', color: colors.text, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ✗ Reject All
              </button>
              <button onClick={onClearSelection} style={{ padding: '0.4rem 0.75rem', backgroundColor: 'transparent', border: `1px solid ${colors.borderStrong}`, borderRadius: '6px', color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer' }}>
                Clear
              </button>
            </>
          )}
        </div>
      )}
      {kvkErrors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
          No {filter} KvK error reports
        </div>
      ) : (
        kvkErrors.map((error) => (
          <div key={error.id} style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: selectedItems.has(error.id) ? `2px solid ${colors.primary}` : `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {error.status === 'pending' && (
                  <input type="checkbox" checked={selectedItems.has(error.id)} onChange={() => onToggleItem(error.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                )}
                <span style={{ color: colors.primary, fontWeight: 600 }}>K{error.kingdom_number}</span>
                {error.kvk_number && <span style={{ color: colors.textMuted }}> - KvK #{error.kvk_number}</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ 
                  padding: '0.2rem 0.5rem',
                  backgroundColor: `${colors.error}20`,
                  color: colors.error,
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600
                }}>
                  {error.error_type_label}
                </span>
                <div style={{ 
                  padding: '0.25rem 0.75rem',
                  backgroundColor: error.status === 'pending' ? `${colors.gold}20` : error.status === 'approved' ? `${colors.success}20` : `${colors.error}20`,
                  color: error.status === 'pending' ? colors.gold : error.status === 'approved' ? colors.success : colors.error,
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {error.status.toUpperCase()}
                </div>
              </div>
            </div>
            
            {/* Correction preview */}
            {(() => {
              const cd = error.current_data;
              const corr = error.corrected_data;
              const flipR = (r: string) => r === 'W' || r === 'Win' ? 'L' : r === 'L' || r === 'Loss' ? 'W' : r;
              const normR = (r: string) => r === 'Win' ? 'W' : r === 'Loss' ? 'L' : r;
              const colorR = (r: string) => r === 'W' || r === 'Win' ? colors.success : r === 'L' || r === 'Loss' ? colors.error : colors.textMuted;
              const isFlip = error.error_type === 'wrong_prep_result' || error.error_type === 'wrong_battle_result' || error.error_type === 'wrong_both_results';

              // For flip types with current_data
              if (isFlip && cd) {
                const willFlipPrep = error.error_type === 'wrong_prep_result' || error.error_type === 'wrong_both_results';
                const willFlipBattle = error.error_type === 'wrong_battle_result' || error.error_type === 'wrong_both_results';
                const newPrep = willFlipPrep ? flipR(cd.prep_result) : normR(cd.prep_result);
                const newBattle = willFlipBattle ? flipR(cd.battle_result) : normR(cd.battle_result);
                return (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: colors.bg, borderRadius: '8px', border: `1px solid ${colors.borderSubtle}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: colors.error, fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 600 }}>❌ CURRENT</div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                          <div><div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Prep</div><div style={{ color: colorR(cd.prep_result), textDecoration: willFlipPrep ? 'line-through' : 'none', opacity: willFlipPrep ? 0.5 : 1 }}>{normR(cd.prep_result)}</div></div>
                          <div><div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Battle</div><div style={{ color: colorR(cd.battle_result), textDecoration: willFlipBattle ? 'line-through' : 'none', opacity: willFlipBattle ? 0.5 : 1 }}>{normR(cd.battle_result)}</div></div>
                        </div>
                      </div>
                      <div style={{ color: colors.primary, fontSize: '1.5rem', fontWeight: 700 }}>→</div>
                      <div>
                        <div style={{ color: colors.success, fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 600 }}>✓ AFTER APPROVAL</div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                          <div><div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Prep</div><div style={{ color: colorR(newPrep), fontWeight: willFlipPrep ? 700 : 400 }}>{newPrep}{willFlipPrep && <span style={{ color: colors.gold, marginLeft: '0.25rem' }}>⚡</span>}</div></div>
                          <div><div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Battle</div><div style={{ color: colorR(newBattle), fontWeight: willFlipBattle ? 700 : 400 }}>{newBattle}{willFlipBattle && <span style={{ color: colors.gold, marginLeft: '0.25rem' }}>⚡</span>}</div></div>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: `1px solid ${colors.borderSubtle}`, color: colors.textMuted, fontSize: '0.75rem' }}>
                      vs <span style={{ color: colors.primary }}>K{cd.opponent}</span> • Also updates K{cd.opponent}&apos;s record (inverse)
                    </div>
                  </div>
                );
              }

              // For wrong_opponent
              if (error.error_type === 'wrong_opponent' && cd && corr?.opponent !== undefined) {
                return (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: colors.bg, borderRadius: '8px', border: `1px solid ${colors.borderSubtle}` }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: colors.textMuted }}>Opponent:</span>
                      <span style={{ color: colors.error, textDecoration: 'line-through', opacity: 0.5 }}>{cd.opponent === 0 ? 'Bye' : `K${cd.opponent}`}</span>
                      <span style={{ color: colors.primary, fontWeight: 700 }}>→</span>
                      <span style={{ color: colors.success, fontWeight: 700 }}>{corr.opponent === 0 ? 'Bye' : `K${corr.opponent}`}</span>
                    </div>
                  </div>
                );
              }

              // For missing_kvk or everything_wrong with corrected_data
              if ((error.error_type === 'missing_kvk' || error.error_type === 'everything_wrong') && corr?.opponent !== undefined && corr.prep_result && corr.battle_result) {
                return (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: colors.bg, borderRadius: '8px', border: `1px solid ${colors.borderSubtle}` }}>
                    {cd && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ color: colors.error, fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 600 }}>❌ CURRENT</div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: colors.textMuted }}>
                          <span>vs {cd.opponent === 0 ? 'Bye' : `K${cd.opponent}`}</span>
                          <span>Prep: {normR(cd.prep_result)}</span>
                          <span>Battle: {normR(cd.battle_result)}</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ color: colors.success, fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 600 }}>{error.error_type === 'missing_kvk' ? '+ NEW RECORD' : '✓ CORRECTED'}</div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                        <span>vs <span style={{ color: colors.primary, fontWeight: 600 }}>{corr.opponent === 0 ? 'Bye' : `K${corr.opponent}`}</span></span>
                        <span>Prep: <span style={{ color: colorR(corr.prep_result), fontWeight: 600 }}>{corr.prep_result}</span></span>
                        <span>Battle: <span style={{ color: colorR(corr.battle_result), fontWeight: 600 }}>{corr.battle_result}</span></span>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            <div style={{ color: colors.text, fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: colors.surfaceHover, borderRadius: '6px' }}>
              <span style={{ color: colors.textMuted }}>Description: </span>
              {error.description}
            </div>

            {error.review_notes && (
              <div style={{ padding: '0.5rem 0.75rem', backgroundColor: `${colors.primary}10`, border: `1px solid ${colors.primary}30`, borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <span style={{ color: colors.primary, fontWeight: 600, fontSize: '0.7rem' }}>ADMIN NOTE: </span>
                <span style={{ color: colors.textSecondary }}>{error.review_notes}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.border}`, paddingTop: '1rem' }}>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                By {error.submitted_by_name} • {new Date(error.submitted_at).toLocaleDateString()}
              </div>
              
              {error.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => onReviewError(error.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: colors.success, color: colors.text, border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Approve
                  </button>
                  <button onClick={() => onRejectOpen(error.id)} style={{ padding: '0.5rem 1rem', backgroundColor: colors.error, color: colors.text, border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
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
