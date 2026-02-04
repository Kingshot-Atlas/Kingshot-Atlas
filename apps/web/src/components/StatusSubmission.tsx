import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow } from '../utils/styles';
import { SessionExpiredError, DuplicateSubmissionError } from '../services/statusService';

interface StatusSubmissionProps {
  kingdomNumber: number;
  currentStatus: string;
  onSubmit: (status: string, notes: string) => Promise<void>;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'Leading', label: 'Leading', description: 'Open for high-power players only', color: '#fbbf24' },
  { value: 'Ordinary', label: 'Ordinary', description: 'Open for all players', color: '#9ca3af' },
  { value: 'Unannounced', label: 'Unannounced', description: 'Transfer status not yet announced', color: '#ef4444' },
];

const StatusSubmission: React.FC<StatusSubmissionProps> = ({
  kingdomNumber,
  currentStatus,
  onSubmit,
  onClose
}) => {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'session' | 'duplicate' | 'general' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Please sign in to submit status updates');
      return;
    }

    if (selectedStatus === currentStatus) {
      setError('Please select a different status');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(selectedStatus, notes);
      onClose();
    } catch (err) {
      console.error('Status submission error:', err);
      
      if (err instanceof SessionExpiredError) {
        setErrorType('session');
        setError(err.message);
      } else if (err instanceof DuplicateSubmissionError) {
        setErrorType('duplicate');
        setError(err.message);
      } else {
        setErrorType('general');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        border: '1px solid #2a2a2a',
        maxWidth: '450px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>
              Update Status
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Kingdom <span style={neonGlow('#22d3ee')}>K-{kingdomNumber}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
          {/* Current Status */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              color: '#9ca3af', 
              fontSize: '0.8rem', 
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Current Status
            </label>
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
              color: STATUS_OPTIONS.find(s => s.value === currentStatus)?.color || '#6b7280',
              fontSize: '0.9rem'
            }}>
              {currentStatus}
            </div>
          </div>

          {/* New Status */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              color: '#9ca3af', 
              fontSize: '0.8rem', 
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              New Status
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {STATUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedStatus(option.value)}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: selectedStatus === option.value ? `${option.color}15` : '#0a0a0a',
                    border: `1px solid ${selectedStatus === option.value ? option.color : '#2a2a2a'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ 
                    color: selectedStatus === option.value ? option.color : '#fff',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}>
                    {option.label}
                  </div>
                  <div style={{ 
                    color: '#6b7280', 
                    fontSize: '0.75rem',
                    marginTop: '0.25rem'
                  }}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              color: '#9ca3af', 
              fontSize: '0.8rem', 
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any relevant details (e.g., source of information, effective date)..."
              maxLength={500}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem',
                resize: 'vertical',
                minHeight: '80px',
                outline: 'none'
              }}
            />
            <div style={{ 
              color: '#4a4a4a', 
              fontSize: '0.7rem', 
              textAlign: 'right',
              marginTop: '0.25rem'
            }}>
              {notes.length}/500
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: errorType === 'duplicate' ? '#f59e0b20' : '#ef444420',
              border: `1px solid ${errorType === 'duplicate' ? '#f59e0b' : '#ef4444'}`,
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <div style={{ 
                color: errorType === 'duplicate' ? '#f59e0b' : '#ef4444',
                fontSize: '0.85rem',
                marginBottom: errorType === 'session' ? '0.5rem' : 0
              }}>
                {error}
              </div>
              {errorType === 'session' && (
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onClose();
                  }}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#22d3ee',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#000',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Sign Out & Sign In Again
                </button>
              )}
            </div>
          )}

          {/* Info */}
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#22d3ee10',
            border: '1px solid #22d3ee30',
            borderRadius: '8px',
            marginBottom: '1.25rem'
          }}>
            <div style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              ℹ️ Moderation Notice
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>
              Your submission will be reviewed by our team before being published. 
              False submissions may result in account restrictions.
            </p>
          </div>

          {/* Actions */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem',
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                color: '#9ca3af',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedStatus === currentStatus || !user}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                backgroundColor: isSubmitting || selectedStatus === currentStatus ? '#2a2a2a' : '#22d3ee',
                border: 'none',
                borderRadius: '8px',
                color: isSubmitting || selectedStatus === currentStatus ? '#6b7280' : '#000',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: isSubmitting || selectedStatus === currentStatus ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? 'Submitting...' : !user ? 'Sign in to Submit' : 'Submit Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusSubmission;
