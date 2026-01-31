import React from 'react';

interface ClaimKingdomProps {
  kingdomNumber: number;
  isOpen: boolean;
  onClose: () => void;
}

const ClaimKingdom: React.FC<ClaimKingdomProps> = ({ kingdomNumber, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#131318',
          borderRadius: '16px',
          border: '1px solid #a855f750',
          padding: '2rem',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Coming Soon Badge */}
        <div style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          backgroundColor: '#a855f720',
          border: '1px solid #a855f750',
          borderRadius: '20px',
          fontSize: '0.7rem',
          color: '#a855f7',
          fontWeight: '600',
          marginBottom: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Coming Soon
        </div>

        {/* Icon */}
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👑</div>

        {/* Title */}
        <h2 style={{ 
          color: '#fff', 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          margin: '0 0 0.75rem',
          fontFamily: "'Cinzel', serif"
        }}>
          Claim Kingdom {kingdomNumber}
        </h2>

        {/* Description */}
        <p style={{ 
          color: '#9ca3af', 
          fontSize: '0.9rem', 
          lineHeight: 1.6,
          margin: '0 0 1.5rem'
        }}>
          Soon you&apos;ll be able to <strong style={{ color: '#a855f7' }}>officially represent</strong> your kingdom. 
          Verified leaders get a special badge, can customize their kingdom&apos;s profile banner, 
          and receive transfer interest from players looking to join.
        </p>

        {/* Recruiter Tier Note */}
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#a855f710',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
            This feature will be available to <span style={{ color: '#a855f7', fontWeight: '600' }}>Atlas Recruiter</span> subscribers.
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: '#a855f7',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
};

// Keep old code commented for when feature is ready
/*
const ClaimKingdomFull: React.FC<ClaimKingdomProps> = ({ kingdomNumber, isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'king' | 'r4' | 'r5' | ''>('');
  const [allianceTag, setAllianceTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const generatedCode = `ATLAS-${kingdomNumber}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  // ... rest of the full implementation
*/

export default ClaimKingdom;
