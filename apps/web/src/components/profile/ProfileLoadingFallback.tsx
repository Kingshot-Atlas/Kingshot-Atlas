import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Fallback for the "user logged in but profile not loaded" race condition.
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
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280' }}>{t('profile.loadingProfile', 'Loading profile...')}</div>
    </div>
  );
};

export default ProfileLoadingFallback;
