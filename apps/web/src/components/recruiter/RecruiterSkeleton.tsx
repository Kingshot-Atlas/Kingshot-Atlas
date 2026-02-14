import React from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors } from '../../utils/styles';

const RecruiterSkeleton: React.FC = () => {
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Skeleton stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.5rem' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '1.1rem', backgroundColor: colors.surfaceHover, borderRadius: '4px', margin: '0 auto 0.3rem', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '50px', height: '0.6rem', backgroundColor: colors.surfaceHover, borderRadius: '3px', margin: '0 auto', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
      {/* Skeleton recruiting toggle */}
      <div style={{ height: '50px', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
      {/* Skeleton tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: colors.surface, borderRadius: '10px', padding: '0.25rem' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: '32px', backgroundColor: colors.surfaceHover, borderRadius: '8px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      {/* Skeleton application cards */}
      {[1,2,3].map(i => (
        <div key={i} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors.surfaceHover, animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
              <div>
                <div style={{ width: '100px', height: '0.75rem', backgroundColor: colors.surfaceHover, borderRadius: '3px', marginBottom: '0.3rem', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: '60px', height: '0.6rem', backgroundColor: colors.surfaceHover, borderRadius: '3px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
              </div>
            </div>
            <div style={{ width: '60px', height: '24px', backgroundColor: colors.surfaceHover, borderRadius: '6px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {[1,2,3].map(j => (
              <div key={j} style={{ width: '55px', height: '18px', backgroundColor: colors.surfaceHover, borderRadius: '4px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        </div>
      ))}
      <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
    </div>
  );
};

export default RecruiterSkeleton;
