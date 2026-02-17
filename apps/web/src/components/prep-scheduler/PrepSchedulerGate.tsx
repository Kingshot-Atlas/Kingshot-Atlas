import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, FONT_DISPLAY } from '../../utils/styles';

interface PrepSchedulerGateProps {
  needsLogin: boolean;
  scheduleId?: string;
}

const PrepSchedulerGate: React.FC<PrepSchedulerGateProps> = ({ needsLogin, scheduleId }) => {
  const { t } = useTranslation();

  // Save return URL for after login/linking
  if (scheduleId) {
    try { sessionStorage.setItem('prep_return_url', `/tools/prep-scheduler/${scheduleId}`); } catch { /* */ }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '420px', textAlign: 'center', padding: '2rem' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#a855f715', border: '2px solid #a855f730', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.75rem' }}>
          {needsLogin ? '🔒' : '🔗'}
        </div>
        <h2 style={{ color: colors.text, fontFamily: FONT_DISPLAY, fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          {needsLogin
            ? t('prepScheduler.signInRequired', 'Sign In Required')
            : t('prepScheduler.linkAccount', 'Link Your Kingshot Account')}
        </h2>
        <p style={{ color: colors.textMuted, fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {needsLogin
            ? t('prepScheduler.signInDesc', 'You need to sign in to fill out the KvK Prep form. After signing in, you\'ll be redirected back here.')
            : t('prepScheduler.linkDesc', 'You need to link your Kingshot account to participate in KvK Prep scheduling. This verifies your in-game identity.')}
        </p>
        {needsLogin ? (
          <Link to="/profile" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem',
            backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '8px',
            color: '#a855f7', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
          }}>
            🔑 {t('prepScheduler.signInBtn', 'Sign In to Continue')}
          </Link>
        ) : (
          <Link to="/profile" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem',
            backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '8px',
            color: '#22d3ee', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
          }}>
            🔗 {t('prepScheduler.linkBtn', 'Link Your Account')}
          </Link>
        )}
        <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '1rem' }}>
          {t('prepScheduler.redirectNote', 'You\'ll be redirected back to the form after completing this step.')}
        </p>
      </div>
    </div>
  );
};

export default PrepSchedulerGate;
