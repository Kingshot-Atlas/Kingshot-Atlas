import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { discordService } from '../services/discordService';
import { useAnalytics } from '../hooks/useAnalytics';

// Capture code ONCE from the URL before Supabase's detectSessionInUrl can
// call replaceState() and strip the ?code= parameter.
const initialParams = new URLSearchParams(window.location.search);
const initialCode = initialParams.get('code');
const initialError = initialParams.get('error');

const CONSUMED_KEY = 'discord_code_consumed';

const DiscordCallback: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');
  const [isAuthLost, setIsAuthLost] = useState(false);
  const { trackFeature } = useAnalytics();
  const processed = useRef(false);

  useEffect(() => {
    // Guard: Discord codes are single-use. Only process once even if
    // React re-renders or Supabase's URL cleanup triggers a re-render.
    if (processed.current) return;
    processed.current = true;

    const handleCallback = async () => {
      if (initialError) {
        setStatus('error');
        const errorMessage = initialError === 'access_denied'
          ? t('discord.authCancelled', 'Discord authorization was cancelled')
          : initialError;
        setError(errorMessage);
        trackFeature('discord_link_failed', { error_code: initialError, error_message: errorMessage });
        return;
      }

      if (!initialCode) {
        setStatus('error');
        setError(t('discord.noCode', 'No authorization code received'));
        trackFeature('discord_link_failed', { error_code: 'no_code', error_message: 'No authorization code received' });
        return;
      }

      // Prevent code replay: Discord codes are single-use. If this code was
      // already sent to the Edge Function, don't send it again.
      const consumed = sessionStorage.getItem(CONSUMED_KEY);
      if (consumed === initialCode) {
        setStatus('error');
        setError(t('discord.codeAlreadyUsed', 'This link has already been processed. Please try linking Discord again from your profile.'));
        trackFeature('discord_link_failed', { error_code: 'code_replay', error_message: 'Code already consumed' });
        return;
      }
      // Mark code as consumed BEFORE sending — codes are single-use
      sessionStorage.setItem(CONSUMED_KEY, initialCode);

      // Small delay for Supabase session restoration from localStorage
      // (critical on mobile after cross-origin redirect)
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = await discordService.handleCallback(initialCode);
      
      if (result.success) {
        setStatus('success');
        trackFeature('discord_link_success', {});
        sessionStorage.removeItem(CONSUMED_KEY);
        setTimeout(() => navigate('/profile?discord=linked'), 1500);
      } else if (result.error === 'auth_lost') {
        setStatus('error');
        setIsAuthLost(true);
        setError(t('discord.sessionLost', 'Your sign-in session was lost during the Discord redirect. This commonly happens on mobile devices.'));
        trackFeature('discord_link_failed', { error_code: 'auth_lost', error_message: 'Session lost during redirect' });
        // Clear consumed flag so user can retry after signing in
        sessionStorage.removeItem(CONSUMED_KEY);
      } else {
        setStatus('error');
        const errorMessage = result.error || t('discord.linkFailed', 'Failed to link Discord account');
        setError(errorMessage);
        trackFeature('discord_link_failed', { error_code: 'api_error', error_message: errorMessage });
      }
    };

    handleCallback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: '#111116',
        borderRadius: '16px',
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '400px',
        border: '1px solid #2a2a2a'
      }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              border: '3px solid #5865F2',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              {t('discord.linking', 'Linking Discord Account...')}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
              {t('discord.pleaseWait', 'Please wait while we connect your accounts.')}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#22c55e20',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ color: '#22c55e', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              {t('discord.linked', 'Discord Linked!')}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
              {t('discord.redirecting', 'Redirecting to your profile...')}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#ef444420',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              {t('discord.linkFailedTitle', 'Link Failed')}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {error}
            </p>
            {isAuthLost && (
              <p style={{ color: '#eab308', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {t('discord.tryDesktop', 'Try linking from a desktop browser, or sign in again on this device first.')}
              </p>
            )}
            <button
              onClick={() => navigate('/profile')}
              style={{
                padding: '0.6rem 1.5rem',
                backgroundColor: '#5865F2',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {t('discord.returnToProfile', 'Return to Profile')}
            </button>
          </>
        )}

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default DiscordCallback;
