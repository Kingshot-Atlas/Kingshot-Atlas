import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';

interface ClaimKingdomProps {
  kingdomNumber: number;
  isOpen: boolean;
  onClose: () => void;
}

const ClaimKingdom: React.FC<ClaimKingdomProps> = ({ kingdomNumber, isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'king' | 'r4' | 'r5' | ''>('');
  const [allianceTag, setAllianceTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const generatedCode = `ATLAS-${kingdomNumber}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  const handleSubmit = async () => {
    if (!user || !role) {
      showToast('Please complete all fields', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Store claim request in localStorage (will be synced to Supabase when backend is ready)
      const CLAIMS_KEY = 'kingshot_kingdom_claims';
      const existing = JSON.parse(localStorage.getItem(CLAIMS_KEY) || '[]');
      
      const claim = {
        id: `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        kingdom_number: kingdomNumber,
        user_id: user.id,
        username: profile?.username || 'Unknown',
        role,
        alliance_tag: allianceTag,
        verification_code: generatedCode,
        status: 'pending',
        submitted_at: new Date().toISOString()
      };

      existing.push(claim);
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(existing));

      showToast('Claim submitted! We\'ll verify and get back to you.', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to submit kingdom claim. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

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
          border: '1px solid #2a2a2a',
          padding: '1.5rem',
          maxWidth: '450px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👑 Claim Kingdom {kingdomNumber}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Verify you're a leader of this kingdom
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
        </div>

        {!user ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
            <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>You must be signed in to claim a kingdom.</p>
            <button style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#22d3ee',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              Sign In
            </button>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: step >= s ? '#22d3ee' : '#3a3a3a'
                }} />
              ))}
            </div>

            {step === 1 && (
              <div>
                <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>Step 1: Your Role</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  What is your role in Kingdom {kingdomNumber}?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { value: 'king', label: 'King', desc: 'Ruler of the kingdom' },
                    { value: 'r5', label: 'R5', desc: 'Alliance leader' },
                    { value: 'r4', label: 'R4', desc: 'Alliance officer' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setRole(opt.value as any)}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: role === opt.value ? '#22d3ee15' : '#1a1a20',
                        border: `1px solid ${role === opt.value ? '#22d3ee50' : '#2a2a2a'}`,
                        borderRadius: '8px',
                        color: role === opt.value ? '#22d3ee' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Alliance Tag (optional)
                  </label>
                  <input
                    type="text"
                    value={allianceTag}
                    onChange={(e) => setAllianceTag(e.target.value)}
                    placeholder="e.g., [ABC]"
                    maxLength={10}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #2a2a2a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!role}
                  style={{
                    width: '100%',
                    marginTop: '1.5rem',
                    padding: '0.75rem',
                    backgroundColor: role ? '#22d3ee' : '#1a1a1a',
                    border: 'none',
                    borderRadius: '8px',
                    color: role ? '#000' : '#6b7280',
                    fontWeight: '600',
                    cursor: role ? 'pointer' : 'not-allowed'
                  }}
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>Step 2: Verification</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Post this code in your kingdom's mail or alliance chat, then take a screenshot:
                </p>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '8px',
                  border: '1px solid #22d3ee30',
                  textAlign: 'center',
                  marginBottom: '1rem'
                }}>
                  <div style={{ color: '#22d3ee', fontSize: '1.25rem', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {generatedCode}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode);
                      showToast('Code copied!', 'success');
                    }}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.35rem 0.75rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #3a3a3a',
                      borderRadius: '4px',
                      color: '#9ca3af',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Copy Code
                  </button>
                </div>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#eab30810',
                  border: '1px solid #eab30830',
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ color: '#eab308', fontSize: '0.8rem' }}>
                    ⚠️ The screenshot must show the code and your in-game name visible.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #3a3a3a',
                      borderRadius: '8px',
                      color: '#9ca3af',
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: '#22d3ee',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#000',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    I've Posted It
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>Step 3: Submit</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Join our Discord and submit your screenshot in the #verification channel:
                </p>
                <a
                  href="https://discord.gg/aA3a7JGcHV"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: '#5865F2',
                    borderRadius: '8px',
                    color: '#fff',
                    textDecoration: 'none',
                    fontWeight: '500',
                    marginBottom: '1rem'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Join Discord & Submit
                </a>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                  Or submit via the form below:
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: '#22c55e',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {submitting && <span className="loading-spinner" style={{ width: '14px', height: '14px' }} />}
                  Submit Claim Request
                </button>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    width: '100%',
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  ← Back
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimKingdom;
