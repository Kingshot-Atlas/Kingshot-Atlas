import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { logger } from '../utils/logger';
import { CURRENT_KVK } from '../constants';
import { getAuthHeaders } from '../services/authHeaders';
import { isAdminUsername } from '../utils/constants';
import { incrementStat } from './UserAchievements';
import { useTranslation } from 'react-i18next';
import { useTrustedSubmitter } from '../hooks/useTrustedSubmitter';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface PostKvKSubmissionProps {
  isOpen: boolean;
  onClose: () => void;
  defaultKingdom?: number;
  defaultKvkNumber?: number;
}

const PostKvKSubmission: React.FC<PostKvKSubmissionProps> = ({ 
  isOpen, 
  onClose,
  defaultKingdom,
  defaultKvkNumber = CURRENT_KVK
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const opponentInputRef = useRef<HTMLInputElement>(null);
  
  // Pre-fill kingdom if provided
  const [kingdomNumber, setKingdomNumber] = useState<number | ''>(defaultKingdom || '');
  const [opponentKingdom, setOpponentKingdom] = useState<number | ''>('');
  const [prepResult, setPrepResult] = useState<'W' | 'L' | null>(null);
  const [battleResult, setBattleResult] = useState<'W' | 'L' | null>(null);
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshot2, setScreenshot2] = useState<File | null>(null);
  const [screenshotPreview2, setScreenshotPreview2] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [screenshotDisclaimer, setScreenshotDisclaimer] = useState(false);
  const [isBye, setIsBye] = useState(false);

  const { isTrusted } = useTrustedSubmitter();
  const userIsAdmin = isAdminUsername(profile?.linked_username) || isAdminUsername(profile?.username);
  const canSkipScreenshot = userIsAdmin || isTrusted;

  // Sync kingdom when modal opens with new default and auto-focus opponent
  useEffect(() => {
    if (isOpen && defaultKingdom) {
      setKingdomNumber(defaultKingdom);
      // Auto-focus opponent field after a brief delay for modal animation
      setTimeout(() => {
        opponentInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, defaultKingdom]);

  // Use provided KvK number or default
  const kvkNumber = defaultKvkNumber || CURRENT_KVK;
  const isKingdomPreFilled = !!defaultKingdom;

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

  const handleScreenshot2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be under 5MB', 'error');
        return;
      }
      setScreenshot2(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview2(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearScreenshot2 = () => {
    setScreenshot2(null);
    setScreenshotPreview2(null);
    if (fileInputRef2.current) {
      fileInputRef2.current.value = '';
    }
  };

  const isFormValid = () => {
    if (isBye) {
      return !!kingdomNumber;
    }
    const hasScreenshot = screenshot || screenshot2;
    const disclaimerOk = !hasScreenshot || screenshotDisclaimer;
    return kingdomNumber && opponentKingdom && prepResult && battleResult && (screenshot || canSkipScreenshot) && disclaimerOk;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      showToast(canSkipScreenshot ? 'Please fill in all required fields' : 'Please fill in all fields and upload a screenshot', 'error');
      return;
    }

    if (kingdomNumber === opponentKingdom) {
      showToast('Your kingdom cannot be the same as opponent', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Convert screenshots to base64 (optional for admins)
      let screenshotBase64: string | null = null;
      if (screenshot) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(screenshot);
        });
        screenshotBase64 = await base64Promise;
      }

      // Second screenshot (optional)
      let screenshot2Base64: string | null = null;
      if (screenshot2) {
        const reader2 = new FileReader();
        const base64Promise2 = new Promise<string>((resolve) => {
          reader2.onloadend = () => resolve(reader2.result as string);
          reader2.readAsDataURL(screenshot2);
        });
        screenshot2Base64 = await base64Promise2;
      }

      // Get Kingshot username for attribution (used for future features)
      const _kingshotUsername = profile?.linked_username || profile?.username || null;
      void _kingshotUsername; // Suppress unused variable warning

      // Get fresh auth headers (avoids stale/expired tokens from React state)
      const authHeaders = await getAuthHeaders();

      // Debug: Log submission attempt
      const payload = {
        kingdom_number: kingdomNumber,
        opponent_kingdom: isBye ? 0 : opponentKingdom,
        kvk_number: kvkNumber,
        prep_result: isBye ? null : prepResult,
        battle_result: isBye ? null : battleResult,
        notes: isBye ? (notes || 'BYE - No opponent') : (notes || null),
        screenshot_base64: screenshotBase64 ? screenshotBase64.substring(0, 100) + '...' : '(none - admin)'
      };
      logger.log('[KvK Submit] Attempting submission:', {
        url: `${API_BASE}/api/v1/submissions/kvk10`,
        hasToken: !!authHeaders['Authorization'],
        userId: user?.id,
        payload: { ...payload, screenshot_base64: screenshotBase64 ? `[${screenshotBase64.length} chars]` : '(none - admin)' }
      });

      const response = await fetch(`${API_BASE}/api/v1/submissions/kvk10`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
          // X-User-Name removed - backend fetches from Supabase profile (handles special chars)
        },
        body: JSON.stringify({
          kingdom_number: kingdomNumber,
          opponent_kingdom: isBye ? 0 : opponentKingdom,
          kvk_number: kvkNumber,
          prep_result: isBye ? null : prepResult,
          battle_result: isBye ? null : battleResult,
          notes: isBye ? (notes || 'BYE - No opponent') : (notes || null),
          screenshot_base64: screenshotBase64 || undefined,
          screenshot2_base64: screenshot2Base64 || undefined
        })
      });

      // Debug: Log response status
      logger.log('[KvK Submit] Response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = 'Failed to submit';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorText;
        } catch {
          errorDetail = errorText || `HTTP ${response.status}`;
        }
        logger.error('[KvK Submit] Error response:', { status: response.status, body: errorText });
        throw new Error(errorDetail);
      }

      const result = await response.json();
      logger.log('[KvK Submit] Success:', result);

      const wasAutoApproved = result.status === 'approved';
      showToast(
        wasAutoApproved 
          ? `KvK #${kvkNumber} result auto-approved and recorded!` 
          : `KvK #${kvkNumber} result submitted for admin review!`, 
        'success'
      );
      incrementStat('dataSubmissions');
      // Reset form
      setKingdomNumber('');
      setOpponentKingdom('');
      setPrepResult(null);
      setBattleResult(null);
      setNotes('');
      setIsBye(false);
      clearScreenshot();
      clearScreenshot2();
      onClose();
    } catch (err) {
      logger.error('[KvK Submit] Caught error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getOutcomeLabel = () => {
    if (!prepResult || !battleResult) return null;
    if (prepResult === 'W' && battleResult === 'W') return { label: t('outcomes.Domination', 'Domination'), color: '#22c55e' };
    if (prepResult === 'L' && battleResult === 'L') return { label: t('outcomes.Invasion', 'Invasion'), color: '#ef4444' };
    if (prepResult === 'W') return { label: t('outcomes.Reversal', 'Reversal'), color: '#eab308' };
    return { label: t('outcomes.Comeback', 'Comeback'), color: '#f97316' };
  };

  const outcome = getOutcomeLabel();

  return createPortal(
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
                Submit KvK #{kvkNumber} Result
              </h2>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
              One submission per match{canSkipScreenshot ? (isTrusted && !userIsAdmin ? ' • Trusted auto-approval' : ' • Admin auto-approval') : ' • Screenshot required'}
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
            📅 KvK #{kvkNumber} — Battle Phase
          </span>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Kingdom Numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: isBye ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                Your Kingdom * {isKingdomPreFilled && <span style={{ color: '#22d3ee' }}>✓</span>}
              </label>
              <input
                type="number"
                value={kingdomNumber}
                onChange={(e) => !isKingdomPreFilled && setKingdomNumber(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="e.g., 172"
                min={1}
                max={9999}
                readOnly={isKingdomPreFilled}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  backgroundColor: isKingdomPreFilled ? '#1a1a1f' : '#0a0a0a',
                  border: `1px solid ${isKingdomPreFilled ? '#22d3ee30' : '#2a2a2a'}`,
                  borderRadius: '6px',
                  color: isKingdomPreFilled ? '#22d3ee' : '#fff',
                  fontSize: '0.9rem',
                  cursor: isKingdomPreFilled ? 'not-allowed' : 'text'
                }}
              />
            </div>
            {!isBye && (
              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Opponent Kingdom *</label>
                <input
                  ref={opponentInputRef}
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
            )}
          </div>

          {/* Bye Toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: isBye ? '#f5970b15' : '#0a0a0a',
              border: `1px solid ${isBye ? '#f5970b' : '#2a2a2a'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <input
              type="checkbox"
              checked={isBye}
              onChange={(e) => {
                setIsBye(e.target.checked);
                if (e.target.checked) {
                  setOpponentKingdom('');
                  setPrepResult(null);
                  setBattleResult(null);
                }
              }}
              style={{ accentColor: '#f5970b', cursor: 'pointer' }}
            />
            <div>
              <span style={{ color: isBye ? '#f5970b' : '#9ca3af', fontSize: '0.85rem', fontWeight: 600 }}>BYE — No opponent</span>
              <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.1rem' }}>
                This kingdom was not matched with any opponent this KvK
              </div>
            </div>
          </label>

          {/* Bye info */}
          {isBye && kingdomNumber && (
            <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#f5970b10', border: '1px solid #f5970b30', borderRadius: '8px', fontSize: '0.8rem', color: '#f5970b', textAlign: 'center' }}>
              ⏳ K{kingdomNumber} had no opponent this KvK — recording as BYE
            </div>
          )}

          {/* Results */}
          {!isBye && (
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

          )}

          {/* Outcome Preview */}
          {!isBye && outcome && (
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
          {!isBye && (
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              Screenshot Proof {canSkipScreenshot ? '' : '*'} <span style={{ color: '#6b7280' }}>{canSkipScreenshot ? '(Optional — trusted submitter)' : '(Required for verification)'}</span>
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

          )}

          {/* Second Screenshot Upload (Optional) */}
          {!isBye && (
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              Second Screenshot <span style={{ color: '#6b7280' }}>(Optional - e.g., battle results)</span>
            </label>
            
            {!screenshotPreview2 ? (
              <div
                onClick={() => fileInputRef2.current?.click()}
                style={{
                  border: '2px dashed #3a3a3a',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  backgroundColor: '#0a0a0a'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#22d3ee50'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#3a3a3a'}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>➕</div>
                <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  Add second screenshot
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img
                  src={screenshotPreview2}
                  alt="Screenshot 2 preview"
                  style={{
                    width: '100%',
                    maxHeight: '150px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '1px solid #2a2a2a'
                  }}
                />
                <button
                  onClick={clearScreenshot2}
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
              ref={fileInputRef2}
              type="file"
              accept="image/*"
              onChange={handleScreenshot2Change}
              style={{ display: 'none' }}
            />
          </div>
          )}

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

        {/* Screenshot Ownership Disclaimer */}
        {(screenshot || screenshot2) && (
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              marginTop: '0.75rem',
              padding: '0.65rem 0.75rem',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${screenshotDisclaimer ? '#22c55e30' : '#2a2a2a'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
          >
            <input
              type="checkbox"
              checked={screenshotDisclaimer}
              onChange={(e) => setScreenshotDisclaimer(e.target.checked)}
              style={{ marginTop: '0.15rem', accentColor: '#22c55e', cursor: 'pointer' }}
            />
            <span style={{ color: '#9ca3af', fontSize: '0.7rem', lineHeight: 1.5 }}>
              {t('kvkSubmit.screenshotDisclaimer', 'I confirm these screenshots are my own in-game captures. I understand that all game content depicted is the property of Century Games, and I grant Kingshot Atlas permission to store and display them for community data purposes.')}
            </span>
          </label>
        )}

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
            ) : isBye ? (
              'Submit Bye'
            ) : (
              'Submit for Review'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PostKvKSubmission;
