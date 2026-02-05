import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, getCacheBustedAvatarUrl } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { getDisplayTier, SUBSCRIPTION_COLORS, SubscriptionTier } from '../utils/constants';
import { colors, neonGlow } from '../utils/styles';
import { reviewService, ReviewWithVoteStatus } from '../services/reviewService';
import { isSupabaseConfigured } from '../lib/supabase';

interface KingdomReviewsProps {
  kingdomNumber: number;
  compact?: boolean;
}

const MIN_TC_LEVEL = 20;
const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 1000;

// Get username color based on display tier
const getUsernameColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'recruiter': return SUBSCRIPTION_COLORS.recruiter;
    case 'pro': return SUBSCRIPTION_COLORS.pro;
    default: return colors.text;
  }
};

// Get avatar border color
const getAvatarBorderColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'recruiter': return SUBSCRIPTION_COLORS.recruiter;
    case 'pro': return SUBSCRIPTION_COLORS.pro;
    default: return '#ffffff';
  }
};

const KingdomReviews: React.FC<KingdomReviewsProps> = ({ kingdomNumber, compact = false }) => {
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

  // Load reviews from Supabase
  const loadReviews = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    try {
      const data = await reviewService.getReviewsForKingdom(kingdomNumber, user?.id);
      setReviews(data);
      
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

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
        <span style={{ color: '#6b7280' }}>Reviews:</span>
        {avgRating ? (
          <>
            <span style={{ color: '#fbbf24' }}>{'★'.repeat(Math.round(Number(avgRating)))}</span>
            <span style={{ color: '#9ca3af' }}>({reviews.length})</span>
          </>
        ) : (
          <span style={{ color: '#4a4a4a' }}>No reviews yet</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: '#111111', 
      borderRadius: '12px', 
      padding: '1.25rem', 
      border: '1px solid #2a2a2a' 
    }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
          Community Reviews
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
                  color: '#fff',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {showForm ? 'Cancel' : '+ Add Review'}
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
                Sign in to review
              </span>
            );
          } else if (blockReason === 'not_linked') {
            return (
              <Link 
                to="/profile"
                style={{ 
                  display: 'block',
                  marginTop: '0.5rem',
                  color: '#6b7280', 
                  fontSize: '0.75rem', 
                  fontStyle: 'italic',
                  textDecoration: 'none'
                }}
              >
                <span style={{ color: '#f59e0b' }}>Link your Kingshot account</span> to leave reviews
              </Link>
            );
          } else if (blockReason.startsWith('tc_level_low:')) {
            const currentLevel = parseInt(blockReason.split(':')[1] || '0') || 0;
            return (
              <span 
                style={{ 
                  display: 'block',
                  marginTop: '0.5rem',
                  color: '#6b7280', 
                  fontSize: '0.75rem', 
                  fontStyle: 'italic'
                }}
              >
                TC Level {MIN_TC_LEVEL}+ required to review (yours: {currentLevel})
              </span>
            );
          } else if (blockReason === 'already_reviewed') {
            return (
              <span 
                style={{ 
                  display: 'block',
                  marginTop: '0.5rem',
                  color: '#6b7280', 
                  fontSize: '0.75rem', 
                  fontStyle: 'italic'
                }}
              >
                You've already reviewed this kingdom
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
          backgroundColor: '#0a0a0a', 
          borderRadius: '8px', 
          padding: '1rem', 
          marginBottom: '1rem',
          border: '1px solid #2a2a2a'
        }}>
          {/* Show linked Kingshot account profile */}
          {(() => {
            const displayTier = getDisplayTier(profile?.subscription_tier, profile?.linked_username);
            const usernameColor = getUsernameColor(displayTier);
            const avatarBorderColor = getAvatarBorderColor(displayTier);
            const isPaidOrAdmin = displayTier === 'pro' || displayTier === 'recruiter' || displayTier === 'admin';
            
            return (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem', 
                marginBottom: '0.75rem',
                padding: '0.5rem',
                backgroundColor: '#151515',
                borderRadius: '6px',
                border: '1px solid #2a2a2a'
              }}>
                {/* Avatar with tier-colored border */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#1a1a1a',
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
                {displayTier === 'pro' && (
                  <span style={{
                    fontSize: '0.55rem',
                    padding: '0.1rem 0.25rem',
                    backgroundColor: `${SUBSCRIPTION_COLORS.pro}15`,
                    border: `1px solid ${SUBSCRIPTION_COLORS.pro}40`,
                    borderRadius: '3px',
                    color: SUBSCRIPTION_COLORS.pro,
                    fontWeight: '600',
                  }}>
                    SUPPORTER
                  </span>
                )}
                {displayTier === 'recruiter' && (
                  <span style={{
                    fontSize: '0.55rem',
                    padding: '0.1rem 0.25rem',
                    backgroundColor: `${SUBSCRIPTION_COLORS.recruiter}15`,
                    border: `1px solid ${SUBSCRIPTION_COLORS.recruiter}40`,
                    borderRadius: '3px',
                    color: SUBSCRIPTION_COLORS.recruiter,
                    fontWeight: '600',
                  }}>
                    RECRUITER
                  </span>
                )}
              </div>
            );
          })()}
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.8rem', marginRight: '0.5rem' }}>Rating:</span>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={() => setNewReview(prev => ({ ...prev, rating: n }))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  color: n <= newReview.rating ? '#fbbf24' : '#4a4a4a'
                }}
              >★</button>
            ))}
          </div>
          <textarea
            placeholder="Share your experience with this kingdom..."
            value={newReview.comment}
            onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: '#151515',
              border: '1px solid #2a2a2a',
              borderRadius: '6px',
              color: '#fff',
              minHeight: '80px',
              resize: 'vertical',
              fontSize: '0.85rem',
              marginBottom: '0.75rem'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleSubmitReview}
              disabled={!newReview.comment.trim() || newReview.comment.length < MIN_COMMENT_LENGTH || submitting}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: newReview.comment.trim() && newReview.comment.length >= MIN_COMMENT_LENGTH && !submitting ? '#22d3ee' : '#2a2a2a',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: newReview.comment.trim() && newReview.comment.length >= MIN_COMMENT_LENGTH && !submitting ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem'
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
              {newReview.comment.length}/{MAX_COMMENT_LENGTH}
            </span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          Loading reviews...
        </div>
      )}

      {/* Reviews list */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reviews.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
              No reviews yet. Be the first to share your experience!
            </div>
          ) : (
            reviews.slice(0, 10).map(review => {
              // Get tier for display - use linked username for admin check
              const displayTier = getDisplayTier(review.author_subscription_tier, review.author_linked_username);
              const usernameColor = getUsernameColor(displayTier);
              const avatarBorderColor = getAvatarBorderColor(displayTier);
              const isPaidOrAdmin = displayTier === 'pro' || displayTier === 'recruiter' || displayTier === 'admin';
              const isOwnReview = user?.id === review.user_id;
              const isAdmin = profile?.is_admin;
              const isEditing = editingReviewId === review.id;
              
              return (
                <div key={review.id} style={{
                  backgroundColor: '#0a0a0a',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  border: isOwnReview ? '1px solid #22d3ee30' : '1px solid #2a2a2a'
                }}>
                  {isEditing ? (
                    // Edit mode
                    <div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.8rem', marginRight: '0.5rem' }}>Rating:</span>
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
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          backgroundColor: '#151515',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#fff',
                          minHeight: '60px',
                          resize: 'vertical',
                          fontSize: '0.8rem',
                          marginBottom: '0.5rem'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleUpdateReview(review.id)}
                          disabled={submitting || editForm.comment.length < MIN_COMMENT_LENGTH}
                          style={{
                            padding: '0.3rem 0.75rem',
                            backgroundColor: '#22d3ee',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          {submitting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingReviewId(null)}
                          style={{
                            padding: '0.3rem 0.75rem',
                            backgroundColor: '#2a2a2a',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#9ca3af',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
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
                            backgroundColor: '#1a1a1a',
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
                              backgroundColor: '#1a1a1a',
                              border: '1px solid #3a3a3a',
                              borderRadius: '3px',
                              color: '#6b7280',
                            }}>
                              K{review.author_linked_kingdom}
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
                          {displayTier === 'pro' && (
                            <span style={{
                              fontSize: '0.5rem',
                              padding: '0.1rem 0.2rem',
                              backgroundColor: `${SUBSCRIPTION_COLORS.pro}15`,
                              border: `1px solid ${SUBSCRIPTION_COLORS.pro}40`,
                              borderRadius: '3px',
                              color: SUBSCRIPTION_COLORS.pro,
                              fontWeight: '600',
                            }}>
                              SUPPORTER
                            </span>
                          )}
                          {displayTier === 'recruiter' && (
                            <span style={{
                              fontSize: '0.5rem',
                              padding: '0.1rem 0.2rem',
                              backgroundColor: `${SUBSCRIPTION_COLORS.recruiter}15`,
                              border: `1px solid ${SUBSCRIPTION_COLORS.recruiter}40`,
                              borderRadius: '3px',
                              color: SUBSCRIPTION_COLORS.recruiter,
                              fontWeight: '600',
                            }}>
                              RECRUITER
                            </span>
                          )}
                        </Link>
                        
                        {/* Rating stars */}
                        <span style={{ color: '#fbbf24', fontSize: '0.8rem', flexShrink: 0 }}>
                          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                        </span>
                      </div>
                      
                      <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
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
                            <span style={{ marginLeft: '0.1rem' }}>Helpful</span>
                          </button>
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
                                  color: '#6b7280',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer',
                                  padding: '0.2rem 0.4rem'
                                }}
                              >
                                Edit
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
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default KingdomReviews;
