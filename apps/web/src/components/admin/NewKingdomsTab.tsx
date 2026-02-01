import React from 'react';
import type { NewKingdomSubmission } from './types';

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
      <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏰 New Kingdom Submissions
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Review and approve new kingdoms submitted by linked users.
        </p>
        <div style={{ 
          backgroundColor: '#1a1a1f', 
          borderRadius: '8px', 
          padding: '2rem', 
          textAlign: 'center',
          border: '1px dashed #2a2a2a'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <div style={{ color: '#6b7280' }}>No {filter} kingdom submissions</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {submissions.map((sub) => (
        <div key={sub.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '1.1rem' }}>Kingdom {sub.kingdom_number}</span>
              <span style={{ color: '#6b7280', marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                {sub.kvk_history.length} KvK{sub.kvk_history.length !== 1 ? 's' : ''} submitted
              </span>
            </div>
            <div style={{ 
              padding: '0.25rem 0.75rem',
              backgroundColor: sub.status === 'pending' ? '#fbbf2420' : sub.status === 'approved' ? '#22c55e20' : '#ef444420',
              color: sub.status === 'pending' ? '#fbbf24' : sub.status === 'approved' ? '#22c55e' : '#ef4444',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {sub.status.toUpperCase()}
            </div>
          </div>

          {/* KvK History */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.5rem' }}>KvK HISTORY</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {sub.kvk_history.map((kvk, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#1a1a1f',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}>
                  <span style={{ color: '#22d3ee' }}>#{kvk.kvk}</span>
                  <span style={{ color: kvk.prep === 'W' ? '#22c55e' : '#ef4444' }}>{kvk.prep}</span>
                  <span style={{ color: '#4a4a4a' }}>/</span>
                  <span style={{ color: kvk.battle === 'W' ? '#22c55e' : '#ef4444' }}>{kvk.battle}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
              By {sub.submitted_by}{sub.submitted_by_kingdom ? ` (K${sub.submitted_by_kingdom})` : ''} • {new Date(sub.created_at).toLocaleDateString()}
            </div>
            
            {sub.status === 'pending' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => onApprove(sub)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#22c55e',
                    color: '#fff',
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
                    backgroundColor: '#ef444420',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
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
              <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>
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
