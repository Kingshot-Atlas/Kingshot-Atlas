import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Dedicated OAuth callback page (PKCE flow).
 *
 * After Google/Discord sign-in, Supabase redirects here with ?code=...
 * The Supabase client (detectSessionInUrl + flowType: 'pkce') exchanges the
 * code automatically during initialization. This page waits for the session
 * to be established, then redirects to /profile.
 *
 * Failure modes handled:
 *  1. ?error= params from Supabase (provider rejected / server error)
 *  2. PKCE code_verifier lost (mobile redirect, in-app browser, app switch)
 *  3. Slow PKCE exchange on mobile (getSession can hang — use Promise.race)
 *  4. No credentials at all (direct navigation / stale tab)
 */

// Non-blocking getSession with timeout — prevents hanging when PKCE exchange is stuck
const getSessionSafe = async (timeoutMs = 5000) => {
  if (!supabase) return null;
  try {
    const result = await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return result;
  } catch {
    return null;
  }
};

// Detect which OAuth provider was used (for visual feedback during loading)
const detectProvider = (): 'google' | 'discord' | null => {
  const referrer = document.referrer.toLowerCase();
  if (referrer.includes('google') || referrer.includes('accounts.google')) return 'google';
  if (referrer.includes('discord')) return 'discord';
  // Fallback: check sessionStorage hint set by AuthModal
  const hint = sessionStorage.getItem('atlas_auth_provider');
  if (hint === 'google' || hint === 'discord') return hint;
  return null;
};

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [provider] = useState(detectProvider);

  // Re-initiate sign-in (works for both Discord and Google)
  const retrySignIn = useCallback(async (provider?: 'discord' | 'google') => {
    if (!supabase) { window.location.href = '/profile'; return; }
    setError(null);
    if (provider) {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthErr) setError(t('auth.callbackRetryFailed', 'Failed to start sign-in. Please try again.'));
    } else {
      // Generic retry: sign out stale state, go to profile
      await supabase.auth.signOut().catch(() => {});
      window.location.href = '/profile';
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError(t('auth.callbackNotConfigured', 'Authentication is not configured.'));
      return;
    }

    let cancelled = false;
    let pollCount = 0;
    let manualAttempted = false;

    // ─── Parse URL parameters ────────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasHash = window.location.hash.length > 1;
    const pkceCode = params.get('code');
    const hasPKCECode = !!pkceCode;

    // ─── 1. IMMEDIATE: Check for OAuth error from Supabase redirect ──
    const errorParam = params.get('error') || hashParams.get('error');
    const errorDesc = params.get('error_description') || hashParams.get('error_description');
    if (errorParam) {
      const msg = errorDesc
        ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
        : `Sign-in failed (${errorParam})`;
      logger.error('[AuthCallback] OAuth error from provider:', { error: errorParam, description: errorDesc });
      Sentry.captureMessage('OAuth callback error from provider', {
        level: 'warning',
        extra: { error: errorParam, description: errorDesc },
      });
      setError(msg);
      return;
    }

    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'AuthCallback mounted',
      data: { hasHash, hasPKCECode },
      level: 'info',
    });

    const redirect = () => {
      if (!cancelled) {
        cancelled = true;
        // Read pre-login URL and clear it
        const returnUrl = sessionStorage.getItem('atlas_pre_login_url');
        sessionStorage.removeItem('atlas_pre_login_url');
        sessionStorage.removeItem('atlas_auth_provider');
        // Validate returnUrl: must be a relative path starting with / (not //)
        const isSafeUrl = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');
        const destination = isSafeUrl ? returnUrl : '/profile';
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'AuthCallback redirect',
          data: { pollCount, destination },
          level: 'info',
        });
        navigate(destination, { replace: true });
      }
    };

    // Fallback: manually parse hash and call setSession if detectSessionInUrl failed
    const tryManualSession = async () => {
      if (manualAttempted || cancelled || !hasHash) return;
      manualAttempted = true;
      try {
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          Sentry.addBreadcrumb({ category: 'auth', message: 'Attempting manual setSession', level: 'info' });
          const { data, error: sessErr } = await supabase!.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (data?.session && !sessErr) redirect();
        }
      } catch { /* ignore manual fallback errors */ }
    };

    // ─── 2. No credentials at all → check existing session ──────────
    if (!hasHash && !hasPKCECode) {
      getSessionSafe(4000).then((session) => {
        if (session) {
          redirect();
        } else {
          logger.warn('[AuthCallback] No credentials in URL and no session');
          setError(t('auth.callbackNoCredentials', 'No sign-in credentials found. Please try signing in again.'));
        }
      });
      return () => { cancelled = true; };
    }

    // ─── 3. Credentials present — wait for session ───────────────────

    // Show retry button after 8s (was 6s — more time for mobile)
    const retryTimerId = setTimeout(() => { if (!cancelled) setShowRetry(true); }, 8000);

    // Hard timeout: 20s (was 12s). Uses non-blocking getSession to avoid
    // hanging when the PKCE exchange request is stuck on slow mobile networks.
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      const session = await getSessionSafe(3000);
      if (session) {
        redirect();
        return;
      }
      // Exchange failed — build a helpful error message
      const failureContext = hasPKCECode ? 'pkce' : hasHash ? 'hash' : 'none';
      logger.error('[AuthCallback] Timeout — no session after 20s', { failureContext, pollCount });
      Sentry.captureMessage('Auth callback timeout — session not established', {
        level: 'warning',
        extra: { hasPKCECode, hasHash, pollCount, failureContext },
      });

      if (hasPKCECode) {
        setError(
          t('auth.callbackPkceFailed', 'Sign-in verification failed. This can happen on mobile browsers or when switching apps during sign-in.')
        );
      } else {
        setError(t('auth.callbackSlow', 'Sign-in is taking longer than expected.'));
      }
    }, 20000);

    // Listen for auth state changes (fires when Supabase processes the code/hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) redirect();
    });

    // Poll for session every 2s using non-blocking getSession
    const pollSession = async () => {
      pollCount++;
      const session = await getSessionSafe(3000);
      if (session) {
        redirect();
      } else if (pollCount >= 3 && !manualAttempted && hasHash) {
        tryManualSession();
      }
    };
    pollSession();
    const pollId = setInterval(pollSession, 2000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
      clearTimeout(retryTimerId);
      clearInterval(pollId);
    };
  }, [navigate]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '2rem'
      }}>
        <div style={{ color: '#ef4444', fontSize: '1.1rem', textAlign: 'center' }}>{error}</div>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', maxWidth: '360px', lineHeight: 1.5 }}>
          {t('auth.callbackErrorHint', 'This can happen on slow connections, mobile in-app browsers, or when switching apps during sign-in.')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => retrySignIn('discord')}
            style={{
              padding: '0.75rem 1.25rem',
              background: '#5865F2',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {t('auth.tryDiscordAgain', 'Try Discord Again')}
          </button>
          <button
            onClick={() => retrySignIn('google')}
            style={{
              padding: '0.75rem 1.25rem',
              background: '#fff',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {t('auth.tryGoogleInstead', 'Try Google Instead')}
          </button>
        </div>
        <button
          onClick={() => { window.location.href = '/'; }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
        >
          {t('auth.backToHome', 'Back to Home')}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      {/* Provider logo for visual confirmation */}
      {provider === 'google' && (
        <svg width="32" height="32" viewBox="0 0 24 24" style={{ marginBottom: '-0.25rem' }}>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      {provider === 'discord' && (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#5865F2" style={{ marginBottom: '-0.25rem' }}>
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      )}
      {!provider && (
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #1a1a1a',
          borderTopColor: '#22d3ee',
          borderRadius: '50%',
          animation: 'authSpin 0.8s linear infinite'
        }} />
      )}
      <div style={{ color: '#9ca3af', fontSize: '1rem' }}>
        {provider
          ? t('auth.callbackSigningInWith', { provider: provider === 'google' ? 'Google' : 'Discord', defaultValue: 'Signing in with {{provider}}...' })
          : t('auth.callbackSigningIn', 'Signing you in...')
        }
      </div>
      {provider && (
        <div style={{
          width: '40px',
          height: '4px',
          backgroundColor: '#1a1a1a',
          borderRadius: '2px',
          overflow: 'hidden',
          marginTop: '0.25rem'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            background: provider === 'discord' ? '#5865F2' : '#22d3ee',
            animation: 'authProgress 2s ease-in-out infinite',
            transformOrigin: 'left'
          }} />
        </div>
      )}
      {showRetry && (
        <button
          onClick={() => retrySignIn()}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.25rem',
            backgroundColor: 'transparent',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          {t('auth.callbackTakingTooLong', 'Taking too long? Retry')}
        </button>
      )}
      <style>{`
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes authProgress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(1); }
          100% { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;
