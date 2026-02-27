import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { isReferralEligible } from '../utils/constants';
import { colors } from '../utils/styles';
import { reviewService, ReviewWithVoteStatus, ReviewReply, Review, ReportReason } from '../services/reviewService';
import { logger } from '../utils/logger';
import { isSupabaseConfigured } from '../lib/supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { incrementStat } from './UserAchievements';
import { useGoldKingdoms } from '../hooks/useGoldKingdoms';
import ReviewCard from './kingdom-reviews/ReviewCard';
import ReviewForm from './kingdom-reviews/ReviewForm';
import { KingdomReviewsProps, SortOption, MIN_TC_LEVEL } from './kingdom-reviews/types';

const KingdomReviews: React.FC<KingdomReviewsProps> = ({ kingdomNumber, compact = false }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { user, profile } = useAuth();
  const goldKingdoms = useGoldKingdoms();
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
  const [visibleCount, setVisibleCount] = useState(10);
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
      logger.error('Error loading reviews:', err);
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

  const avgRating = reviewStats && reviewStats.totalReviews > 0
    ? reviewStats.avgRating.toFixed(1)
    : null;
  const totalReviewCount = reviewStats?.totalReviews ?? reviews.length;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
        <span style={{ color: colors.textMuted }}>{t('reviews.label', 'Reviews:')}</span>
        {avgRating ? (
          <>
            <span style={{ color: '#fbbf24' }}>{'★'.repeat(Math.round(Number(avgRating)))}</span>
            <span style={{ color: colors.textSecondary }}>({totalReviewCount})</span>
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
              ★ {avgRating} ({totalReviewCount})
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

      {showForm && user && canSubmitNewReview && profile && (
        <ReviewForm
          profile={profile}
          goldKingdoms={goldKingdoms}
          isMobile={isMobile}
          newReview={newReview}
          submitting={submitting}
          onSetNewReview={setNewReview}
          onSubmit={handleSubmitReview}
        />
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
              onClick={() => { setSortBy(option.value); setVisibleCount(10); }}
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
            sortedReviews.slice(0, visibleCount).map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                kingdomNumber={kingdomNumber}
                isMobile={isMobile}
                user={user}
                profile={profile}
                goldKingdoms={goldKingdoms}
                editingReviewId={editingReviewId}
                editForm={editForm}
                submitting={submitting}
                replyingToId={replyingToId}
                replyText={replyText}
                submittingReply={submittingReply}
                reviewReplies={reviewReplies}
                onSetEditForm={setEditForm}
                onUpdateReview={handleUpdateReview}
                onCancelEdit={() => setEditingReviewId(null)}
                onStartEditing={startEditing}
                onDeleteReview={handleDeleteReview}
                onToggleHelpful={handleToggleHelpful}
                onToggleReply={(reviewId) => {
                  setReplyingToId(replyingToId === reviewId ? null : reviewId);
                  loadRepliesForReview(reviewId);
                }}
                onSetReplyText={setReplyText}
                onSubmitReply={handleSubmitReply}
                onReport={(reviewId) => {
                  setReportingReviewId(reviewId);
                  setReportReason('inappropriate');
                  setReportDetails('');
                }}
                onShareReview={() => {
                  const refSuffix = profile && isReferralEligible(profile) && profile.linked_username
                    ? `?ref=${encodeURIComponent(profile.linked_username)}&src=review`
                    : '';
                  const url = `${window.location.origin}/kingdom/${kingdomNumber}${refSuffix}#reviews`;
                  navigator.clipboard.writeText(url);
                }}
              />
            ))
          )}
          {/* Showing x of y + View More */}
          {sortedReviews.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                {t('reviews.showingOf', 'Showing {{visible}} of {{total}}', { visible: Math.min(visibleCount, sortedReviews.length), total: sortedReviews.length })}
              </span>
              {visibleCount < sortedReviews.length && (
                <button
                  onClick={() => setVisibleCount(prev => prev + 10)}
                  style={{
                    display: 'block',
                    margin: '0.5rem auto 0',
                    padding: isMobile ? '0.6rem 1.5rem' : '0.4rem 1.25rem',
                    minHeight: isMobile ? '44px' : 'auto',
                    backgroundColor: '#22d3ee15',
                    border: '1px solid #22d3ee40',
                    borderRadius: '6px',
                    color: '#22d3ee',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {t('reviews.viewMore', 'View More')}
                </button>
              )}
            </div>
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
