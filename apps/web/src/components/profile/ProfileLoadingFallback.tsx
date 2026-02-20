import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SkeletonBlock: React.FC<{ width?: string; height?: string; borderRadius?: string; style?: React.CSSProperties }> = ({
  width = '100%', height = '1rem', borderRadius = '6px', style
}) => (
  <div style={{
    width, height, borderRadius,
    backgroundColor: '#1a1a1a',
    animation: 'skeletonPulse 1.5s ease-in-out infinite',
    ...style
  }} />
);

// Fallback for the "user logged in but profile not loaded" race condition.
// Shows a skeleton matching the real profile layout for a smooth perceived load.
// After 8 seconds, offers a retry instead of spinning forever.
const ProfileLoadingFallback: React.FC = () => {
  const { t } = useTranslation();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
        <div style={{ color: '#9ca3af', fontSize: '1rem', textAlign: 'center' }}>
          {t('profile.profileSlowLoad', 'Profile is taking a while to load.')}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {t('profile.reloadPage', 'Reload Page')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', padding: '2rem 1rem' }}>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Avatar + Name header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <SkeletonBlock width="80px" height="80px" borderRadius="50%" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <SkeletonBlock width="180px" height="1.25rem" />
            <SkeletonBlock width="120px" height="0.85rem" />
          </div>
        </div>

        {/* Stats grid (3 items) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ backgroundColor: '#111', borderRadius: '10px', padding: '1rem', border: '1px solid #1a1a1a' }}>
              <SkeletonBlock width="60%" height="0.75rem" style={{ marginBottom: '0.5rem' }} />
              <SkeletonBlock width="40%" height="1.25rem" />
            </div>
          ))}
        </div>

        {/* Section blocks */}
        {[1, 2].map(i => (
          <div key={i} style={{ backgroundColor: '#111', borderRadius: '12px', padding: '1.25rem', border: '1px solid #1a1a1a', marginBottom: '1rem' }}>
            <SkeletonBlock width="140px" height="1rem" style={{ marginBottom: '1rem' }} />
            <SkeletonBlock width="100%" height="0.85rem" style={{ marginBottom: '0.5rem' }} />
            <SkeletonBlock width="75%" height="0.85rem" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileLoadingFallback;
