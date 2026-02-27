import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { useToast } from '../Toast';

interface RateKingdomModalProps {
  kingdomNumber: number;
  applicationId: string;
  onClose: () => void;
  onRated: () => void;
}

const RateKingdomModal: React.FC<RateKingdomModalProps> = ({ kingdomNumber, applicationId, onClose, onRated }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!supabase || !user || rating < 1) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('recruiter_ratings')
        .insert({
          kingdom_number: kingdomNumber,
          reviewer_user_id: user.id,
          application_id: applicationId,
          rating,
          comment: comment.trim() || null,
        });
      if (error) {
        if (error.code === '23505') {
          showToast(t('rateKingdom.alreadyRated', 'You have already rated this kingdom.'), 'info');
        } else {
          showToast(t('rateKingdom.submitFailed', 'Failed to submit rating.'), 'error');
        }
      } else {
        showToast(t('rateKingdom.submitSuccess', 'Rating submitted! Thanks for your feedback.'), 'success');
        onRated();
      }
    } catch {
      showToast(t('rateKingdom.submitFailed', 'Failed to submit rating.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '16px',
          padding: isMobile ? '1.25rem' : '1.5rem',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: colors.text, fontSize: '1rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>
          {t('rateKingdom.title', 'Rate Kingdom {{num}}', { num: kingdomNumber })}
        </h3>
        <p style={{ color: colors.textSecondary, fontSize: '0.75rem', margin: '0 0 1rem 0' }}>
          {t('rateKingdom.description', "How was your experience with this kingdom's recruiting process?")}
        </p>

        {/* Star Rating */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '2rem',
                color: star <= displayRating ? '#fbbf24' : '#333',
                transition: 'transform 0.1s, color 0.1s',
                transform: star <= displayRating ? 'scale(1.1)' : 'scale(1)',
                padding: '0.1rem',
              }}
            >
              ★
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
          <span style={{ color: displayRating > 0 ? '#fbbf24' : colors.textMuted, fontSize: '0.75rem', fontWeight: '600' }}>
            {displayRating === 0 ? t('rateKingdom.selectRating', 'Select a rating') : displayRating === 1 ? t('rateKingdom.poor', 'Poor') : displayRating === 2 ? t('rateKingdom.belowAverage', 'Below Average') : displayRating === 3 ? t('rateKingdom.average', 'Average') : displayRating === 4 ? t('rateKingdom.good', 'Good') : t('rateKingdom.excellent', 'Excellent')}
          </span>
        </div>

        {/* Optional Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 300))}
          placeholder={t('rateKingdom.commentPlaceholder', 'Optional: Share details about your experience...')}
          rows={3}
          style={{
            width: '100%',
            padding: '0.6rem 0.75rem',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.text,
            fontSize: '0.8rem',
            resize: 'vertical',
            minHeight: '60px',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ color: colors.textMuted, fontSize: '0.6rem', textAlign: 'right', marginTop: '0.2rem' }}>
          {comment.length}/300
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating < 1}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              backgroundColor: rating >= 1 ? '#fbbf24' : '#333',
              border: 'none',
              borderRadius: '8px',
              color: rating >= 1 ? '#000' : '#6b7280',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: submitting || rating < 1 ? 'not-allowed' : 'pointer',
              minHeight: '44px',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? t('rateKingdom.submitting', 'Submitting...') : t('rateKingdom.submitRating', 'Submit Rating')}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.textSecondary,
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            {t('rateKingdom.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RateKingdomModal;
