import React from 'react';
import type { DataCorrection } from './types';
import { downloadCSV } from '../../utils/csvExport';
import { colors } from '../../utils/styles';

interface CorrectionsTabProps {
  corrections: DataCorrection[];
  filter: string;
  selectedItems: Set<string>;
  onReviewCorrection: (id: string, status: 'approved' | 'rejected', notes?: string) => void;
  onRejectOpen: (id: string) => void;
  onSelectAllPending: () => void;
  onToggleItem: (id: string) => void;
  onBulkReview: (status: 'approved' | 'rejected') => void;
  onClearSelection: () => void;
}

export const CorrectionsTab: React.FC<CorrectionsTabProps> = ({
  corrections, filter, selectedItems,
  onReviewCorrection, onRejectOpen, onSelectAllPending,
  onToggleItem, onBulkReview, onClearSelection,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* CSV export */}
      {corrections.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => downloadCSV(corrections.map(c => ({ kingdom: c.kingdom_number, field: c.field, current: c.current_value, suggested: c.suggested_value, status: c.status, submitter: c.submitter_name, date: c.created_at, reason: c.reason || '' })), 'corrections')}
            style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            📥 Export CSV
          </button>
        </div>
      )}
      {/* Bulk Actions Toolbar */}
      {filter === 'pending' && corrections.some(c => c.status === 'pending') && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', backgroundColor: colors.cardAlt, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
          <button onClick={onSelectAllPending} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.primary}20`, border: `1px solid ${colors.primary}50`, borderRadius: '6px', color: colors.primary, fontSize: '0.8rem', cursor: 'pointer' }}>
            Select All ({corrections.filter(c => c.status === 'pending').length})
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
      {corrections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
          No {filter} data corrections
        </div>
      ) : (
        corrections.map((correction) => (
          <div key={correction.id} style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: selectedItems.has(correction.id) ? `2px solid ${colors.primary}` : `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {correction.status === 'pending' && (
                  <input type="checkbox" checked={selectedItems.has(correction.id)} onChange={() => onToggleItem(correction.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                )}
                <span style={{ color: colors.primary, fontWeight: 600 }}>K{correction.kingdom_number} - {correction.field}</span>
              </div>
              <div style={{ 
                padding: '0.25rem 0.75rem',
                backgroundColor: correction.status === 'pending' ? `${colors.gold}20` : correction.status === 'approved' ? `${colors.success}20` : `${colors.error}20`,
                color: correction.status === 'pending' ? colors.gold : correction.status === 'approved' ? colors.success : colors.error,
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                {correction.status.toUpperCase()}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>Current: </span>
                <span style={{ color: colors.error }}>{correction.current_value}</span>
              </div>
              <div>
                <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>Suggested: </span>
                <span style={{ color: colors.success }}>{correction.suggested_value}</span>
              </div>
            </div>

            {correction.reason && (
              <div style={{ color: colors.textSecondary, fontSize: '0.875rem', marginBottom: '1rem' }}>
                Reason: {correction.reason}
              </div>
            )}

            {correction.review_notes && (
              <div style={{ padding: '0.5rem 0.75rem', backgroundColor: `${colors.primary}10`, border: `1px solid ${colors.primary}30`, borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <span style={{ color: colors.primary, fontWeight: 600, fontSize: '0.7rem' }}>ADMIN NOTE: </span>
                <span style={{ color: colors.textSecondary }}>{correction.review_notes}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.border}`, paddingTop: '1rem' }}>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                By {correction.submitter_name} • {new Date(correction.created_at).toLocaleDateString()}
              </div>
              
              {correction.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => onReviewCorrection(correction.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: colors.success, color: colors.text, border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Approve
                  </button>
                  <button onClick={() => onRejectOpen(correction.id)} style={{ padding: '0.5rem 1rem', backgroundColor: colors.error, color: colors.text, border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
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

export default CorrectionsTab;
