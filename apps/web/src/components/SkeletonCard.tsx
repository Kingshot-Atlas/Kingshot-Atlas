import React from 'react';

const SkeletonCard: React.FC = () => (
  <div style={{
    backgroundColor: '#151515',
    borderRadius: '12px',
    padding: '1.25rem',
    border: '1px solid #2a2a2a',
    overflow: 'hidden',
    position: 'relative'
  }}>
    <div className="shimmer-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <div className="shimmer" style={{ width: '70px', height: '28px', backgroundColor: '#2a2a2a', borderRadius: '4px', marginBottom: '0.5rem' }} />
          <div className="shimmer" style={{ width: '100px', height: '14px', backgroundColor: '#1f1f1f', borderRadius: '4px' }} />
        </div>
        <div className="shimmer" style={{ width: '24px', height: '24px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
      </div>
      <div className="shimmer" style={{ width: '180px', height: '12px', backgroundColor: '#1f1f1f', borderRadius: '4px', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="shimmer" style={{ width: '70px', height: '10px', backgroundColor: '#1f1f1f', borderRadius: '4px' }} />
        <div className="shimmer" style={{ width: '70px', height: '10px', backgroundColor: '#1f1f1f', borderRadius: '4px' }} />
        <div className="shimmer" style={{ width: '70px', height: '10px', backgroundColor: '#1f1f1f', borderRadius: '4px' }} />
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <div className="shimmer" style={{ width: '100%', height: '8px', backgroundColor: '#1f1f1f', borderRadius: '4px', marginBottom: '1rem' }} />
        <div className="shimmer" style={{ width: '100%', height: '8px', backgroundColor: '#1f1f1f', borderRadius: '4px' }} />
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '1rem' }}>
        {[1,2,3,4,5].map(i => <div key={i} className="shimmer" style={{ width: '24px', height: '24px', backgroundColor: '#1f1f1f', borderRadius: '4px' }} />)}
      </div>
    </div>
    <style>{`
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .shimmer {
        background: linear-gradient(90deg, #1a1a1f 25%, #22d3ee15 50%, #1a1a1f 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
    `}</style>
  </div>
);

export default SkeletonCard;
