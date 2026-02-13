import React from 'react';
import type { Claim } from './types';
import { colors } from '../../utils/styles';

interface ClaimsTabProps {
  claims: Claim[];
  filter: string;
  onVerify: (id: number) => void;
}

export const ClaimsTab: React.FC<ClaimsTabProps> = ({
  claims,
  filter,
  onVerify
}) => {
  if (claims.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
        No {filter} claims
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {claims.map((claim) => (
        <div key={claim.id} style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '1.25rem' }}>Kingdom {claim.kingdom_number}</span>
            <div style={{ 
              padding: '0.25rem 0.75rem',
              backgroundColor: claim.status === 'pending' ? '#fbbf2420' : '#22c55e20',
              color: claim.status === 'pending' ? '#fbbf24' : '#22c55e',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {claim.status.toUpperCase()}
            </div>
          </div>
          
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Verification Code: <code style={{ color: '#fbbf24', backgroundColor: '#1a1a1f', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>{claim.verification_code}</code>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
              Claimed {new Date(claim.created_at).toLocaleDateString()}
            </div>
            
            {claim.status === 'pending' && (
              <button onClick={() => onVerify(claim.id)} style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                Verify Claim
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClaimsTab;
