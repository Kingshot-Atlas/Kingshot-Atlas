import React from 'react';
import { getDisplayTier, SUBSCRIPTION_COLORS, ReferralTier } from '../../utils/constants';
import { getCacheBustedAvatarUrl } from '../../contexts/AuthContext';
import ReferralBadge from '../ReferralBadge';
import { colors, neonGlow } from '../../utils/styles';
import { useTranslation } from 'react-i18next';
import { getUsernameColor, getAvatarBorderColor, MIN_COMMENT_LENGTH, MAX_COMMENT_LENGTH } from './types';
import type { UserProfile } from '../../contexts/AuthContext';

interface ReviewFormProps {
  profile: UserProfile;
  goldKingdoms: Set<number>;
  isMobile: boolean;
  newReview: { rating: number; comment: string };
  submitting: boolean;
  onSetNewReview: (updater: (prev: { rating: number; comment: string }) => { rating: number; comment: string }) => void;
  onSubmit: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
  profile,
  goldKingdoms,
  isMobile,
  newReview,
  submitting,
  onSetNewReview,
  onSubmit,
}) => {
  const { t } = useTranslation();

  // Show linked Kingshot account profile
  const displayTier = getDisplayTier(profile?.subscription_tier, profile?.linked_username, profile?.linked_kingdom, goldKingdoms);
  const usernameColor = getUsernameColor(displayTier);
  const avatarBorderColor = getAvatarBorderColor(displayTier);
  const isPaidOrAdmin = displayTier === 'supporter' || displayTier === 'admin';

  return (
    <div style={{ 
      backgroundColor: colors.bg, 
      borderRadius: '8px', 
      padding: '1rem', 
      marginBottom: '1rem',
      border: `1px solid ${colors.border}`
    }}>
      {/* Linked Kingshot account profile */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem', 
        marginBottom: '0.75rem',
        padding: '0.5rem',
        backgroundColor: '#151515',
        borderRadius: '6px',
        border: `1px solid ${colors.border}`
      }}>
        {/* Avatar with tier-colored border */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: colors.surfaceHover,
          border: `2px solid ${avatarBorderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          ...(displayTier !== 'free' ? { boxShadow: `0 0 8px ${avatarBorderColor}40` } : {})
        }}>
          {profile?.linked_avatar_url ? (
            <img 
              src={getCacheBustedAvatarUrl(profile.linked_avatar_url)} 
              alt="" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span style={{ fontSize: '0.9rem', color: usernameColor }}>
              {(profile?.linked_username || 'U').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        
        {/* Username with tier color */}
        <span style={{ 
          color: usernameColor, 
          fontSize: '0.85rem', 
          fontWeight: '600',
          ...(isPaidOrAdmin ? neonGlow(usernameColor) : {})
        }}>
          {profile?.linked_username}
        </span>
        
        {/* Tier badge */}
        {displayTier === 'admin' && (
          <span style={{
            fontSize: '0.55rem',
            padding: '0.1rem 0.25rem',
            backgroundColor: `${SUBSCRIPTION_COLORS.admin}15`,
            border: `1px solid ${SUBSCRIPTION_COLORS.admin}40`,
            borderRadius: '3px',
            color: SUBSCRIPTION_COLORS.admin,
            fontWeight: '600',
          }}>
            ADMIN
          </span>
        )}
        {displayTier === 'supporter' && (
          <span style={{
            fontSize: '0.55rem',
            padding: '0.1rem 0.25rem',
            backgroundColor: `${SUBSCRIPTION_COLORS.supporter}15`,
            border: `1px solid ${SUBSCRIPTION_COLORS.supporter}40`,
            borderRadius: '3px',
            color: SUBSCRIPTION_COLORS.supporter,
            fontWeight: '600',
          }}>
            SUPPORTER
          </span>
        )}
        {profile?.referral_tier && (
          <ReferralBadge tier={profile.referral_tier as ReferralTier} />
        )}
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginRight: '0.5rem' }}>{t('reviews.rating', 'Rating:')}</span>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            onClick={() => onSetNewReview(prev => ({ ...prev, rating: n }))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: isMobile ? '1.5rem' : '1.25rem',
              padding: isMobile ? '0.5rem' : '0.25rem',
              minWidth: isMobile ? '44px' : 'auto',
              minHeight: isMobile ? '44px' : 'auto',
              color: n <= newReview.rating ? '#fbbf24' : '#4a4a4a'
            }}
          >★</button>
        ))}
      </div>
      <textarea
        placeholder={t('reviews.placeholder', 'Brief review, max 200 characters...')}
        value={newReview.comment}
        onChange={(e) => onSetNewReview(prev => ({ ...prev, comment: e.target.value }))}
        maxLength={MAX_COMMENT_LENGTH}
        style={{
          width: '100%',
          padding: '0.5rem',
          backgroundColor: '#151515',
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          color: colors.text,
          minHeight: '80px',
          resize: 'vertical',
          fontSize: '0.85rem',
          marginBottom: '0.75rem'
        }}
      />
      {/* Character counter */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
        <span style={{
          fontSize: '0.7rem',
          color: newReview.comment.length >= MAX_COMMENT_LENGTH ? '#ef4444'
            : newReview.comment.length >= MAX_COMMENT_LENGTH * 0.8 ? '#f59e0b'
            : '#6b7280'
        }}>
          {newReview.comment.length}/{MAX_COMMENT_LENGTH}
        </span>
      </div>

      {/* Review preview */}
      {newReview.comment.trim().length >= MIN_COMMENT_LENGTH && (
        <div style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          marginBottom: '0.75rem'
        }}>
          <div style={{ fontSize: '0.65rem', color: colors.textMuted, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('reviews.preview', 'Preview')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
            <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>
              {'★'.repeat(newReview.rating)}{'☆'.repeat(5 - newReview.rating)}
            </span>
          </div>
          <p style={{ color: colors.textSecondary, fontSize: '0.8rem', lineHeight: 1.4, margin: 0 }}>
            {newReview.comment.trim()}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={onSubmit}
          disabled={!newReview.comment.trim() || newReview.comment.length < MIN_COMMENT_LENGTH || submitting}
          style={{
            padding: isMobile ? '0.75rem 1.5rem' : '0.5rem 1.5rem',
            minHeight: isMobile ? '44px' : 'auto',
            backgroundColor: newReview.comment.trim() && newReview.comment.length >= MIN_COMMENT_LENGTH && !submitting ? '#22d3ee' : '#2a2a2a',
            border: 'none',
            borderRadius: '6px',
            color: colors.text,
            cursor: newReview.comment.trim() && newReview.comment.length >= MIN_COMMENT_LENGTH && !submitting ? 'pointer' : 'not-allowed',
            fontSize: isMobile ? '0.9rem' : '0.85rem'
          }}
        >
          {submitting ? t('reviews.submitting', 'Submitting...') : t('reviews.submitReview', 'Submit Review')}
        </button>
      </div>
    </div>
  );
};

export default ReviewForm;
