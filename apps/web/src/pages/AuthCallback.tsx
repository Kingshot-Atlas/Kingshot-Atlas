import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Dedicated OAuth callback page.
 * Supabase redirects here after Google/Discord sign-in with #access_token=... in the hash.
 * The Supabase client (detectSessionInUrl: true) processes the hash automatically.
 * This page waits for the session to be established, then redirects to /profile.
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  const retryLogin = () => {
    // Clear stale session data and redirect to profile to re-trigger OAuth
    if (supabase) {
      supabase.auth.signOut().then(() => {
        window.location.href = '/profile';
      });
    } else {
      window.location.href = '/profile';
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Authentication is not configured.');
      return;
    }

    let cancelled = false;
    let pollCount = 0;
    let manualAttempted = false;
    const hasHash = window.location.hash.length > 1;

    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'AuthCallback mounted',
      data: { hasHash },
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
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
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

    // If no hash fragment, the user likely landed here from another tab that
    // already consumed the OAuth token, or via direct navigation.
    // Check for existing session immediately and redirect fast.
    if (!hasHash) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          redirect();
        } else {
          setError('Sign-in is taking longer than expected. Please try again.');
        }
      });
      return () => { cancelled = true; };
    }

    // Show retry button after 6s
    const retryTimerId = setTimeout(() => { if (!cancelled) setShowRetry(true); }, 6000);

    // Timeout: 12s
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'AuthCallback timeout reached',
          data: { pollCount, hasHash },
          level: 'warning',
        });
        supabase!.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            redirect();
          } else {
            setError('Sign-in is taking longer than expected. Please try again.');
          }
        });
      }
    }, 12000);

    // Listen for auth state changes (fires when Supabase processes the hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) redirect();
    });

    // Poll for session every 1.5s — handles multi-tab race conditions
    const pollSession = async () => {
      pollCount++;
      const { data: { session } } = await supabase!.auth.getSession();
      if (session) {
        redirect();
      } else if (pollCount >= 3 && !manualAttempted) {
        // After 4.5s, try manual hash parsing as fallback
        tryManualSession();
      }
    };
    pollSession();
    const pollId = setInterval(pollSession, 1500);

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
          This can happen on slow connections or when multiple tabs are open. Try signing in again.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/profile', { replace: true })}
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
            Go to Profile
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#9ca3af',
              cursor: 'pointer'
            }}
          >
            Back to Home
          </button>
        </div>
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
          onClick={retryLogin}
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
