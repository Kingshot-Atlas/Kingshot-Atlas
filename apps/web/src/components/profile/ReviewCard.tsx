import React, { memo } from 'react';

interface Review {
  id: string;
  kingdomNumber: number;
  author: string;
  rating: number;
  comment: string;
  timestamp: number;
}

interface ReviewCardProps {
  review: Review;
  themeColor: string;
  navigate: (path: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, themeColor, navigate }) => (
  <div 
    style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #2a2a2a',
      cursor: 'pointer',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    }}
    onClick={() => navigate(`/kingdom/${review.kingdomNumber}`)}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.borderColor = themeColor + '50';
      e.currentTarget.style.boxShadow = `0 8px 24px rgba(0, 0, 0, 0.3), 0 0 12px ${themeColor}10`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.borderColor = '#2a2a2a';
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ 
          color: '#fff', 
          fontSize: '1.1rem', 
          fontWeight: '700',
          fontFamily: "'Cinzel', 'Times New Roman', serif"
        }}>
          Kingdom {review.kingdomNumber}
        </span>
        <span style={{ color: '#fbbf24', fontSize: '0.9rem' }}>
          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
        </span>
      </div>
      <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
        {new Date(review.timestamp).toLocaleDateString()}
      </span>
    </div>
    <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
      {review.comment}
    </p>
  </div>
);

export default memo(ReviewCard);
