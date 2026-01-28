import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';

interface KvKResult {
  kingdomNumber: number;
  opponentKingdom: number;
  kvkNumber: number;
  prepResult: 'Win' | 'Loss';
  battleResult: 'Win' | 'Loss';
}

interface PostKvKSubmissionProps {
  isOpen: boolean;
  onClose: () => void;
}

const PostKvKSubmission: React.FC<PostKvKSubmissionProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [results, setResults] = useState<KvKResult[]>([]);
  const [currentResult, setCurrentResult] = useState<Partial<KvKResult>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleAddResult = () => {
    if (!currentResult.kingdomNumber || !currentResult.opponentKingdom || 
        !currentResult.kvkNumber || !currentResult.prepResult || !currentResult.battleResult) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setResults([...results, currentResult as KvKResult]);
    setCurrentResult({});
  };

  const handleRemoveResult = (index: number) => {
    setResults(results.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (results.length === 0) {
      showToast('Please add at least one KvK result', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const SUBMISSIONS_KEY = 'kingshot_kvk_submissions';
      const existing = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '[]');

      const submission = {
        id: `kvk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        results,
        notes,
        submitted_by: user?.id || 'anonymous',
        submitted_by_name: profile?.username || 'Anonymous',
        submitted_at: new Date().toISOString(),
        status: 'pending'
      };

      existing.push(submission);
      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(existing));

      showToast(`${results.length} KvK result(s) submitted for review!`, 'success');
      setResults([]);
      setNotes('');
      onClose();
    } catch (err) {
      showToast('Failed to submit KvK results. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getOutcomeLabel = (prep: string, battle: string) => {
    if (prep === 'Win' && battle === 'Win') return { label: 'Domination', color: '#22c55e' };
    if (prep === 'Loss' && battle === 'Loss') return { label: 'Defeat', color: '#ef4444' };
    if (prep === 'Win') return { label: 'Prep Win', color: '#eab308' };
    return { label: 'Battle Win', color: '#f97316' };
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
          maxWidth: '550px',
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
              ⚔️ Submit KvK Results
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Help keep Kingshot Atlas accurate
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
        </div>

        {/* Add Result Form */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1a1a20', borderRadius: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Your Kingdom</label>
              <input
                type="number"
                value={currentResult.kingdomNumber || ''}
                onChange={(e) => setCurrentResult({ ...currentResult, kingdomNumber: parseInt(e.target.value) || undefined })}
                placeholder="e.g., 1001"
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Opponent Kingdom</label>
              <input
                type="number"
                value={currentResult.opponentKingdom || ''}
                onChange={(e) => setCurrentResult({ ...currentResult, opponentKingdom: parseInt(e.target.value) || undefined })}
                placeholder="e.g., 1002"
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>KvK Number</label>
            <input
              type="number"
              value={currentResult.kvkNumber || ''}
              onChange={(e) => setCurrentResult({ ...currentResult, kvkNumber: parseInt(e.target.value) || undefined })}
              placeholder="e.g., 5"
              style={{
                width: '100%',
                padding: '0.6rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', color: '#eab308', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Prep Phase Result</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Win', 'Loss'].map(result => (
                  <button
                    key={result}
                    onClick={() => setCurrentResult({ ...currentResult, prepResult: result as 'Win' | 'Loss' })}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      backgroundColor: currentResult.prepResult === result 
                        ? (result === 'Win' ? '#22c55e20' : '#ef444420')
                        : '#0a0a0a',
                      border: `1px solid ${currentResult.prepResult === result 
                        ? (result === 'Win' ? '#22c55e' : '#ef4444')
                        : '#2a2a2a'}`,
                      borderRadius: '6px',
                      color: currentResult.prepResult === result 
                        ? (result === 'Win' ? '#22c55e' : '#ef4444')
                        : '#6b7280',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {result}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#f97316', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Battle Phase Result</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Win', 'Loss'].map(result => (
                  <button
                    key={result}
                    onClick={() => setCurrentResult({ ...currentResult, battleResult: result as 'Win' | 'Loss' })}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      backgroundColor: currentResult.battleResult === result 
                        ? (result === 'Win' ? '#22c55e20' : '#ef444420')
                        : '#0a0a0a',
                      border: `1px solid ${currentResult.battleResult === result 
                        ? (result === 'Win' ? '#22c55e' : '#ef4444')
                        : '#2a2a2a'}`,
                      borderRadius: '6px',
                      color: currentResult.battleResult === result 
                        ? (result === 'Win' ? '#22c55e' : '#ef4444')
                        : '#6b7280',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {result}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleAddResult}
            style={{
              width: '100%',
              padding: '0.6rem',
              backgroundColor: '#22d3ee20',
              border: '1px solid #22d3ee50',
              borderRadius: '6px',
              color: '#22d3ee',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            + Add Result
          </button>
        </div>

        {/* Results List */}
        {results.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              Results to Submit ({results.length})
            </div>
            {results.map((r, i) => {
              const outcome = getOutcomeLabel(r.prepResult, r.battleResult);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    backgroundColor: '#1a1a20',
                    borderRadius: '8px',
                    marginBottom: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '0.9rem' }}>
                      <span style={{ color: '#fff', fontWeight: '600' }}>K{r.kingdomNumber}</span>
                      <span style={{ color: '#6b7280' }}> vs </span>
                      <span style={{ color: '#fff', fontWeight: '600' }}>K{r.opponentKingdom}</span>
                    </div>
                    <div style={{
                      padding: '0.2rem 0.5rem',
                      backgroundColor: `${outcome.color}20`,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      color: outcome.color,
                      fontWeight: '500'
                    }}>
                      {outcome.label}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveResult(i)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Additional Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context about the KvK..."
            rows={2}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.9rem',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: 'transparent',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#9ca3af',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={results.length === 0 || submitting}
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: results.length > 0 ? '#22d3ee' : '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              color: results.length > 0 ? '#000' : '#6b7280',
              cursor: results.length > 0 ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {submitting && <span className="loading-spinner" style={{ width: '14px', height: '14px' }} />}
            Submit Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostKvKSubmission;
