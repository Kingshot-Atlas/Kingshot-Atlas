import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CURRENT_KVK = 10; // Locked to KvK #10

interface PostKvKSubmissionProps {
  isOpen: boolean;
  onClose: () => void;
}

const PostKvKSubmission: React.FC<PostKvKSubmissionProps> = ({ isOpen, onClose }) => {
  const { user, session } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [kingdomNumber, setKingdomNumber] = useState<number | ''>('');
  const [opponentKingdom, setOpponentKingdom] = useState<number | ''>('');
  const [prepResult, setPrepResult] = useState<'W' | 'L' | null>(null);
  const [battleResult, setBattleResult] = useState<'W' | 'L' | null>(null);
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be under 5MB', 'error');
        return;
      }
      setScreenshot(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isFormValid = () => {
    return kingdomNumber && opponentKingdom && prepResult && battleResult && screenshot;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      showToast('Please fill in all fields and upload a screenshot', 'error');
      return;
    }

    if (kingdomNumber === opponentKingdom) {
      showToast('Your kingdom cannot be the same as opponent', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Convert screenshot to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(screenshot!);
      });
      const screenshotBase64 = await base64Promise;

      // Debug: Log submission attempt
      const payload = {
        kingdom_number: kingdomNumber,
        opponent_kingdom: opponentKingdom,
        kvk_number: CURRENT_KVK,
        prep_result: prepResult,
        battle_result: battleResult,
        notes: notes || null,
        screenshot_base64: screenshotBase64.substring(0, 100) + '...' // Truncate for logging
      };
      console.log('[KvK Submit] Attempting submission:', {
        url: `${API_BASE}/api/v1/submissions/kvk10`,
        hasToken: !!session?.access_token,
        userId: user?.id,
        payload: { ...payload, screenshot_base64: `[${screenshotBase64.length} chars]` }
      });

      const response = await fetch(`${API_BASE}/api/v1/submissions/kvk10`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
          'X-User-Id': user?.id || ''
        },
        body: JSON.stringify({
          kingdom_number: kingdomNumber,
          opponent_kingdom: opponentKingdom,
          kvk_number: CURRENT_KVK,
          prep_result: prepResult,
          battle_result: battleResult,
          notes: notes || null,
          screenshot_base64: screenshotBase64
        })
      });

      // Debug: Log response status
      console.log('[KvK Submit] Response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = 'Failed to submit';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorText;
        } catch {
          errorDetail = errorText || `HTTP ${response.status}`;
        }
        console.error('[KvK Submit] Error response:', { status: response.status, body: errorText });
        throw new Error(errorDetail);
      }

      const result = await response.json();
      console.log('[KvK Submit] Success:', result);

      showToast('KvK #10 result submitted for admin review!', 'success');
      // Reset form
      setKingdomNumber('');
      setOpponentKingdom('');
      setPrepResult(null);
      setBattleResult(null);
      setNotes('');
      clearScreenshot();
      onClose();
    } catch (err) {
      console.error('[KvK Submit] Caught error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getOutcomeLabel = () => {
    if (!prepResult || !battleResult) return null;
    if (prepResult === 'W' && battleResult === 'W') return { label: 'Domination', color: '#22c55e' };
    if (prepResult === 'L' && battleResult === 'L') return { label: 'Defeat', color: '#ef4444' };
    if (prepResult === 'W') return { label: 'Prep Win', color: '#eab308' };
    return { label: 'Battle Win', color: '#f97316' };
  };

  const outcome = getOutcomeLabel();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚔️</span>
              <h2 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '600', margin: 0 }}>
                Submit KvK #10 Result
              </h2>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
              One submission per match • Screenshot required
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
        </div>

        {/* KvK Number Badge */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '1.25rem',
          padding: '0.5rem',
          backgroundColor: '#22d3ee10',
          border: '1px solid #22d3ee30',
          borderRadius: '8px'
        }}>
          <span style={{ color: '#22d3ee', fontWeight: '600', fontSize: '0.9rem' }}>
            📅 KvK #{CURRENT_KVK} — Battle Phase
          </span>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Kingdom Numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Your Kingdom *</label>
              <input
                type="number"
                value={kingdomNumber}
                onChange={(e) => setKingdomNumber(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="e.g., 172"
                min={1}
                max={9999}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Opponent Kingdom *</label>
              <input
                type="number"
                value={opponentKingdom}
                onChange={(e) => setOpponentKingdom(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="e.g., 189"
                min={1}
                max={9999}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', color: '#eab308', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Prep Phase *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['W', 'L'] as const).map(result => (
                  <button
                    key={result}
                    type="button"
                    onClick={() => setPrepResult(result)}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      backgroundColor: prepResult === result 
                        ? (result === 'W' ? '#22c55e20' : '#ef444420')
                        : '#0a0a0a',
                      border: `1px solid ${prepResult === result 
                        ? (result === 'W' ? '#22c55e' : '#ef4444')
                        : '#2a2a2a'}`,
                      borderRadius: '6px',
                      color: prepResult === result 
                        ? (result === 'W' ? '#22c55e' : '#ef4444')
                        : '#6b7280',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}
                  >
                    {result === 'W' ? 'Win' : 'Loss'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#f97316', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Battle Phase *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['W', 'L'] as const).map(result => (
                  <button
                    key={result}
                    type="button"
                    onClick={() => setBattleResult(result)}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      backgroundColor: battleResult === result 
                        ? (result === 'W' ? '#22c55e20' : '#ef444420')
                        : '#0a0a0a',
                      border: `1px solid ${battleResult === result 
                        ? (result === 'W' ? '#22c55e' : '#ef4444')
                        : '#2a2a2a'}`,
                      borderRadius: '6px',
                      color: battleResult === result 
                        ? (result === 'W' ? '#22c55e' : '#ef4444')
                        : '#6b7280',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}
                  >
                    {result === 'W' ? 'Win' : 'Loss'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Outcome Preview */}
          {outcome && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              backgroundColor: `${outcome.color}15`,
              border: `1px solid ${outcome.color}40`,
              borderRadius: '6px'
            }}>
              <span style={{ color: outcome.color, fontWeight: '600', fontSize: '0.85rem' }}>
                {kingdomNumber ? `K${kingdomNumber}` : 'Your Kingdom'} → {outcome.label}
              </span>
            </div>
          )}

          {/* Screenshot Upload */}
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              Screenshot Proof * <span style={{ color: '#6b7280' }}>(Required for verification)</span>
            </label>
            
            {!screenshotPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #3a3a3a',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  backgroundColor: '#0a0a0a'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#22d3ee50'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#3a3a3a'}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
                <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                  Click to upload screenshot
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  PNG, JPG up to 5MB
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  style={{
                    width: '100%',
                    maxHeight: '200px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '1px solid #2a2a2a'
                  }}
                />
                <button
                  onClick={clearScreenshot}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: 'rgba(0,0,0,0.8)',
                    border: '1px solid #3a3a3a',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem'
                  }}
                >
                  ×
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              Additional Notes <span style={{ color: '#6b7280' }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context for the admins..."
              rows={2}
              maxLength={500}
              style={{
                width: '100%',
                padding: '0.65rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.85rem',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.7rem 1.25rem',
              backgroundColor: 'transparent',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid() || submitting}
            style={{
              padding: '0.7rem 1.5rem',
              backgroundColor: isFormValid() ? '#22d3ee' : '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              color: isFormValid() ? '#000' : '#6b7280',
              cursor: isFormValid() ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {submitting ? (
              <>
                <span style={{ 
                  width: '14px', 
                  height: '14px', 
                  border: '2px solid transparent',
                  borderTopColor: '#000',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Submitting...
              </>
            ) : (
              'Submit for Review'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostKvKSubmission;
