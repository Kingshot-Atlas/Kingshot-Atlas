import React from 'react';
import { Link } from 'react-router-dom';
import { getDisplayTier, SUBSCRIPTION_COLORS, ReferralTier } from '../../utils/constants';
import ReferralBadge from '../ReferralBadge';
import { colors, neonGlow } from '../../utils/styles';
import { ReviewWithVoteStatus, ReviewReply } from '../../services/reviewService';
import { useTranslation } from 'react-i18next';
import { getUsernameColor, getAvatarBorderColor, MIN_COMMENT_LENGTH, MAX_COMMENT_LENGTH } from './types';
import type { UserProfile } from '../../contexts/AuthContext';

interface ReviewCardProps {
  review: ReviewWithVoteStatus;
  kingdomNumber: number;
  isMobile: boolean;
  user: { id: string } | null;
  profile: UserProfile | null;
  goldKingdoms: Set<number>;
  editingReviewId: string | null;
  editForm: { rating: number; comment: string };
  submitting: boolean;
  replyingToId: string | null;
  replyText: string;
  submittingReply: boolean;
  reviewReplies: { [reviewId: string]: ReviewReply[] };
  onSetEditForm: (form: { rating: number; comment: string }) => void;
  onUpdateReview: (reviewId: string) => void;
  onCancelEdit: () => void;
  onStartEditing: (review: ReviewWithVoteStatus) => void;
  onDeleteReview: (reviewId: string) => void;
  onToggleHelpful: (reviewId: string, currentlyVoted: boolean) => void;
  onToggleReply: (reviewId: string) => void;
  onSetReplyText: (text: string) => void;
  onSubmitReply: (reviewId: string) => void;
  onReport: (reviewId: string) => void;
  onShareReview: () => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  kingdomNumber,
  isMobile,
  user,
  profile,
  goldKingdoms,
  editingReviewId,
  editForm,
  submitting,
  replyingToId,
  replyText,
  submittingReply,
  reviewReplies,
  onSetEditForm,
  onUpdateReview,
  onCancelEdit,
  onStartEditing,
  onDeleteReview,
  onToggleHelpful,
  onToggleReply,
  onSetReplyText,
  onSubmitReply,
  onReport,
  onShareReview,
}) => {
  const { t } = useTranslation();

  // Get tier for display - use linked username for admin check
  const displayTier = getDisplayTier(review.author_subscription_tier, review.author_linked_username, review.author_linked_kingdom, goldKingdoms);
  const usernameColor = getUsernameColor(displayTier);
  const avatarBorderColor = getAvatarBorderColor(displayTier);
  const isPaidOrAdmin = displayTier === 'supporter' || displayTier === 'admin';
  const isOwnReview = user?.id === review.user_id;
  const isAdmin = profile?.is_admin;
  const isEditing = editingReviewId === review.id;
  const isVerifiedReviewer = review.author_linked_kingdom === kingdomNumber;

  return (
    <div style={{
      backgroundColor: colors.bg,
      borderRadius: '8px',
      padding: '0.75rem',
      border: isOwnReview ? '1px solid #22d3ee30' : '1px solid #2a2a2a'
    }}>
      {isEditing ? (
        // Edit mode
        <div>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginRight: '0.5rem' }}>{t('reviews.rating', 'Rating:')}</span>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={() => onSetEditForm({ ...editForm, rating: n })}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: n <= editForm.rating ? '#fbbf24' : '#4a4a4a'
                }}
              >★</button>
            ))}
          </div>
          <textarea
            value={editForm.comment}
            onChange={(e) => onSetEditForm({ ...editForm, comment: e.target.value })}
            maxLength={MAX_COMMENT_LENGTH}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: '#151515',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.text,
              minHeight: '60px',
              resize: 'vertical',
              fontSize: '0.8rem',
              marginBottom: '0.5rem'
            }}
          />
          {/* Edit character counter */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.25rem', marginBottom: '0.25rem' }}>
            <span style={{
              fontSize: '0.65rem',
              color: editForm.comment.length >= MAX_COMMENT_LENGTH ? '#ef4444'
                : editForm.comment.length >= MAX_COMMENT_LENGTH * 0.8 ? '#f59e0b'
                : '#6b7280'
            }}>
              {editForm.comment.length}/{MAX_COMMENT_LENGTH}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => onUpdateReview(review.id)}
              disabled={submitting || editForm.comment.length < MIN_COMMENT_LENGTH}
              style={{
                padding: isMobile ? '0.5rem 1rem' : '0.3rem 0.75rem',
                minHeight: isMobile ? '44px' : 'auto',
                backgroundColor: '#22d3ee',
                border: 'none',
                borderRadius: '4px',
                color: colors.text,
                fontSize: isMobile ? '0.8rem' : '0.75rem',
                cursor: 'pointer'
              }}
            >
              {submitting ? t('reviews.saving', 'Saving...') : t('common.save', 'Save')}
            </button>
            <button
              onClick={onCancelEdit}
              style={{
                padding: isMobile ? '0.5rem 1rem' : '0.3rem 0.75rem',
                minHeight: isMobile ? '44px' : 'auto',
                backgroundColor: colors.border,
                border: 'none',
                borderRadius: '4px',
                color: colors.textSecondary,
                fontSize: isMobile ? '0.8rem' : '0.75rem',
                cursor: 'pointer'
              }}
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      ) : (
        // Display mode
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            {/* Author profile with linked account */}
            <Link 
              to={`/profile/${review.user_id}`}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                textDecoration: 'none',
                flexWrap: 'wrap'
              }}
            >
              {/* Avatar with tier-colored border */}
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: colors.surfaceHover,
                border: `2px solid ${avatarBorderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                ...(displayTier !== 'free' ? { boxShadow: `0 0 6px ${avatarBorderColor}40` } : {})
              }}>
                {review.author_linked_avatar_url ? (
                  <img 
                    src={review.author_linked_avatar_url} 
                    alt="" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span style={{ fontSize: '0.75rem', color: usernameColor }}>
                    {(review.author_linked_username || 'U').charAt(0).toUpperCase()}
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
                {review.author_linked_username}
              </span>
              
              {/* Reviewer's kingdom badge */}
              {review.author_linked_kingdom && (
                <span style={{
                  fontSize: '0.6rem',
                  padding: '0.1rem 0.3rem',
                  backgroundColor: colors.surfaceHover,
                  border: '1px solid #3a3a3a',
                  borderRadius: '3px',
                  color: colors.textMuted,
                }}>
                  K{review.author_linked_kingdom}
                </span>
              )}
              
              {/* Verified Reviewer badge - shown when reviewer's home kingdom matches */}
              {isVerifiedReviewer && (
                <span style={{
                  fontSize: '0.55rem',
                  padding: '0.15rem 0.35rem',
                  backgroundColor: '#22c55e15',
                  border: '1px solid #22c55e40',
                  borderRadius: '3px',
                  color: '#22c55e',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem'
                }}>
                  ✓ VERIFIED
                </span>
              )}
              
              {/* Tier badge */}
              {displayTier === 'admin' && (
                <span style={{
                  fontSize: '0.5rem',
                  padding: '0.1rem 0.2rem',
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
                  fontSize: '0.5rem',
                  padding: '0.1rem 0.2rem',
                  backgroundColor: `${SUBSCRIPTION_COLORS.supporter}15`,
                  border: `1px solid ${SUBSCRIPTION_COLORS.supporter}40`,
                  borderRadius: '3px',
                  color: SUBSCRIPTION_COLORS.supporter,
                  fontWeight: '600',
                }}>
                  SUPPORTER
                </span>
              )}
              {review.author_referral_tier && (
                <ReferralBadge tier={review.author_referral_tier as ReferralTier} />
              )}
            </Link>
            
            {/* Rating stars */}
            <span style={{ color: '#fbbf24', fontSize: '0.8rem', flexShrink: 0 }}>
              {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
            </span>
          </div>
          
          <p style={{ color: colors.textSecondary, fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
            {review.comment}
          </p>
          
          {/* Footer: date, helpful votes, actions */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: '0.5rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#4a4a4a', fontSize: '0.7rem' }}>
                {new Date(review.created_at).toLocaleDateString()}
              </span>
              
              {/* Helpful vote button */}
              <button
                onClick={() => onToggleHelpful(review.id, review.user_has_voted)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '4px',
                  backgroundColor: review.user_has_voted ? '#22d3ee15' : 'transparent',
                  color: review.user_has_voted ? '#22d3ee' : '#6b7280',
                  fontSize: '0.7rem'
                }}
              >
                <span>👍</span>
                <span>{review.helpful_count > 0 ? review.helpful_count : ''}</span>
                <span style={{ marginLeft: '0.1rem' }}>{t('reviews.helpful', 'Helpful')}</span>
              </button>
            </div>
            
            {/* Reply, Share & Report buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {user && (
                <button
                  onClick={() => onToggleReply(review.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textMuted,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem'
                  }}
                >
                  💬 {t('reviews.reply', 'Reply')}
                </button>
              )}
              <button
                onClick={onShareReview}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  padding: '0.2rem 0.4rem'
                }}
              >
                🔗 {t('reviews.share', 'Share')}
              </button>
              {user && !isOwnReview && (
                <button
                  onClick={() => onReport(review.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4a4a4a',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem'
                  }}
                  title="Report this review"
                >
                  🚩
                </button>
              )}
            </div>

            {/* Edit/Delete buttons for own reviews or admin */}
            {(isOwnReview || isAdmin) && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {isOwnReview && (
                  <button
                    onClick={() => onStartEditing(review)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.textMuted,
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      padding: '0.2rem 0.4rem'
                    }}
                  >
                    {t('common.edit', 'Edit')}
                  </button>
                )}
                <button
                  onClick={() => onDeleteReview(review.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem'
                  }}
                >
                  {t('common.delete', 'Delete')}
                </button>
              </div>
            )}
          </div>

          {/* Replies section */}
          {(reviewReplies[review.id]?.length ?? 0) > 0 && (
            <div style={{ marginTop: '0.75rem', paddingLeft: '1rem', borderLeft: '2px solid #2a2a2a' }}>
              {(reviewReplies[review.id] || []).map(reply => (
                <div key={reply.id} style={{ 
                  marginBottom: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#151515',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.text }}>
                      {reply.author_linked_username}
                    </span>
                    {reply.is_official_reply && (
                      <span style={{
                        fontSize: '0.5rem',
                        padding: '0.1rem 0.25rem',
                        backgroundColor: '#22c55e15',
                        border: '1px solid #22c55e40',
                        borderRadius: '3px',
                        color: '#22c55e',
                        fontWeight: '600'
                      }}>
                        OFFICIAL
                      </span>
                    )}
                    <span style={{ fontSize: '0.6rem', color: '#4a4a4a' }}>
                      {new Date(reply.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ color: colors.textSecondary, fontSize: '0.75rem', lineHeight: 1.4, margin: 0 }}>
                    {reply.reply_text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          {replyingToId === review.id && (
            <div style={{ marginTop: '0.75rem', paddingLeft: '1rem', borderLeft: '2px solid #22d3ee40' }}>
              <textarea
                value={replyText}
                onChange={(e) => onSetReplyText(e.target.value)}
                placeholder={t('reviews.replyPlaceholder', 'Write a reply...')}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#151515',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.text,
                  minHeight: '50px',
                  resize: 'vertical',
                  fontSize: '0.75rem',
                  marginBottom: '0.5rem'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { onToggleReply(review.id); onSetReplyText(''); }}
                  style={{
                    padding: '0.3rem 0.6rem',
                    backgroundColor: colors.border,
                    border: 'none',
                    borderRadius: '4px',
                    color: colors.textSecondary,
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => onSubmitReply(review.id)}
                  disabled={submittingReply || replyText.length < 5}
                  style={{
                    padding: '0.3rem 0.6rem',
                    backgroundColor: replyText.length >= 5 ? '#22d3ee' : '#2a2a2a',
                    border: 'none',
                    borderRadius: '4px',
                    color: colors.text,
                    fontSize: '0.7rem',
                    cursor: replyText.length >= 5 ? 'pointer' : 'not-allowed'
                  }}
                >
                  {submittingReply ? t('reviews.sending', 'Sending...') : t('reviews.reply', 'Reply')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewCard;
