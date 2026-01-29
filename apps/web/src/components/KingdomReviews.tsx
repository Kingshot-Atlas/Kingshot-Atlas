import React, { useState, useEffect } from 'react';
import { useAuth, getCacheBustedAvatarUrl } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

interface Review {
  id: string;
  kingdomNumber: number;
  author: string;
  rating: number;
  comment: string;
  timestamp: number;
}

interface KingdomReviewsProps {
  kingdomNumber: number;
  compact?: boolean;
}

const REVIEWS_KEY = 'kingshot_kingdom_reviews';

const KingdomReviews: React.FC<KingdomReviewsProps> = ({ kingdomNumber, compact = false }) => {
  const { user, profile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  useEffect(() => {
    const stored = localStorage.getItem(REVIEWS_KEY);
    if (stored) {
      const all = JSON.parse(stored) as Review[];
      setReviews(all.filter(r => r.kingdomNumber === kingdomNumber));
    }
  }, [kingdomNumber]);

  const saveReview = () => {
    if (!newReview.comment.trim() || !user) return;
    
    const authorName = profile?.username || user.email?.split('@')[0] || 'Anonymous';
    
    const review: Review = {
      id: Date.now().toString(),
      kingdomNumber,
      author: authorName,
      rating: newReview.rating,
      comment: newReview.comment.trim(),
      timestamp: Date.now()
    };

    const stored = localStorage.getItem(REVIEWS_KEY);
    const all = stored ? JSON.parse(stored) as Review[] : [];
    all.unshift(review);
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
    
    setReviews(prev => [review, ...prev]);
    setNewReview({ rating: 5, comment: '' });
    setShowForm(false);
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const neonGlow = (color: string) => ({
    color: color,
    textShadow: `0 0 8px ${color}40`
  });

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600' }}>
          Community Reviews
          {avgRating && (
            <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: '#fbbf24' }}>
              ★ {avgRating} ({reviews.length})
            </span>
          )}
        </h3>
        {user ? (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
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
        ) : (
          <span 
            onClick={() => setShowAuthModal(true)}
            style={{ 
              color: '#22d3ee', 
              fontSize: '0.75rem', 
              fontStyle: 'italic', 
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Sign in to review
          </span>
        )}
      </div>

      {showForm && user && (
        <div style={{ 
          backgroundColor: '#0a0a0a', 
          borderRadius: '8px', 
          padding: '1rem', 
          marginBottom: '1rem',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            marginBottom: '0.75rem',
            padding: '0.5rem',
            backgroundColor: '#151515',
            borderRadius: '6px',
            border: '1px solid #2a2a2a'
          }}>
            {profile?.avatar_url && (
              <img 
                src={getCacheBustedAvatarUrl(profile.avatar_url)} 
                alt="" 
                style={{ width: '24px', height: '24px', borderRadius: '50%' }}
              />
            )}
            <span style={{ color: '#22d3ee', fontSize: '0.85rem', fontWeight: '500' }}>
              {profile?.username || user.email?.split('@')[0]}
            </span>
          </div>
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
          <button
            onClick={saveReview}
            disabled={!newReview.comment.trim()}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: newReview.comment.trim() ? '#22d3ee' : '#2a2a2a',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: newReview.comment.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem'
            }}
          >
            Submit Review
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {reviews.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            No reviews yet. Be the first to share your experience!
          </div>
        ) : (
          reviews.slice(0, 5).map(review => (
            <div key={review.id} style={{
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              padding: '0.75rem',
              border: '1px solid #2a2a2a'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ ...neonGlow('#22d3ee'), fontSize: '0.85rem', fontWeight: '500' }}>
                  {review.author}
                </span>
                <span style={{ color: '#fbbf24', fontSize: '0.8rem' }}>
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </span>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
                {review.comment}
              </p>
              <div style={{ color: '#4a4a4a', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                {new Date(review.timestamp).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default KingdomReviews;
