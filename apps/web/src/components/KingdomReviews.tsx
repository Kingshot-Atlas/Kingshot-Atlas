import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, getCacheBustedAvatarUrl } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { getDisplayTier, SUBSCRIPTION_COLORS, SubscriptionTier, ReferralTier, isReferralEligible } from '../utils/constants';
import ReferralBadge from './ReferralBadge';
import { colors, neonGlow } from '../utils/styles';
import { reviewService, ReviewWithVoteStatus, ReviewReply, Review, ReportReason } from '../services/reviewService';
import { isSupabaseConfigured } from '../lib/supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { incrementStat } from './UserAchievements';

interface KingdomReviewsProps {
  kingdomNumber: number;
  compact?: boolean;
}

const MIN_TC_LEVEL = 20;
const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 200;

// Get username color based on display tier
const getUsernameColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'supporter': return SUBSCRIPTION_COLORS.supporter;
    default: return colors.text;
  }
};

// Get avatar border color
const getAvatarBorderColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'supporter': return SUBSCRIPTION_COLORS.supporter;
    default: return colors.text;
  }
};

type SortOption = 'newest' | 'helpful' | 'highest' | 'lowest';

const KingdomReviews: React.FC<KingdomReviewsProps> = ({ kingdomNumber, compact = false }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { user, profile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [reviews, setReviews] = useState<ReviewWithVoteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ rating: 5, comment: '' });
  const [hasExistingReview, setHasExistingReview] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [reviewStats, setReviewStats] = useState<{
    totalReviews: number;
    avgRating: number;
    ratingBreakdown: { [key: number]: number };
  } | null>(null);
  const [featuredReview, setFeaturedReview] = useState<Review | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [reviewReplies, setReviewReplies] = useState<{ [reviewId: string]: ReviewReply[] }>({});
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  // Load reviews from Supabase
  const loadReviews = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    try {
      const [data, stats, featured] = await Promise.all([
        reviewService.getReviewsForKingdom(kingdomNumber, user?.id),
        reviewService.getReviewStats(kingdomNumber),
        reviewService.getFeaturedReview(kingdomNumber)
      ]);
      setReviews(data);
      setReviewStats(stats);
      setFeaturedReview(featured);
      
      // Check if current user has already reviewed
      if (user?.id) {
        const hasReview = data.some(r => r.user_id === user.id);
        setHasExistingReview(hasReview);
      }
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [kingdomNumber, user?.id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Sort reviews based on selected option
  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortBy) {
      case 'helpful':
        return b.helpful_count - a.helpful_count;
      case 'highest':
        return b.rating - a.rating;
      case 'lowest':
        return a.rating - b.rating;
      case 'newest':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // Check if user can leave a review
  const { canReview } = reviewService.canUserReview(profile);
  const canSubmitNewReview = canReview && !hasExistingReview;

  const getReviewBlockReason = (): string | null => {
    if (!user) return 'sign_in';
    if (!profile?.linked_username) return 'not_linked';
    if (!profile?.linked_tc_level || profile.linked_tc_level < MIN_TC_LEVEL) {
      return `tc_level_low:${profile?.linked_tc_level || 0}`;
    }
    if (hasExistingReview) return 'already_reviewed';
    return null;
  };

  const handleSubmitReview = async () => {
    if (!newReview.comment.trim() || !user || !profile || !canSubmitNewReview) return;
    
    setSubmitting(true);
    setError(null);
    
    const result = await reviewService.createReview(
      kingdomNumber,
      newReview.rating,
      newReview.comment,
      profile,
      user.id
    );
    
    if (result.success && result.review) {
      setReviews(prev => [{ ...result.review!, user_has_voted: false }, ...prev]);
      setNewReview({ rating: 5, comment: '' });
      setShowForm(false);
      setHasExistingReview(true);
      incrementStat('reviewsWritten');
    } else {
      setError(result.error || 'Failed to submit review');
    }
    
    setSubmitting(false);
  };

  const handleUpdateReview = async (reviewId: string) => {
    if (!user) return;
    
    setSubmitting(true);
    setError(null);
    
    const result = await reviewService.updateReview(
      reviewId,
      editForm.rating,
      editForm.comment,
      user.id
    );
    
    if (result.success) {
      setReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, rating: editForm.rating, comment: editForm.comment }
          : r
      ));
      setEditingReviewId(null);
    } else {
      setError(result.error || 'Failed to update review');
    }
    
    setSubmitting(false);
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    
    const result = await reviewService.deleteReview(reviewId);
    
    if (result.success) {
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      // If user deleted their own review, they can now submit again
      const deletedReview = reviews.find(r => r.id === reviewId);
      if (deletedReview?.user_id === user?.id) {
        setHasExistingReview(false);
      }
    } else {
      setError(result.error || 'Failed to delete review');
    }
  };

  const handleToggleHelpful = async (reviewId: string, currentlyVoted: boolean) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    const result = await reviewService.toggleHelpfulVote(reviewId, user.id, currentlyVoted);
    
    if (result.success) {
      setReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { 
              ...r, 
              user_has_voted: result.newVoteState,
              helpful_count: r.helpful_count + (result.newVoteState ? 1 : -1)
            }
          : r
      ));
    }
  };

  const startEditing = (review: ReviewWithVoteStatus) => {
    setEditingReviewId(review.id);
    setEditForm({ rating: review.rating, comment: review.comment });
    setError(null);
  };

  const handleSubmitReply = async (reviewId: string) => {
    if (!user || !profile || !replyText.trim()) return;
    
    setSubmittingReply(true);
    setError(null);
    
    // Check if user is an editor for this kingdom (has linked_kingdom matching)
    const isOfficialReply = profile.linked_kingdom === kingdomNumber;
    
    const result = await reviewService.createReply(
      reviewId,
      kingdomNumber,
      replyText,
      profile,
      user.id,
      isOfficialReply // Mark as official if from same kingdom
    );
    
    setSubmittingReply(false);
    
    if (result.success && result.reply) {
      setReviewReplies(prev => ({
        ...prev,
        [reviewId]: [...(prev[reviewId] || []), result.reply!]
      }));
      setReplyText('');
      setReplyingToId(null);
    } else {
      setError(result.error || 'Failed to submit reply');
    }
  };

  const loadRepliesForReview = async (reviewId: string) => {
    if (reviewReplies[reviewId]) return; // Already loaded
    
    const replies = await reviewService.getRepliesForReview(reviewId);
    setReviewReplies(prev => ({ ...prev, [reviewId]: replies }));
  };

  const handleReportReview = async () => {
    if (!user || !reportingReviewId) return;
    
    setSubmittingReport(true);
    setError(null);
    
    const result = await reviewService.reportReview(
      reportingReviewId,
      user.id,
      reportReason,
      reportDetails || undefined
    );
    
    setSubmittingReport(false);
    
    if (result.success) {
      setReportSuccess('Report submitted. Our team will review it.');
      setReportingReviewId(null);
      setReportReason('inappropriate');
      setReportDetails('');
      setTimeout(() => setReportSuccess(null), 4000);
    } else {
      setError(result.error || 'Failed to submit report');
      setReportingReviewId(null);
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
        <span style={{ color: colors.textMuted }}>{t('reviews.label', 'Reviews:')}</span>
        {avgRating ? (
          <>
            <span style={{ color: '#fbbf24' }}>{'★'.repeat(Math.round(Number(avgRating)))}</span>
            <span style={{ color: colors.textSecondary }}>({reviews.length})</span>
          </>
        ) : (
          <span style={{ color: '#4a4a4a' }}>{t('reviews.noReviewsYet', 'No reviews yet')}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: colors.surface, 
      borderRadius: '12px', 
      padding: '1.25rem', 
      border: `1px solid ${colors.border}` 
    }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: colors.text, fontSize: '1rem', fontWeight: '600', margin: 0 }}>
          {t('reviews.communityReviews', 'Community Reviews')}
          {avgRating && (
            <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: '#fbbf24' }}>
              ★ {avgRating} ({reviews.length})
            </span>
          )}
        </h3>
        {(() => {
          const blockReason = getReviewBlockReason();
          if (!blockReason) {
            // User can review
            return (
              <button
                onClick={() => setShowForm(!showForm)}
                style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: showForm ? '#2a2a2a' : '#22d3ee',
                  border: 'none',
                  borderRadius: '8px',
                  color: colors.text,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {showForm ? t('common.cancel', 'Cancel') : t('reviews.addReview', '+ Add Review')}
              </button>
            );
          } else if (blockReason === 'sign_in') {
            return (
              <span 
                onClick={() => setShowAuthModal(true)}
                style={{ 
                  display: 'block',
                  marginTop: '0.5rem',
                  color: '#22d3ee', 
                  fontSize: '0.75rem', 
                  fontStyle: 'italic', 
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {t('reviews.signInToReview', 'Sign in to review')}
              </span>
            );
          } else if (blockReason === 'not_linked') {
            return (
              <Link 
                to="/profile"
                style={{ 
                  display: 'block',
                  marginTop: '0.5rem',
                  color: colors.textMuted, 
                  fontSize: '0.75rem', 
                  fontStyle: 'italic',
                  textDecoration: 'none'
                }}
              >
                <span style={{ color: '#f59e0b' }}>{t('reviews.linkAccount', 'Link your Kingshot account')}</span> {t('reviews.toLeaveReviews', 'to leave reviews')}
              </Link>
            );
          } else if (blockReason.startsWith('tc_level_low:')) {
            const currentLevel = parseInt(blockReason.split(':')[1] || '0') || 0;
            return (
              <span 
                style={{ 
                  display: 'block',
                  marginTop: '0.5rem',
                  color: colors.textMuted, 
                  fontSize: '0.75rem', 
                  fontStyle: 'italic'
                }}
              >
                {t('reviews.tcRequired', 'TC Level {{level}}+ required to review (yours: {{current}})', { level: MIN_TC_LEVEL, current: currentLevel })}
              </span>
            );
          } else if (blockReason === 'already_reviewed') {
            return (
              <span 
                style={{ 
                  display: 'block',
                  marginTop: '0.5rem',
                  color: colors.textMuted, 
                  fontSize: '0.75rem', 
                  fontStyle: 'italic'
                }}
              >
                {t('reviews.alreadyReviewed', "You've already reviewed this kingdom")}
              </span>
            );
          }
          return null;
        })()}
      </div>

      {/* Error display */}
      {error && (
        <div style={{ 
          backgroundColor: '#7f1d1d', 
          color: '#fca5a5', 
          padding: '0.5rem 0.75rem', 
          borderRadius: '6px', 
          fontSize: '0.8rem',
          marginBottom: '0.75rem'
        }}>
          {error}
        </div>
      )}

      {showForm && user && canSubmitNewReview && (
        <div style={{ 
          backgroundColor: colors.bg, 
          borderRadius: '8px', 
          padding: '1rem', 
          marginBottom: '1rem',
          border: `1px solid ${colors.border}`
        }}>
          {/* Show linked Kingshot account profile */}
          {(() => {
            const displayTier = getDisplayTier(profile?.subscription_tier, profile?.linked_username);
            const usernameColor = getUsernameColor(displayTier);
            const avatarBorderColor = getAvatarBorderColor(displayTier);
            const isPaidOrAdmin = displayTier === 'supporter' || displayTier === 'admin';
            
            return (
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
            );
          })()}
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginRight: '0.5rem' }}>{t('reviews.rating', 'Rating:')}</span>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={() => setNewReview(prev => ({ ...prev, rating: n }))}
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
            onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
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
              onClick={handleSubmitReview}
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
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ color: colors.textMuted, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          {t('reviews.loading', 'Loading reviews...')}
        </div>
      )}

      {/* Rating breakdown stats */}
      {!loading && reviewStats && reviewStats.totalReviews > 0 && (
        <div style={{ 
          backgroundColor: colors.bg, 
          borderRadius: '8px', 
          padding: '0.75rem', 
          marginBottom: '0.75rem',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Average rating */}
            <div style={{ textAlign: 'center', minWidth: '60px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fbbf24' }}>
                {reviewStats.avgRating.toFixed(1)}
              </div>
              <div style={{ fontSize: '0.7rem', color: colors.textMuted }}>
                {t('reviews.reviewCount', '{{count}} review', { count: reviewStats.totalReviews }) + (reviewStats.totalReviews !== 1 ? 's' : '')}
              </div>
            </div>
            
            {/* Rating bars */}
            <div style={{ flex: 1, minWidth: '150px' }}>
              {[5, 4, 3, 2, 1].map(rating => {
                const count = reviewStats.ratingBreakdown[rating] || 0;
                const percentage = reviewStats.totalReviews > 0 
                  ? (count / reviewStats.totalReviews) * 100 
                  : 0;
                return (
                  <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                    <span style={{ fontSize: '0.65rem', color: colors.textMuted, width: '12px' }}>{rating}</span>
                    <div style={{ 
                      flex: 1, 
                      height: '6px', 
                      backgroundColor: colors.border, 
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${percentage}%`, 
                        height: '100%', 
                        backgroundColor: '#fbbf24',
                        borderRadius: '3px'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.6rem', color: '#4a4a4a', width: '20px' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Progress indicator for Google rating badge */}
          {reviewStats.totalReviews < 5 && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#1a1a2e',
              borderRadius: '6px',
              border: '1px solid #22d3ee30',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '1.25rem' }}>🎯</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#22d3ee', fontWeight: '500' }}>
                  {t('reviews.moreNeeded', '{{count}} more review(s) needed for Google rating badge', { count: 5 - reviewStats.totalReviews })}
                </div>
                <div style={{
                  marginTop: '0.25rem',
                  height: '4px',
                  backgroundColor: colors.border,
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(reviewStats.totalReviews / 5) * 100}%`,
                    height: '100%',
                    backgroundColor: '#22d3ee',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </div>
          )}
          
          {/* Badge earned indicator */}
          {reviewStats.totalReviews >= 5 && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#1a2e1a',
              borderRadius: '6px',
              border: '1px solid #22c55e30',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: '#22c55e'
            }}>
              <span>✓</span>
              <span>{t('reviews.badgeEarned', 'This kingdom qualifies for Google rich results rating badge')}</span>
            </div>
          )}
        </div>
      )}

      {/* Featured Review - Most helpful review highlighted */}
      {!loading && featuredReview && featuredReview.helpful_count >= 2 && (
        <div style={{ 
          backgroundColor: colors.bg, 
          borderRadius: '8px', 
          padding: '0.75rem', 
          marginBottom: '0.75rem',
          border: '1px solid #fbbf2440',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '-0.5rem',
            left: '0.75rem',
            backgroundColor: colors.surface,
            padding: '0 0.5rem',
            fontSize: '0.6rem',
            fontWeight: '600',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            ⭐ {t('reviews.featured', 'FEATURED REVIEW')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: colors.text }}>
                {featuredReview.author_linked_username}
              </span>
              <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>
                {'★'.repeat(featuredReview.rating)}{'☆'.repeat(5 - featuredReview.rating)}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#22d3ee' }}>
                👍 {featuredReview.helpful_count}
              </span>
            </div>
          </div>
          <p style={{ color: colors.textSecondary, fontSize: '0.8rem', lineHeight: 1.5, margin: '0.5rem 0 0' }}>
            {featuredReview.comment.length > 200 
              ? featuredReview.comment.substring(0, 200) + '...' 
              : featuredReview.comment}
          </p>
        </div>
      )}

      {/* Sort controls */}
      {!loading && reviews.length > 1 && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          marginBottom: '0.75rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>{t('reviews.sortBy', 'Sort by:')}</span>
          {([
            { value: 'newest', label: t('reviews.newest', 'Newest') },
            { value: 'helpful', label: t('reviews.mostHelpful', 'Most Helpful') },
            { value: 'highest', label: t('reviews.highestRated', 'Highest Rated') },
            { value: 'lowest', label: t('reviews.lowestRated', 'Lowest Rated') }
          ] as { value: SortOption; label: string }[]).map(option => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value)}
              style={{
                padding: isMobile ? '0.5rem 0.75rem' : '0.25rem 0.5rem',
                minHeight: isMobile ? '44px' : 'auto',
                fontSize: isMobile ? '0.75rem' : '0.7rem',
                backgroundColor: sortBy === option.value ? '#22d3ee20' : 'transparent',
                border: sortBy === option.value ? '1px solid #22d3ee' : '1px solid #3a3a3a',
                borderRadius: '4px',
                color: sortBy === option.value ? '#22d3ee' : '#9ca3af',
                cursor: 'pointer'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Reviews list */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedReviews.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
              {t('reviews.beFirst', 'No reviews yet. Be the first to share your experience!')}
            </div>
          ) : (
            sortedReviews.slice(0, 10).map(review => {
              // Get tier for display - use linked username for admin check
              const displayTier = getDisplayTier(review.author_subscription_tier, review.author_linked_username);
              const usernameColor = getUsernameColor(displayTier);
              const avatarBorderColor = getAvatarBorderColor(displayTier);
              const isPaidOrAdmin = displayTier === 'supporter' || displayTier === 'admin';
              const isOwnReview = user?.id === review.user_id;
              const isAdmin = profile?.is_admin;
              const isEditing = editingReviewId === review.id;
              const isVerifiedReviewer = review.author_linked_kingdom === kingdomNumber;
              
              return (
                <div key={review.id} style={{
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
                            onClick={() => setEditForm(prev => ({ ...prev, rating: n }))}
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
                        onChange={(e) => setEditForm(prev => ({ ...prev, comment: e.target.value }))}
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
                          onClick={() => handleUpdateReview(review.id)}
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
                          onClick={() => setEditingReviewId(null)}
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
                            onClick={() => handleToggleHelpful(review.id, review.user_has_voted)}
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
                          {user && !isOwnReview && (
                            <button
                              onClick={() => {
                                setReplyingToId(replyingToId === review.id ? null : review.id);
                                loadRepliesForReview(review.id);
                              }}
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
                            onClick={() => {
                              const refSuffix = profile && isReferralEligible(profile) && profile.linked_username
                                ? `?ref=${encodeURIComponent(profile.linked_username)}&src=review`
                                : '';
                              const url = `${window.location.origin}/kingdom/${kingdomNumber}${refSuffix}#reviews`;
                              navigator.clipboard.writeText(url);
                            }}
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
                              onClick={() => {
                                setReportingReviewId(review.id);
                                setReportReason('inappropriate');
                                setReportDetails('');
                              }}
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
                                onClick={() => startEditing(review)}
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
                              onClick={() => handleDeleteReview(review.id)}
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
                            onChange={(e) => setReplyText(e.target.value)}
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
                              onClick={() => { setReplyingToId(null); setReplyText(''); }}
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
                              onClick={() => handleSubmitReply(review.id)}
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
            })
          )}
        </div>
      )}
      {/* Report success toast */}
      {reportSuccess && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          backgroundColor: '#1a2e1a',
          border: '1px solid #22c55e40',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          color: '#22c55e',
          fontSize: '0.8rem',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>✓</span>
          <span>{reportSuccess}</span>
        </div>
      )}

      {/* Report modal */}
      {reportingReviewId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '1rem'
        }}
          onClick={() => setReportingReviewId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '1.25rem',
              width: '100%',
              maxWidth: '400px'
            }}
          >
            <h4 style={{ color: colors.text, fontSize: '0.95rem', margin: '0 0 1rem', fontWeight: '600' }}>
              🚩 {t('reviews.reportReview', 'Report Review')}
            </h4>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.35rem' }}>{t('reviews.reason', 'Reason')}</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ReportReason)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.text,
                  fontSize: '0.8rem'
                }}
              >
                <option value="inappropriate">{t('reviews.inappropriate', 'Inappropriate content')}</option>
                <option value="spam">{t('reviews.spam', 'Spam')}</option>
                <option value="misleading">{t('reviews.misleading', 'Misleading information')}</option>
                <option value="harassment">{t('reviews.harassment', 'Harassment')}</option>
                <option value="other">{t('reviews.other', 'Other')}</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.35rem' }}>{t('reviews.detailsOptional', 'Details (optional)')}</label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder={t('reviews.additionalContext', 'Any additional context...')}
                maxLength={300}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.text,
                  fontSize: '0.8rem',
                  minHeight: '60px',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setReportingReviewId(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: colors.border,
                  border: 'none',
                  borderRadius: '6px',
                  color: colors.textSecondary,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleReportReview}
                disabled={submittingReport}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: submittingReport ? '#2a2a2a' : '#ef4444',
                  border: 'none',
                  borderRadius: '6px',
                  color: colors.text,
                  fontSize: '0.8rem',
                  cursor: submittingReport ? 'not-allowed' : 'pointer'
                }}
              >
                {submittingReport ? t('reviews.submitting', 'Submitting...') : t('reviews.submitReport', 'Submit Report')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default KingdomReviews;
