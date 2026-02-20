import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
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

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  // Re-initiate sign-in (works for both Discord and Google)
  const retrySignIn = useCallback(async (provider?: 'discord' | 'google') => {
    if (!supabase) { window.location.href = '/profile'; return; }
    setError(null);
    if (provider) {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthErr) setError('Failed to start sign-in. Please try again.');
    } else {
      // Generic retry: sign out stale state, go to profile
      await supabase.auth.signOut().catch(() => {});
      window.location.href = '/profile';
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Authentication is not configured.');
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
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'AuthCallback redirect to profile',
          data: { pollCount },
          level: 'info',
        });
        navigate('/profile', { replace: true });
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
          setError('No sign-in credentials found. Please try signing in again.');
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
          'Sign-in verification failed. This can happen on mobile browsers or when switching apps during sign-in.'
        );
      } else {
        setError('Sign-in is taking longer than expected.');
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
          This can happen on slow connections, mobile in-app browsers, or when switching apps during sign-in.
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
            Try Discord Again
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
            Try Google Instead
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
          Back to Home
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
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #1a1a1a',
        borderTopColor: '#22d3ee',
        borderRadius: '50%',
        animation: 'authSpin 0.8s linear infinite'
      }} />
      <div style={{ color: '#9ca3af', fontSize: '1rem' }}>Signing you in...</div>
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
          Taking too long? Retry
        </button>
      )}
      <style>{`
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;
