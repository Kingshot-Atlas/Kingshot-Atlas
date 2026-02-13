import React from 'react';
import type { NewKingdomSubmission } from './types';
import { colors } from '../../utils/styles';

interface NewKingdomsTabProps {
  submissions: NewKingdomSubmission[];
  filter: string;
  onApprove: (submission: NewKingdomSubmission) => void;
  onReject: (id: string) => void;
}

export const NewKingdomsTab: React.FC<NewKingdomsTabProps> = ({
  submissions,
  filter,
  onApprove,
  onReject
}) => {
  if (submissions.length === 0) {
    return (
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${colors.border}` }}>
        <h3 style={{ color: colors.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏰 New Kingdom Submissions
        </h3>
        <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Review and approve new kingdoms submitted by linked users.
        </p>
        <div style={{ 
          backgroundColor: colors.surfaceHover, 
          borderRadius: '8px', 
          padding: '2rem', 
          textAlign: 'center',
          border: `1px dashed ${colors.border}`
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <div style={{ color: colors.textMuted }}>No {filter} kingdom submissions</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {submissions.map((sub) => (
        <div key={sub.id} style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <span style={{ color: colors.primary, fontWeight: 600, fontSize: '1.1rem' }}>Kingdom {sub.kingdom_number}</span>
              <span style={{ color: colors.textMuted, marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                {sub.first_kvk_id === null 
                  ? 'No KvK yet' 
                  : `First KvK: #${sub.first_kvk_id} • ${sub.kvk_history.length} KvK${sub.kvk_history.length !== 1 ? 's' : ''} submitted`
                }
              </span>
            </div>
            <div style={{ 
              padding: '0.25rem 0.75rem',
              backgroundColor: sub.status === 'pending' ? `${colors.gold}20` : sub.status === 'approved' ? `${colors.success}20` : `${colors.error}20`,
              color: sub.status === 'pending' ? colors.gold : sub.status === 'approved' ? colors.success : colors.error,
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {sub.status.toUpperCase()}
            </div>
          </div>

          {/* KvK History or No KvK Yet indicator */}
          <div style={{ marginBottom: '1rem' }}>
            {sub.first_kvk_id === null ? (
              <div style={{ 
                padding: '0.75rem 1rem',
                backgroundColor: `${colors.gold}10`,
                border: `1px solid ${colors.gold}30`,
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: colors.gold
              }}>
                This kingdom has not had their first KvK yet. They will be added with no history.
              </div>
            ) : (
              <>
                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  KvK HISTORY (from #{sub.first_kvk_id})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {sub.kvk_history.map((kvk, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: colors.surfaceHover,
                      borderRadius: '6px',
                      fontSize: '0.8rem'
                    }}>
                      <span style={{ color: colors.primary }}>#{kvk.kvk}</span>
                      <span style={{ color: kvk.prep === 'W' ? colors.success : colors.error }}>{kvk.prep}</span>
                      <span style={{ color: colors.border }}>/</span>
                      <span style={{ color: kvk.battle === 'W' ? colors.success : colors.error }}>{kvk.battle}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.border}`, paddingTop: '1rem' }}>
            <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
              By {sub.submitted_by}{sub.submitted_by_kingdom ? ` (K${sub.submitted_by_kingdom})` : ''} • {new Date(sub.created_at).toLocaleDateString()}
            </div>
            
            {sub.status === 'pending' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => onApprove(sub)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: colors.success,
                    color: colors.text,
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => onReject(sub.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: `${colors.error}20`,
                    color: colors.error,
                    border: `1px solid ${colors.error}`,
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  ✗ Reject
                </button>
              </div>
            )}

            {sub.status === 'rejected' && sub.review_notes && (
              <div style={{ color: colors.error, fontSize: '0.8rem' }}>
                Reason: {sub.review_notes}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NewKingdomsTab;
