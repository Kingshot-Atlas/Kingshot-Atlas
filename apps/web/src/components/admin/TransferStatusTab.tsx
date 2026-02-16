import React from 'react';
import { colors } from '../../utils/styles';

interface TransferSubmission {
  id: string;
  kingdom_number: number;
  old_status: string | null;
  new_status: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by_name?: string;
  submitted_at: string;
  reviewed_at?: string | null;
}

interface TransferStatusTabProps {
  transferSubmissions: TransferSubmission[];
  filter: string;
  onReview: (id: string, status: 'approved' | 'rejected') => void;
}

export const TransferStatusTab: React.FC<TransferStatusTabProps> = ({
  transferSubmissions, filter, onReview,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {transferSubmissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          No {filter} transfer status submissions
        </div>
      ) : (
        transferSubmissions.map((sub) => (
          <div key={sub.id} style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '1.25rem' }}>Kingdom {sub.kingdom_number}</span>
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
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Previous Status: </span>
                <span style={{ color: '#ef4444' }}>{sub.old_status || 'Unknown'}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>New Status: </span>
                <span style={{ color: '#22c55e' }}>{sub.new_status}</span>
              </div>
            </div>

            {sub.notes && (
              <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Notes: {sub.notes}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                {sub.submitted_by_name && <span style={{ color: '#9ca3af' }}>by <strong style={{ color: '#d1d5db' }}>{sub.submitted_by_name}</strong> • </span>}
                Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                {sub.reviewed_at && ` • Reviewed ${new Date(sub.reviewed_at).toLocaleDateString()}`}
              </div>
              
              {sub.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => onReview(sub.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Approve
                  </button>
                  <button onClick={() => onReview(sub.id, 'rejected')} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
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

export default TransferStatusTab;
