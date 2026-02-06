import React from 'react';

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1a1a1f 25%, #252530 50%, #1a1a1f 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '8px',
};

export const SkeletonCard: React.FC<{ height?: string }> = ({ height = '80px' }) => (
  <div style={{
    ...shimmerStyle,
    height,
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
  }} />
);

export const SkeletonGrid: React.FC<{ cards?: number; cardHeight?: string }> = ({ 
  cards = 4, 
  cardHeight = '80px' 
}) => (
  <>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
    }}>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} height={cardHeight} />
      ))}
    </div>
  </>
);

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ ...shimmerStyle, height: '40px' }} />
      ))}
    </div>
  </>
);
